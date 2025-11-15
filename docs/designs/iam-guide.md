# IAM 多租户权限设计规范（CASL + CQRS + ES + EDA）

## 1. 文档概述

- 目的：定义多租户场景下的 IAM（Identity and Access Management，身份与访问管理）核心设计，涵盖权限建模、命令查询分离、事件溯源与事件驱动协同。
- 适用范围：聚焦身份与权限治理相关模块。业务域逻辑（如订单、财务等）仅作为集成示例，单独章节描述。
- 技术栈约束：`NestJS + TypeScript`、`@nestjs/cqrs`、`CASL`、`MikroORM`、`Event Store + Projection`、`@hl8/config`、`@hl8/logger`、`libs/infra/exceptions`。

## 2. 架构总览

### 2.1 系统架构与数据流

```
┌─────────────────────────────────────────────────────────────┐
│                  IAM 权限治理数据流（CQRS + ES + EDA）       │
├─────────────────────────────────────────────────────────────┤
│  命令侧 (Write)                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Command   │ →  │  Command    │ →  │   Domain    │      │
│  │   Handler   │    │  with CASL  │    │   Event     │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         ↓                      ↓               ↓            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ Event Store │ ←  │  Aggregate  │ ←  │ CASL Policy │      │
│  │   (ES)      │    │   (ES)      │    │  Evaluation │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  查询侧 (Read)                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Query     │ →  │  Query      │ →  │  Read Model │      │
│  │   Handler   │    │  with CASL  │    │  with CASL  │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         ↓                      ↓               ↓            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ CASL Filter │ →  │  Projection │ →  │   Response  │      │
│  │   (Mongo)   │    │   (EDA)     │    │   Filter    │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  事件驱动 (EDA)                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  Domain     │ →  │  Event      │ →  │  CASL Cache │      │
│  │   Event     │    │  Handler    │    │   Update    │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         ↓                      ↓               ↓            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  Saga       │ →  │  Ability    │ →  │  Policy     │      │
│  │ (Orchestration) │  Rebuild     │    │  Sync       │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 3. 领域层设计（ES 集成）

### 3.1 用户权限聚合根

```typescript
import { DateTime } from "luxon";

/**
 * 用户权限聚合根（事件溯源 + 多租户 + 审计）
 */
export class UserAuthorization extends MultiTenantEventSourcedAggregateRoot {
  private _userId: UserId;
  private _roles: Map<string, TenantRole> = new Map();
  private _permissions: Map<string, Permission> = new Map();
  private _status: AuthorizationStatus = AuthorizationStatus.Enabled;

  private constructor(userId: UserId, tenantId: TenantId) {
    super(tenantId);
    this._userId = userId;
  }

  /**
   * 从事件历史重建
   */
  static reconstitute(events: MultiTenantDomainEvent[]): UserAuthorization {
    if (events.length === 0) {
      throw new EmptyEventStreamError("用户权限事件流不能为空");
    }
    const first = events[0];
    const aggregate = new UserAuthorization(UserId.create(first.aggregateId), first.tenantId);
    aggregate.loadFromHistory(events);
    return aggregate;
  }

  /**
   * 分配角色命令
   */
  assignRole(command: AssignRoleCommand): void {
    if (!this.canAssignRole(command.assignedBy, command.role)) {
      throw new AuthorizationError("无权分配该角色");
    }
    if (this._roles.has(command.role.name)) {
      return;
    }
    this.apply(new RoleAssignedEvent(this._userId, this.tenantId, command.role, command.assignedBy, DateTime.now()));
  }

  /**
   * 撤销角色命令
   */
  revokeRole(command: RevokeRoleCommand): void {
    if (!this._roles.has(command.roleName)) {
      return;
    }
    if (!this.canRevokeRole(command.revokedBy, command.roleName)) {
      throw new AuthorizationError("无权撤销该角色");
    }
    this.apply(new RoleRevokedEvent(this._userId, this.tenantId, command.roleName, command.revokedBy, DateTime.now()));
  }

  /**
   * 检查权限
   */
  hasPermission(permission: Permission): boolean {
    if (this._permissions.has(permission.toString())) {
      return true;
    }
    for (const role of this._roles.values()) {
      if (role.hasPermission(permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 转换为 CASL 规则
   */
  toCaslRules(): RawRuleOf<AppAbility>[] {
    const rules: RawRuleOf<AppAbility>[] = [
      {
        action: "read",
        subject: "Tenant",
        conditions: { id: this.tenantId.value },
      },
    ];
    for (const role of this._roles.values()) {
      rules.push(...role.toCaslRules(this.tenantId));
    }
    for (const permission of this._permissions.values()) {
      rules.push(permission.toCaslRule(this.tenantId));
    }
    return rules;
  }

  private onRoleAssignedEvent(event: RoleAssignedEvent): void {
    this.assertTenant(event.tenantId);
    this._roles.set(event.role.name, event.role);
    this.touch();
  }

  private onRoleRevokedEvent(event: RoleRevokedEvent): void {
    this.assertTenant(event.tenantId);
    this._roles.delete(event.roleName);
    this.touch();
  }

  private onPermissionGrantedEvent(event: PermissionGrantedEvent): void {
    this.assertTenant(event.tenantId);
    this._permissions.set(event.permission.toString(), event.permission);
    this.touch();
  }

  private onPermissionRevokedEvent(event: PermissionRevokedEvent): void {
    this.assertTenant(event.tenantId);
    this._permissions.delete(event.permission.toString());
    this.touch();
  }

  private assertTenant(tenantId: TenantId): void {
    if (!this.tenantId.equals(tenantId)) {
      throw new CrossTenantOperationError("跨租户权限事件被拒绝");
    }
  }
}
```

### 3.2 权限领域事件

```typescript
/**
 * 角色分配事件
 */
export class RoleAssignedEvent extends MultiTenantDomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly role: TenantRole,
    public readonly assignedBy: UserId,
    public readonly assignedAt: DateTime,
  ) {
    super(userId.value, tenantId);
  }
}

/**
 * 角色撤销事件
 */
export class RoleRevokedEvent extends MultiTenantDomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly roleName: string,
    public readonly revokedBy: UserId,
    public readonly revokedAt: DateTime,
  ) {
    super(userId.value, tenantId);
  }
}

/**
 * 权限授予事件
 */
export class PermissionGrantedEvent extends MultiTenantDomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly permission: Permission,
    public readonly grantedBy: UserId,
    public readonly grantedAt: DateTime,
  ) {
    super(userId.value, tenantId);
  }
}

/**
 * 授权状态变更事件
 */
export class AuthorizationStatusChangedEvent extends MultiTenantDomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly oldStatus: AuthorizationStatus,
    public readonly newStatus: AuthorizationStatus,
    public readonly changedBy: UserId,
    public readonly reason: string,
  ) {
    super(userId.value, tenantId);
  }
}
```

## 4. 应用层设计（CQRS 集成）

### 4.1 命令侧

```typescript
/**
 * 基础 CASL 命令
 */
export abstract class CaslCommand extends MultiTenantCommand {
  protected constructor(securityContext: SecurityContext, commandId: string = ulid()) {
    super(securityContext, commandId);
  }
}

/**
 * 带权限验证的命令处理器基类
 */
export abstract class CaslCommandHandler<TCommand extends CaslCommand> extends MultiTenantCommandHandler<TCommand> {
  constructor(
    protected readonly abilityService: CaslAbilityService,
    tenantRepository: TenantRepository,
    eventStore: EventStore,
    auditService: AuditService,
    eventBus: EventBus,
    protected readonly commandValidator: CommandValidator,
  ) {
    super(abilityService, tenantRepository, eventStore, auditService, eventBus);
  }

  protected async validateCommandPermission(command: TCommand, action: Action, subject: AppSubject): Promise<void> {
    const ability = await this.abilityService.getAbilityForUser(command.securityContext.userId, command.securityContext.tenantId);
    if (!ability.can(action, subject)) {
      throw new AuthorizationError(`无权执行命令: ${action} ${typeof subject === "string" ? subject : subject.__typename}`);
    }
  }

  protected async loadAggregate<TAggregate extends MultiTenantEventSourcedAggregateRoot>(aggregateClass: new (...args: unknown[]) => TAggregate, aggregateId: string, tenantId: TenantId): Promise<TAggregate> {
    const events = await this.eventStore.getEvents(aggregateId, tenantId);
    return aggregateClass.reconstitute(events);
  }
}

/**
 * 分配角色命令处理器
 */
@CommandHandler(AssignRoleCommand)
export class AssignRoleCommandHandler extends CaslCommandHandler<AssignRoleCommand> {
  constructor(
    abilityService: CaslAbilityService,
    tenantRepository: TenantRepository,
    eventStore: EventStore,
    auditService: AuditService,
    eventBus: EventBus,
    commandValidator: CommandValidator,
    private readonly roleRepository: RoleRepository,
  ) {
    super(abilityService, tenantRepository, eventStore, auditService, eventBus, commandValidator);
  }

  async execute(command: AssignRoleCommand): Promise<void> {
    await this.commandValidator.validate(command);
    await this.validateTenantStatus(command);
    await this.validateCommandPermission(command, "assign", { __typename: "TenantRole", name: command.role.name });

    const userAuth = await this.loadAggregate(UserAuthorization, `user_auth_${command.userId.value}_${command.securityContext.tenantId}`, TenantId.create(command.securityContext.tenantId));

    userAuth.assignRole(command);

    const events = userAuth.getUncommittedEvents();
    await this.saveMultiTenantAggregate(userAuth);
    await this.publishMultiTenantEvents(events);
  }
}
```

### 4.2 查询侧

```typescript
/**
 * CASL 查询基类
 */
export abstract class CaslQuery implements IQuery {
  constructor(
    public readonly securityContext: SecurityContext,
    public readonly queryId: string = ulid(),
  ) {}
}

/**
 * CASL 查询处理器基类
 */
export abstract class CaslQueryHandler<TQuery extends CaslQuery, TResult> implements IQueryHandler<TQuery, TResult> {
  constructor(
    protected readonly abilityService: CaslAbilityService,
    protected readonly caslFilter: CaslMikroORMFilter,
  ) {}

  protected async applyCaslFilter<T>(query: TQuery, entityClass: EntityClass<T>, action: Action = "read"): Promise<FilterQuery<T>> {
    return this.caslFilter.addConditionsToQuery(entityClass, action, query.securityContext.userId, query.securityContext.tenantId);
  }

  protected async filterResults<T extends SubjectObject>(results: T[], query: TQuery, action: Action = "read"): Promise<T[]> {
    const ability = await this.abilityService.getAbilityForUser(query.securityContext.userId, query.securityContext.tenantId);
    return results.filter((result) => ability.can(action, result));
  }
}

/**
 * 获取用户权限查询处理器
 */
@QueryHandler(GetUserPermissionQuery)
export class GetUserPermissionQueryHandler extends CaslQueryHandler<GetUserPermissionQuery, UserPermission> {
  constructor(
    abilityService: CaslAbilityService,
    caslFilter: CaslMikroORMFilter,
    private readonly userPermissionProjection: UserPermissionProjection,
  ) {
    super(abilityService, caslFilter);
  }

  async execute(query: GetUserPermissionQuery): Promise<UserPermission> {
    await this.applyCaslFilter(query, UserPermission, "read");
    const permission = await this.userPermissionProjection.getUserPermissions(query.userId, TenantId.create(query.securityContext.tenantId));
    if (!permission) {
      throw new AuthorizationError("未找到用户权限数据");
    }
    return permission;
  }
}
```

```typescript
/**
 * 获取用户能力查询
 */
export class GetUserAbilityQuery extends CaslQuery {
  constructor(
    public readonly userId: UserId,
    securityContext: SecurityContext,
  ) {
    super(securityContext);
  }
}
```

```typescript
/**
 * 获取用户能力查询处理器
 */
@QueryHandler(GetUserAbilityQuery)
export class GetUserAbilityQueryHandler extends CaslQueryHandler<GetUserAbilityQuery, AppAbility> {
  constructor(abilityService: CaslAbilityService, caslFilter: CaslMikroORMFilter) {
    super(abilityService, caslFilter);
  }

  async execute(query: GetUserAbilityQuery): Promise<AppAbility> {
    await this.applyCaslFilter(query, UserPermission, "read");
    return this.abilityService.getAbilityForUser(query.userId.value, query.securityContext.tenantId);
  }
}
```

### 4.3 多层级数据隔离策略

- **租户级**：所有命令/查询继承 `MultiTenantCommand` / `MultiTenantQuery`，构造期校验 `tenantId`；处理器通过 `validateTenantStatus` 确认租户有效。
- **组织级**：命令与查询显式传入 `organizationId`，仓储接口默认拼接 `tenantId + organizationId` 过滤条件。
- **部门级**：需要时追加 `departmentIds`，以 `DepartmentId` 值对象传入仓储或 CASL 规则，实现最小权限控制。
- **审计联动**：命令处理器统一调用 `saveMultiTenantAggregate` + `publishMultiTenantEvents`，同时通过 `AuditService` 记录操作主体、租户、组织、部门等维度。

## 5. 事件驱动架构（EDA 集成）

### 5.1 权限相关事件处理器

```typescript
/**
 * 角色分配事件处理器
 */
@EventHandler(RoleAssignedEvent)
export class RoleAssignedEventHandler implements IEventHandler<RoleAssignedEvent> {
  constructor(
    private readonly abilityService: CaslAbilityService,
    private readonly cacheService: CacheService,
    private readonly userPermissionProjection: UserPermissionProjection,
    private readonly eventBus: EventBus,
    @InjectLogger(RoleAssignedEventHandler.name)
    private readonly logger: AppLoggerService,
  ) {}

  async handle(event: RoleAssignedEvent): Promise<void> {
    try {
      await this.abilityService.clearUserCache(event.userId.value, event.tenantId.value);
      await this.updateUserPermissionProjection(event);
      await this.eventBus.publish(new PermissionChangedEvent(event.userId, event.tenantId, "role_assigned", { role: event.role.name }));
      this.logger.info("角色分配事件处理完成", {
        userId: event.userId.value,
        tenantId: event.tenantId.value,
      });
    } catch (error) {
      this.logger.error("角色分配事件处理失败", {
        userId: event.userId.value,
        tenantId: event.tenantId.value,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  private async updateUserPermissionProjection(event: RoleAssignedEvent): Promise<void> {
    await this.userPermissionProjection.updateUserRoles(event.userId, event.tenantId, event.role);
  }
}

/**
 * 权限变更 Saga
 */
@Injectable()
export class PermissionChangeSaga extends Saga {
  constructor(
    @InjectLogger(PermissionChangeSaga.name)
    private readonly logger: AppLoggerService,
    private readonly roleRepository: RoleRepository,
    private readonly abilityService: CaslAbilityService,
  ) {
    super();
  }

  @SagaEventHandler(RoleAssignedEvent)
  async onRoleAssigned(event: RoleAssignedEvent): Promise<void> {
    const sagaId = `permission_change_${event.userId.value}_${event.tenantId.value}`;
    try {
      await this.validateRoleAssignment(event);
      await this.updateRelatedSystems(event);
      await this.sendNotifications(event);
      await this.recordAuditLog(event);
      await this.eventBus.publish(new PermissionChangeCompletedEvent(event.userId, event.tenantId, sagaId));
    } catch (error) {
      await this.eventBus.publish(new PermissionChangeFailedEvent(event.userId, event.tenantId, sagaId, error.message));
    }
  }

  private async validateRoleAssignment(event: RoleAssignedEvent): Promise<void> {
    const role = await this.roleRepository.findByName(event.role.name);
    if (!role) {
      throw new Error(`角色 ${event.role.name} 不存在`);
    }
    const assignerAbility = await this.abilityService.getAbilityForUser(event.assignedBy.value, event.tenantId.value);
    if (!assignerAbility.can("assign", role)) {
      throw new AuthorizationError("分配者无权分配该角色");
    }
  }
}

/**
 * 能力重建事件处理器
 */
@EventHandler(PermissionChangedEvent)
export class PermissionChangedEventHandler implements IEventHandler<PermissionChangedEvent> {
  constructor(
    private readonly abilityService: CaslAbilityService,
    private readonly abilityProjection: AbilityProjection,
    private readonly cacheService: CacheService,
  ) {}

  async handle(event: PermissionChangedEvent): Promise<void> {
    await this.abilityProjection.rebuildUserAbility(event.userId, event.tenantId);
    await this.cacheService.del(`casl:ability:${event.userId.value}:${event.tenantId.value}`);
    await this.abilityService.getAbilityForUser(event.userId.value, event.tenantId.value);
  }
}
```

### 5.2 读模型投影

```typescript
/**
 * 用户权限投影
 */
@Injectable()
export class UserPermissionProjection {
  constructor(
    private readonly em: EntityManager,
    private readonly eventStore: EventStore,
  ) {}

  @ProjectionHandler(RoleAssignedEvent)
  async onRoleAssigned(event: RoleAssignedEvent): Promise<void> {
    const userPermission = await this.getOrCreateUserPermission(event.userId, event.tenantId);
    userPermission.addRole(event.role);
    userPermission.version = event.version;
    await this.em.persistAndFlush(userPermission);
  }

  @ProjectionHandler(RoleRevokedEvent)
  async onRoleRevoked(event: RoleRevokedEvent): Promise<void> {
    const userPermission = await this.getUserPermission(event.userId, event.tenantId);
    if (userPermission) {
      userPermission.removeRole(event.roleName);
      userPermission.version = event.version;
      await this.em.persistAndFlush(userPermission);
    }
  }

  async rebuildUserPermission(userId: UserId, tenantId: TenantId): Promise<void> {
    const events = await this.eventStore.getEvents(`user_auth_${userId.value}_${tenantId.value}`);
    await this.em.nativeDelete(UserPermissionEntity, {
      userId: userId.value,
      tenantId: tenantId.value,
    });
    for (const event of events) {
      await this.applyEvent(event);
    }
  }

  async getUserPermissions(userId: UserId, tenantId: TenantId): Promise<UserPermissionEntity> {
    return this.em.findOne(UserPermissionEntity, {
      userId: userId.value,
      tenantId: tenantId.value,
    });
  }
}

/**
 * CASL 能力投影
 */
@Injectable()
export class AbilityProjection {
  constructor(
    private readonly userPermissionProjection: UserPermissionProjection,
    private readonly cacheService: CacheService,
  ) {}

  async rebuildUserAbility(userId: UserId, tenantId: TenantId): Promise<void> {
    const rules = await this.userPermissionProjection.getUserAbilities(userId, tenantId);
    const ability = createMongoAbility<AppAbility>(rules);
    const cacheKey = `${userId.value}:${tenantId.value}`;
    await this.cacheService.set(`casl:ability:${cacheKey}`, rules, 3600);
  }
}
```

## 6. 基础设施层设计

### 6.1 事件存储集成

```typescript
/**
 * 事件存储的 CASL 能力工厂
 */
@Injectable()
export class EventSourcedCaslAbilityFactory extends DomainCaslAbilityFactory {
  constructor(
    private readonly eventStore: EventStore,
    private readonly userAuthProjection: UserPermissionProjection,
  ) {
    super(/* 依赖注入 */);
  }

  async createForUser(user: User, tenant: Tenant): Promise<AppAbility> {
    try {
      const rules = await this.userAuthProjection.getUserAbilities(user.id, tenant.id);
      if (rules.length > 0) {
        return createMongoAbility<AppAbility>(rules);
      }
    } catch (error) {
      // 投影未就绪时退回事件流
    }
    return this.createFromEventStream(user, tenant);
  }

  private async createFromEventStream(user: User, tenant: Tenant): Promise<AppAbility> {
    const events = await this.eventStore.getEvents(`user_auth_${user.id.value}_${tenant.id.value}`);
    if (events.length === 0) {
      return createMongoAbility<AppAbility>([
        {
          action: "read",
          subject: "Tenant",
          conditions: { id: tenant.id.value },
        },
      ]);
    }
    const userAuth = UserAuthorization.reconstitute(events);
    const rules = userAuth.toCaslRules();
    return createMongoAbility<AppAbility>(rules);
  }
}
```

### 6.2 消息总线集成

```typescript
/**
 * 权限事件发布器
 */
@Injectable()
export class PermissionEventPublisher {
  constructor(
    private readonly eventBus: EventBus,
    private readonly messageBroker: MessageBroker,
  ) {}

  async publishPermissionEvents(events: DomainEvent[]): Promise<void> {
    this.eventBus.publishAll(events);
    for (const event of events) {
      await this.messageBroker.publish("permission.events", {
        type: event.constructor.name,
        data: event,
        timestamp: new Date(),
        metadata: {
          eventId: event.eventId,
          aggregateId: event.aggregateId,
        },
      });
    }
  }

  async publishPermissionChange(userId: UserId, tenantId: TenantId, changeType: string, details: Record<string, unknown>): Promise<void> {
    const event = new PermissionChangedEvent(userId, tenantId, changeType, details);
    await this.messageBroker.publish("permission.changes", {
      event,
      recipients: this.getNotificationRecipients(userId, tenantId),
    });
  }

  private getNotificationRecipients(userId: UserId, tenantId: TenantId): string[] {
    // 仅作为示例，实际实现可接入消息中心
    return [`iam-admin:${tenantId.value}`, `user:${userId.value}`];
  }
}
```

## 7. 接口层设计（CQRS 适配）

### 7.1 命令控制器

```typescript
@Controller("commands")
@UseGuards(MultiTenantAuthGuard, CaslGuard)
export class CommandController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly abilityService: CaslAbilityService,
  ) {}

  @Post("roles/assign")
  @CheckPolicies("assign", "Role")
  async assignRole(@SecurityContext() context: SecurityContext, @Body() assignRoleDto: AssignRoleRequestDto): Promise<ApiResponse<void>> {
    const command = new AssignRoleCommand(
      {
        userId: UserId.create(assignRoleDto.userId),
        tenantId: TenantId.create(context.tenantId),
        role: await this.roleRepository.findByName(assignRoleDto.roleName),
        assignedBy: UserId.create(context.userId),
      },
      context,
    );

    await this.commandBus.execute(command);
    return ApiResponse.empty("角色分配成功");
  }

  @Post("roles/revoke")
  @CheckPolicies("revoke", "Role")
  async revokeRole(@SecurityContext() context: SecurityContext, @Body() revokeRoleDto: RevokeRoleRequestDto): Promise<ApiResponse<void>> {
    const command = new RevokeRoleCommand(revokeRoleDto, context);
    await this.commandBus.execute(command);
    return ApiResponse.empty("角色撤销成功");
  }
}
```

### 7.2 查询控制器

```typescript
@Controller("queries")
@UseGuards(MultiTenantAuthGuard, CaslGuard)
export class QueryController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get("users/:id/permissions")
  @CheckPolicies("read", "UserPermission")
  async getUserPermissions(@SecurityContext() context: SecurityContext, @Param("id") userId: string): Promise<ApiResponse<UserPermissionResponseDto>> {
    const query = new GetUserPermissionQuery(UserId.create(userId), TenantId.create(context.tenantId), context);
    const permissions = await this.queryBus.execute(query);
    return ApiResponse.success(this.toPermissionResponseDto(permissions));
  }

  @Get("users/:id/abilities")
  @CheckPolicies("read", "UserAbility")
  async getUserAbilities(@SecurityContext() context: SecurityContext, @Param("id") userId: string): Promise<ApiResponse<AbilityResponseDto>> {
    const ability = await this.abilityService.getAbilityForUser(userId, context.tenantId);
    return ApiResponse.success(this.toAbilityResponseDto(ability));
  }
}
```

### 7.3 事件订阅控制器

```typescript
@Controller("events")
@UseGuards(MultiTenantAuthGuard, CaslGuard)
export class EventController {
  constructor(private readonly eventBus: EventBus) {}

  @Post("permissions/rebuild")
  @CheckPolicies("manage", "PermissionSystem")
  async rebuildPermissions(@SecurityContext() context: SecurityContext, @Body() rebuildDto: RebuildPermissionsRequestDto): Promise<ApiResponse<void>> {
    const event = new PermissionsRebuildRequestedEvent(TenantId.create(context.tenantId), UserId.create(context.userId), rebuildDto.scope);
    await this.eventBus.publish(event);
    return ApiResponse.empty("权限重建任务已提交");
  }
}
```

## 8. 配置与模块

```typescript
@Module({
  imports: [CqrsModule, EventStoreModule.forRoot(), EventBusModule.forRoot(), CaslModule],
  providers: [
    // 命令处理器
    AssignRoleCommandHandler,
    RevokeRoleCommandHandler,

    // 查询处理器
    GetUserPermissionQueryHandler,
    GetUserAbilityQueryHandler,

    // 事件处理器
    RoleAssignedEventHandler,
    RoleRevokedEventHandler,
    PermissionChangedEventHandler,
    PermissionChangeSaga,

    // 投影
    UserPermissionProjection,
    AbilityProjection,

    // Ability 工厂
    EventSourcedCaslAbilityFactory,
  ],
  exports: [CaslAbilityService, EventStore, EventBus],
})
export class AuthorizationCqrsModule {}

/**
 * 事件存储模块
 */
@Module({
  imports: [MikroOrmModule.forFeature([UserAuthorizationEntity, UserPermissionEntity, EventEntity])],
  providers: [
    {
      provide: EventStore,
      useClass: MikroORMEventStore,
    },
  ],
  exports: [EventStore],
})
export class EventStoreModule {}
```

## 9. 业务域使用示例（非 IAM 逻辑）

业务域（例如订单域）需要在执行自身命令、查询时调用 IAM 提供的能力与策略。以下代码仅作为示例，展示如何在业务模块中复用 IAM 的权限校验。

### 9.1 订单命令权限检查示例

```typescript
/**
 * 示例命令处理器：创建订单（业务域逻辑，不属于 IAM）
 */
@CommandHandler(CreateOrderCommand)
export class CreateOrderCommandHandler extends CaslCommandHandler<CreateOrderCommand> {
  async execute(command: CreateOrderCommand): Promise<OrderResult> {
    await this.commandValidator.validate(command);
    await this.validateTenantStatus(command);

    const ability = await this.abilityService.getAbilityForUser(command.securityContext.userId, command.securityContext.tenantId);

    const orderSubject = {
      __typename: "Order",
      totalAmount: command.totalAmount,
      productType: command.productType,
      customerTier: command.customerTier,
    };

    if (!ability.can("create", orderSubject)) {
      throw new AuthorizationError("无权创建此类型订单");
    }

    const order = Order.create(command, TenantId.create(command.securityContext.tenantId), OrganizationId.create(command.organizationId));

    if (!ability.can("read", order)) {
      throw new AuthorizationError("无权访问创建的订单");
    }

    const events = order.getUncommittedEvents();
    await this.saveMultiTenantAggregate(order);
    await this.publishMultiTenantEvents(events);

    return OrderResult.from(order);
  }
}
```

### 9.2 订单查询权限过滤示例

```typescript
/**
 * 示例查询处理器：获取订单列表（业务域逻辑，不属于 IAM）
 */
@QueryHandler(GetOrdersQuery)
export class GetOrdersQueryHandler extends CaslQueryHandler<GetOrdersQuery, Order[]> {
  constructor(
    abilityService: CaslAbilityService,
    caslFilter: CaslMikroORMFilter,
    private readonly orderRepository: OrderRepository,
    private readonly orderProjection: OrderProjection,
  ) {
    super(abilityService, caslFilter);
  }

  async execute(query: GetOrdersQuery): Promise<Order[]> {
    if (query.useProjection) {
      return this.executeWithProjection(query);
    }
    return this.executeWithCaslFilter(query);
  }

  private async executeWithProjection(query: GetOrdersQuery): Promise<Order[]> {
    const orders = await this.orderProjection.findByTenant(TenantId.create(query.securityContext.tenantId), query.filters);
    return this.filterResults(orders, query, "read");
  }

  private async executeWithCaslFilter(query: GetOrdersQuery): Promise<Order[]> {
    const caslConditions = await this.applyCaslFilter(query, Order, "read");
    const tenantId = TenantId.create(query.securityContext.tenantId);
    const organizationId = OrganizationId.create(query.organizationId);
    const departmentIds = (query.departmentIds ?? []).map(DepartmentId.create);

    return this.orderRepository.findByTenantAndOrganization(
      tenantId,
      organizationId,
      departmentIds,
      {
        ...query.filters,
        ...caslConditions,
      },
      query.pagination,
    );
  }
}
```

### 9.3 集成步骤

1. 业务命令/查询继承 IAM 提供的 `CaslCommand` / `CaslQuery` 基类，复用多租户上下文与权限校验。
2. 在业务模块中注入 `CaslAbilityService`、`CaslMikroORMFilter` 等 IAM 服务，确保能力缓存与过滤策略统一。
3. 业务事件触发后，通过 `PermissionEventPublisher` 或领域事件与 IAM 进行联动，例如用户角色变更后更新业务投影。

## 10. 测试与治理要求

- **单元测试**：命令/查询处理器、聚合根、仓储实现旁置 `{file}.spec.ts`，核心 IAM 逻辑覆盖率 ≥ 90%。
- **集成测试**：`tests/integration/` 验证命令→事件→投影→能力缓存链路；业务域示例需模拟 IAM 服务依赖。
- **Saga 演练**：覆盖权限变更正向流程与补偿流程，验证失败分支处理。
- **契约测试**：对外事件与 API 需建立契约测试，防止跨领域协作破坏。
- **监控与审计**：统一使用 `@hl8/logger` 输出日志，核心指标（缓存命中率、事件重试率、命令延迟）需接入监控系统。

## 11. 总结

- 本规范聚焦 IAM 核心职责，涵盖聚合根、命令查询、事件驱动、能力缓存等实现细节，确保多租户场景下的身份与权限治理一致性。
- 业务域通过复用 IAM 的 CASL 能力与多租户上下文即可完成权限控制，示例章节提供集成参考。
- 建议结合 `docs/designs/demo2.md` 与 `docs/designs/iam-domain-boundary-supplement.md`，在团队协作、模块划分与演进规划上保持统一认知。

## 附录：实施蓝图（Demo2 整合）

> 本附录整理自原 `docs/designs/demo2.md` 的实施规划，用于指导团队在采用本 IAM 规范后落地项目结构、团队分工与运维策略。如已有内部版本，可根据实际进度裁剪或替换。

### 1. 领域划分

基于多租户认证授权的核心业务场景，结合 DDD 思想，将系统划分为以下**核心子域**和**支撑子域**：

#### 1.1 核心子域

核心子域承载系统的核心价值，是权限管理的业务核心：

| 子域名称         | 核心职责                                                           | 核心聚合根/实体                                                               |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **用户权限域**   | 管理用户与权限/角色的关联关系，实现权限的授予、撤销与状态变更      | `UserAuthorization`（聚合根）、`Permission`（值对象）、`TenantRole`（值对象） |
| **角色管理域**   | 定义多租户下的角色模型（含角色关联的权限集合），支持角色的增删改查 | `TenantRole`（聚合根）、`RolePermission`（值对象）                            |
| **多租户隔离域** | 实现租户级数据隔离、租户状态管理，保障跨租户操作的安全性           | `Tenant`（聚合根）、`TenantConfig`（值对象）、`SecurityContext`（上下文对象） |

#### 1.2 支撑子域

IAM 复用平台级通用能力，请参见：

- `docs/designs/platform-domain-baseline.md`（领域层基线能力，聚合根/实体/值对象/领域事件/仓储接口，内建审计与软删除、UUID 标识策略）。
- `docs/designs/platform-domain-design.md`（领域层详细设计，包含审计轨迹、软删除及测试指引）。
- `docs/designs/platform-cqrs-es-eda-baseline.md`（应用层通用能力，涵盖命令/查询基类、事件溯源、事件驱动、CASL 能力、审计日志等）。

IAM 领域需在本模块中注入这些基线能力后，扩展租户/权限特有的业务规则与策略。

#### 1.3 通用子域

值对象、缓存等通用子域同样遵循平台基线规范。IAM 额外约定：

- 在权限聚合根与投影中必须使用平台提供的 `UserId`、`TenantId`、`OrganizationId`、`DepartmentId` 等值对象。
- 缓存命名遵循 `casl:ability:${userId}:${tenantId}` 约定，缓存驱动由平台统一注入。

### 2. 项目组织结构

结合 **DDD 分层架构**、**CQRS 读写分离** 与 **多租户隔离** 要求，采用**按领域+分层**的混合组织结构，既保障领域内聚，又清晰区分技术职责。

#### 2.1 项目根结构

```
iam/
├── src/
│   ├── domains/                  # 领域层：按子域划分，包含各域的聚合根、事件、值对象
│   ├── application/              # 应用层：CQRS 命令/查询处理器、Saga 编排
│   ├── infrastructure/           # 基础设施层：事件存储、缓存、消息总线、外部集成
│   ├── interfaces/               # 接口层：API 控制器、DTO、Guards/Interceptors
│   ├── shared/                   # 共享层：通用工具、值对象、异常、常量
│   └── main.ts                   # 应用入口
├── test/                         # 测试目录：单元测试、集成测试、E2E 测试
├── .env.example                  # 环境变量示例
├── nest-cli.json                 # NestJS 配置
└── package.json                  # 依赖配置
```

#### 2.2 各层详细结构

##### 2.2.1 领域层（`src/domains`）

按**子域**划分子目录，每个子域内部遵循 DDD 分层（聚合根、事件、值对象、仓储接口）：

```
domains/
├── user-permission/              # 用户权限子域
│   ├── aggregates/               # 聚合根
│   │   ├── user-authorization.aggregate.ts
│   │   └── user-authorization.events.ts  # 聚合根关联的领域事件
│   ├── value-objects/            # 值对象
│   │   ├── permission.vo.ts
│   │   └── tenant-role.vo.ts
│   ├── repositories/             # 仓储接口（由基础设施层实现）
│   │   └── user-authorization.repository.ts
│   └── exceptions/               # 领域异常
│       └── authorization.error.ts
├── role-management/              # 角色管理子域
│   ├── aggregates/
│   │   ├── tenant-role.aggregate.ts
│   │   └── tenant-role.events.ts
│   ├── value-objects/
│   │   └── role-permission.vo.ts
│   └── repositories/
│       └── tenant-role.repository.ts
└── multi-tenant/                 # 多租户隔离子域
    ├── aggregates/
    │   └── tenant.aggregate.ts
    ├── value-objects/
    │   ├── tenant-config.vo.ts
    │   └── security-context.vo.ts
    └── exceptions/
        └── cross-tenant.error.ts
```

##### 2.2.2 应用层（`src/application`）

按 **CQRS 读写分离** 组织，包含命令、查询、Saga 三大核心模块：

```
application/
├── commands/                     # 命令侧：命令定义、处理器
│   ├── role/                     # 角色相关命令
│   │   ├── assign-role.command.ts
│   │   └── assign-role.handler.ts
│   ├── permission/               # 权限相关命令
│   │   ├── grant-permission.command.ts
│   │   └── grant-permission.handler.ts
│   └── casl-command.base.ts      # CASL 命令基类
├── queries/                      # 查询侧：查询定义、处理器
│   ├── order/                    # 订单相关查询（示例）
│   │   ├── get-orders.query.ts
│   │   └── get-orders.handler.ts
│   ├── user/                     # 用户权限查询
│   │   ├── get-user-permissions.query.ts
│   │   └── get-user-permissions.handler.ts
│   └── casl-query.base.ts        # CASL 查询基类
└── sagas/                        # Saga 编排（复杂流程）
    ├── permission-change.saga.ts
    └── role-assignment.saga.ts
```

##### 2.2.3 基础设施层（`src/infrastructure`）

实现领域层的仓储接口、事件存储、消息总线等基础设施：

```
infrastructure/
├── event-store/                  # 事件溯源实现
│   ├── mikro-orm-event-store.ts  # MikroORM 适配的事件存储
│   └── event-store.interface.ts
├── message-bus/                  # 事件驱动实现
│   ├── nest-event-bus.ts         # NestJS EventBus 适配
│   └── message-broker.ts         # 外部消息队列集成（如 Kafka/RabbitMQ）
├── casl/                         # CASL 能力工厂实现
│   ├── event-sourced-ability.factory.ts
│   └── casl-ability.service.ts
├── projections/                  # 读模型投影
│   ├── user-permission.projection.ts
│   └── ability.projection.ts
└── repositories/                 # 仓储接口实现
    ├── user-authorization.repository.impl.ts
    └── tenant-role.repository.impl.ts
```

##### 2.2.4 接口层（`src/interfaces`）

对外暴露 API 接口，包含控制器、DTO、 Guards 等：

```
interfaces/
├── controllers/                  # CQRS 风格控制器
│   ├── command.controller.ts     # 命令控制器
│   └── query.controller.ts       # 查询控制器
├── dtos/                         # 数据传输对象
│   ├── request/
│   │   ├── assign-role.request.dto.ts
│   │   └── create-order.request.dto.ts
│   └── response/
│       ├── order.response.dto.ts
│       └── user-permission.response.dto.ts
└── guards/                       # 权限守卫
    ├── multi-tenant-auth.guard.ts
    └── casl.guard.ts
```

##### 2.2.5 共享层（`src/shared`）

提供全系统复用的工具与通用能力：

```
shared/
├── value-objects/                # 通用值对象
│   ├── user-id.vo.ts
│   └── tenant-id.vo.ts
├── exceptions/                   # 全局异常
│   ├── domain.error.ts
│   └── application.error.ts
├── utils/                        # 工具函数
│   ├── ulid.util.ts
│   └── date.util.ts
└── constants/                    # 全局常量
    └── casl.constants.ts
```

### 3. 核心流程与机制

#### 3.1 命令驱动流程（Command → Event → Projection → Ability）

1. **命令接入**：`CaslCommandHandler` 在执行前调用 `CaslAbilityService.getAbilityForUser` 对 `action + subject` 做能力校验，并通过 `validateTenantStatus`、`CommandValidator` 保证租户有效与命令参数合法。
2. **事件溯源**：聚合根（如 `UserAuthorization`）应用命令并产出 `MultiTenantDomainEvent`，由 `saveMultiTenantAggregate` 写入 `EventStore`，事件载荷必须包含 `tenantId`、审计字段（`assignedBy`、`assignedAt` 等）以支持跨租户追踪。
3. **事件派发**：事件通过 `EventBus` 发布到内部总线与外部 `MessageBroker`，在传输层附带 `correlationId`、`causationId` 保证链路可观测。
4. **读模型投影**：`ProjectionHandler`（如 `UserPermissionProjection`、`AbilityProjection`）监听事件更新读模型与缓存，读模型使用 `tenantId + userId` 作为联合键，实现多层隔离。
5. **能力刷新**：投影完成后触发 `PermissionChangedEvent`，`PermissionChangedEventHandler` 重建用户 CASL 规则并写入缓存，保证后续命令/查询命中最新能力。

#### 3.2 多租户上下文传递

- **入口拦截**：`MultiTenantAuthGuard` 从 JWT / 请求头解析 `tenantId`、`organizationId`、`departmentIds` 及用户信息，将其封装为 `SecurityContext` 并存入 `AsyncLocalStorage`，供命令、查询、事件处理共享。
- **跨层约束**：所有 `MultiTenantCommand`、`MultiTenantQuery`、`MultiTenantDomainEvent` 必须在构造函数中校验 `tenantId` 非空且与当前上下文一致；需要组织、部门上下文的命令/查询需显式传入 `organizationId` 与 `DepartmentId` 集合，并在处理器层通过 `validateTenantStatus`、`validateOrganizationScope`、`validateDepartmentScope` 统一校验。聚合根在 `apply` 方法内通过 `assertTenant` 防止跨租户污染。
- **数据访问**：仓储实现（MikroORM）统一拼接 `tenantId + organizationId (+ departmentIds)` 条件，同时在数据库层面启用租户列索引、组织/部门复合索引与行级安全策略，实现多层纵深隔离。
- **审计联动**：命令处理器统一使用 `saveMultiTenantAggregate` + `publishMultiTenantEvents`，并在审计日志中记录租户、组织、部门维度字段，保证跨层操作可追踪。

#### 3.3 CASL 能力缓存策略

- **多级缓存**：`CaslAbilityService` 先从 Redis（`casl:ability:${userId}:${tenantId}`）读取能力规则，命中失败时回退至 `AbilityProjection`；若读模型未就绪，再通过 `EventStore` 重建聚合，最后写回缓存。
- **失效策略**：事件处理器在权限变更后调用 `abilityService.clearUserCache`，并触发能力重建任务；定时任务每小时执行一次租户级预热（`AbilityProjection.rebuildTenantAbilities`），保障冷启动性能。
- **安全控制**：缓存命中后仍需在 `CaslGuard` 内进行能力验证，防止缓存穿透导致的越权。

#### 3.4 事件失败与补偿

- **快速失败**：事件处理器捕获异常后通过 `@hl8/logger` 记录 `error` 日志，将事件推入重试队列（指数型退避，最大 5 次）。
- **Saga 补偿**：`PermissionChangeSaga` 维护状态机，若某环节失败则发布 `PermissionChangeFailedEvent` 并执行补偿命令（如撤销角色、回滚读模型）。
- **死信处理**：超过重试上限的事件进入死信主题，由运维团队基于审计日志手动恢复或回放事件。

#### 3.5 审计与日志接入

- **审计写入**：命令处理器在 `saveMultiTenantAggregate` 后调用 `AuditService.record` 记录操作主体、租户、命令类型、字段差异，满足合规要求。
- **标准日志**：所有服务依赖 `@hl8/logger` 输出结构化日志，默认字段包含 `tenantId`、`userId`、`commandId`、`eventId`；禁止使用 Nest 默认 `Logger`。
- **异常统一化**：领域与应用异常继承 `libs/infra/exceptions` 中的基础类，通过接口层异常过滤器转换为标准错误响应，保证前后端语义一致。

### 4. 团队组织结构建议

为匹配领域划分与项目结构，建议采用**领域驱动的团队结构**（即“特性团队”或“领域团队”），每个团队负责一个或多个紧密关联的子域，保障业务理解的一致性与开发效率：

| 团队名称                 | 负责子域                                         | 核心成员角色                          |
| ------------------------ | ------------------------------------------------ | ------------------------------------- |
| **权限核心团队**         | 用户权限域、角色管理域                           | 领域专家（DDD）、后端开发、测试工程师 |
| **多租户与集成团队**     | 多租户隔离域、EDA 域、消息总线集成               | 云原生工程师、后端开发、DevOps 工程师 |
| **CQRS/ES 基础设施团队** | CQRS 域、ES 域、缓存域                           | 后端架构师、数据库工程师、测试工程师  |
| **接口与前端团队**       | 接口层、前端权限组件集成（如 CASL 规则前端适配） | 前端开发、API 设计师、测试工程师      |

### 5. 测试、配置与运维策略

#### 5.1 测试分层

- **单元测试**：命令/查询处理器、聚合根、仓储实现旁置 `{file}.spec.ts`，覆盖率目标：核心域 ≥ 90%，支撑域 ≥ 80%。
- **集成测试**：`tests/integration/` 验证命令→事件→投影链路，Mock 外部消息系统；`tests/e2e/` 覆盖典型租户场景（角色分配、权限撤销、跨租户防护）。
- **Saga 演练**：为 `PermissionChangeSaga` 构建正向与补偿路线测试，确保异常分支可预测。

#### 5.2 配置与环境

- **配置来源**：所有配置通过 `@hl8/config` 管理，定义 `AuthorizationConfig`、`CaslCacheConfig` 等类并使用 `class-validator` 校验字段。
- **多环境支持**：区分 `dev`、`staging`、`prod` 环境变量文件，缓存、事件总线、数据库等关键参数支持热更新并记录审计。

#### 5.3 运行监控

- **指标采集**：集成 Prometheus 采集命令延迟、事件处理耗时、缓存命中率等指标，并以租户维度打标签。
- **告警策略**：当事件重试次数异常、缓存一致性任务失败、Saga 长时间未完成时，通过消息系统通知运维团队。
- **回放工具**：提供脚本按租户回放事件流，以支撑灾备与审计需求。

### 6. 补充说明

- **领域边界**：各子域通过**领域事件**或**仓储接口**通信，避免直接依赖；核心子域优先保障业务完整性，支撑子域优先保障通用性。
- **项目结构扩展性**：若后续新增业务（如“API 权限域”“数据权限域”），可在 `domains` 下新增子目录，无需调整整体结构。
- **团队协作**：领域团队内部采用“垂直开发”模式（从领域模型到接口实现），跨团队通过**事件契约**或**API 契约**协作，降低耦合。

这套方案在遵循 CASL + CQRS + ES + EDA 规范的同时，进一步明确了多租户上下文传递、能力缓存、事件补偿与审计策略，为企业级多租户认证授权平台提供可落地的工程实践指南。
