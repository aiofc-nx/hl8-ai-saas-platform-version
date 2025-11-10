您提出了一个很好的问题。我在上面的文档中确实**没有充分考虑到 CQRS、ES、EDA 的集成**。让我重新制定一个完整的基于 CASL + CQRS + ES + EDA 的多租户认证授权设计规范。

# 基于 CASL + CQRS + ES + EDA 的多租户认证授权全栈设计规范

## 📋 文档概述

本文档定义基于 CASL + NestJS + DDD + Clean Architecture + CQRS + ES + EDA 的完整多租户认证授权解决方案，确保事件驱动架构下的权限一致性。

## 🏗 架构总览

### 1.1 系统架构与数据流

```
┌─────────────────────────────────────────────────────────────┐
│              CQRS + ES + EDA 认证授权数据流                  │
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
│  │   Event     │    │  Handler    │    │   Update     │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         ↓                      ↓               ↓            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  Saga       │ →  │  Ability    │ →  │  Policy     │      │
│  │ (Orchestration) │  Rebuild     │    │  Sync       │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 领域层设计 (ES 集成)

### 2.1 事件溯源的权限聚合根

```typescript
// 用户权限聚合根 (事件溯源)
export class UserAuthorization extends EventSourcedAggregateRoot {
  private userId: UserId;
  private tenantId: TenantId;
  private roles: Map<string, TenantRole> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private status: AuthorizationStatus;
  private version: number = 0;

  constructor() {
    super();
  }

  // 从事件历史重建
  static reconstitute(events: DomainEvent[]): UserAuthorization {
    const aggregate = new UserAuthorization();
    aggregate.loadFromHistory(events);
    return aggregate;
  }

  // 分配角色命令
  assignRole(command: AssignRoleCommand): void {
    // 权限检查 - 只有管理员可以分配角色
    if (!this.canAssignRole(command.assignedBy, command.role)) {
      throw new AuthorizationError('无权分配该角色');
    }

    if (this.roles.has(command.role.name)) {
      return; // 已存在
    }

    this.apply(new RoleAssignedEvent(
      this.userId,
      this.tenantId,
      command.role,
      command.assignedBy,
      new Date()
    ));
  }

  // 撤销角色命令
  revokeRole(command: RevokeRoleCommand): void {
    if (!this.roles.has(command.roleName)) {
      return;
    }

    if (!this.canRevokeRole(command.revokedBy, command.roleName)) {
      throw new AuthorizationError('无权撤销该角色');
    }

    this.apply(new RoleRevokedEvent(
      this.userId,
      this.tenantId,
      command.roleName,
      command.revokedBy,
      new Date()
    ));
  }

  // 检查权限
  hasPermission(permission: Permission): boolean {
    // 检查直接权限
    if (this.permissions.has(permission.toString())) {
      return true;
    }

    // 检查角色权限
    for (const role of this.roles.values()) {
      if (role.hasPermission(permission)) {
        return true;
      }
    }

    return false;
  }

  // 转换为 CASL 规则
  toCaslRules(): RawRuleOf<AppAbility>[] {
    const rules: RawRuleOf<AppAbility>[] = [];

    // 基础规则
    rules.push({
      action: 'read',
      subject: 'Tenant',
      conditions: { id: this.tenantId.value }
    });

    // 角色规则
    for (const role of this.roles.values()) {
      rules.push(...role.toCaslRules(this.tenantId));
    }

    // 直接权限规则
    for (const permission of this.permissions.values()) {
      rules.push(permission.toCaslRule(this.tenantId));
    }

    return rules;
  }

  // 事件应用器
  private onRoleAssignedEvent(event: RoleAssignedEvent): void {
    this.roles.set(event.role.name, event.role);
    this.version++;
  }

  private onRoleRevokedEvent(event: RoleRevokedEvent): void {
    this.roles.delete(event.roleName);
    this.version++;
  }

  private onPermissionGrantedEvent(event: PermissionGrantedEvent): void {
    this.permissions.set(event.permission.toString(), event.permission);
    this.version++;
  }

  private onPermissionRevokedEvent(event: PermissionRevokedEvent): void {
    this.permissions.delete(event.permission.toString());
    this.version++;
  }
}
```

### 2.2 事件定义的权限领域事件

```typescript
// 权限相关领域事件
export class RoleAssignedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly role: TenantRole,
    public readonly assignedBy: UserId,
    public readonly assignedAt: Date
  ) {
    super(userId.value);
  }
}

export class RoleRevokedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly roleName: string,
    public readonly revokedBy: UserId,
    public readonly revokedAt: Date
  ) {
    super(userId.value);
  }
}

export class PermissionGrantedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly permission: Permission,
    public readonly grantedBy: UserId,
    public readonly grantedAt: Date
  ) {
    super(userId.value);
  }
}

export class AuthorizationStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly tenantId: TenantId,
    public readonly oldStatus: AuthorizationStatus,
    public readonly newStatus: AuthorizationStatus,
    public readonly changedBy: UserId,
    public readonly reason: string
  ) {
    super(userId.value);
  }
}
```

## 🚀 应用层设计 (CQRS 集成)

### 3.1 命令侧 - 带 CASL 验证的命令处理器

```typescript
// 基础 CASL 命令
export abstract class CaslCommand implements ICommand {
  constructor(
    public readonly securityContext: SecurityContext,
    public readonly commandId: string = ulid()
  ) {}
}

// 带权限验证的命令处理器基类
export abstract class CaslCommandHandler< TCommand extends CaslCommand> 
  implements ICommandHandler<TCommand> {
  
  constructor(
    protected readonly abilityService: CaslAbilityService,
    protected readonly eventStore: EventStore,
    protected readonly commandValidator: CommandValidator
  ) {}

  protected async validateCommandPermission(
    command: TCommand, 
    action: Action, 
    subject: AppSubject
  ): Promise<void> {
    const ability = await this.abilityService.getAbilityForUser(
      command.securityContext.userId,
      command.securityContext.tenantId
    );

    if (!ability.can(action, subject)) {
      throw new AuthorizationError(
        `无权执行命令: ${action} ${typeof subject === 'string' ? subject : subject.__typename}`
      );
    }
  }

  protected async loadAggregate<TAggregate extends EventSourcedAggregateRoot>(
    aggregateClass: new () => TAggregate,
    aggregateId: string
  ): Promise<TAggregate> {
    const events = await this.eventStore.getEvents(aggregateId);
    return aggregateClass.reconstitute(events);
  }

  protected async saveAggregate(
    aggregate: EventSourcedAggregateRoot
  ): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    await this.eventStore.saveEvents(aggregate.id, events, aggregate.version);
    aggregate.clearEvents();
  }
}

// 具体命令处理器 - 分配角色
@CommandHandler(AssignRoleCommand)
export class AssignRoleCommandHandler extends CaslCommandHandler<AssignRoleCommand> {
  constructor(
    abilityService: CaslAbilityService,
    eventStore: EventStore,
    commandValidator: CommandValidator,
    private readonly roleRepository: RoleRepository
  ) {
    super(abilityService, eventStore, commandValidator);
  }

  async execute(command: AssignRoleCommand): Promise<void> {
    // 1. 验证命令权限
    await this.validateCommandPermission(command, 'assign', 'Role');

    // 2. 加载用户权限聚合
    const userAuth = await this.loadAggregate(
      UserAuthorization,
      `user_auth_${command.userId.value}_${command.tenantId.value}`
    );

    // 3. 执行业务逻辑
    userAuth.assignRole(command);

    // 4. 保存事件
    await this.saveAggregate(userAuth);

    // 5. 发布领域事件到事件总线
    this.eventBus.publishAll(userAuth.getUncommittedEvents());
  }
}

// 创建订单命令处理器 (带复杂权限检查)
@CommandHandler(CreateOrderCommand)
export class CreateOrderCommandHandler extends CaslCommandHandler<CreateOrderCommand> {
  async execute(command: CreateOrderCommand): Promise<OrderResult> {
    const ability = await this.abilityService.getAbilityForUser(
      command.securityContext.userId,
      command.securityContext.tenantId
    );

    // 复杂权限检查 - 基于订单属性
    const orderSubject = {
      __typename: 'Order',
      totalAmount: command.totalAmount,
      productType: command.productType,
      customerTier: command.customerTier
    };

    if (!ability.can('create', orderSubject)) {
      throw new AuthorizationError('无权创建此类型订单');
    }

    // 加载订单聚合
    const order = Order.create(command);

    // 验证对创建后订单的权限
    if (!ability.can('read', order)) {
      throw new AuthorizationError('无权访问创建的订单');
    }

    // 保存事件
    await this.saveAggregate(order);

    return OrderResult.from(order);
  }
}
```

### 3.2 查询侧 - CASL 增强的查询处理器

```typescript
// CASL 查询基类
export abstract class CaslQuery implements IQuery {
  constructor(
    public readonly securityContext: SecurityContext,
    public readonly queryId: string = ulid()
  ) {}
}

// CASL 查询处理器基类
export abstract class CaslQueryHandler<TQuery extends CaslQuery, TResult> 
  implements IQueryHandler<TQuery, TResult> {
  
  constructor(
    protected readonly abilityService: CaslAbilityService,
    protected readonly caslFilter: CaslMikroORMFilter
  ) {}

  protected async applyCaslFilter<T>(
    query: TQuery,
    entityClass: EntityClass<T>,
    action: Action = 'read'
  ): Promise<FilterQuery<T>> {
    return this.caslFilter.addConditionsToQuery(
      entityClass,
      action,
      query.securityContext.userId,
      query.securityContext.tenantId
    );
  }

  protected async filterResults<T extends SubjectObject>(
    results: T[],
    query: TQuery,
    action: Action = 'read'
  ): Promise<T[]> {
    const ability = await this.abilityService.getAbilityForUser(
      query.securityContext.userId,
      query.securityContext.tenantId
    );

    return results.filter(result => ability.can(action, result));
  }
}

// 具体查询处理器 - 获取订单列表
@QueryHandler(GetOrdersQuery)
export class GetOrdersQueryHandler extends CaslQueryHandler<GetOrdersQuery, Order[]> {
  constructor(
    abilityService: CaslAbilityService,
    caslFilter: CaslMikroORMFilter,
    private readonly orderRepository: OrderRepository,
    private readonly orderProjection: OrderProjection
  ) {
    super(abilityService, caslFilter);
  }

  async execute(query: GetOrdersQuery): Promise<Order[]> {
    // 方法1: 使用读模型投影 (高性能)
    if (query.useProjection) {
      return this.executeWithProjection(query);
    }

    // 方法2: 使用 CASL 过滤查询 (实时权限)
    return this.executeWithCaslFilter(query);
  }

  private async executeWithProjection(query: GetOrdersQuery): Promise<Order[]> {
    // 从读模型获取数据
    const orders = await this.orderProjection.findByTenant(
      TenantId.create(query.securityContext.tenantId),
      query.filters
    );

    // 应用 CASL 过滤
    return this.filterResults(orders, query, 'read');
  }

  private async executeWithCaslFilter(query: GetOrdersQuery): Promise<Order[]> {
    // 生成 CASL 过滤条件
    const caslConditions = await this.applyCaslFilter(
      query,
      Order,
      'read'
    );

    // 执行查询
    return this.orderRepository.findByTenant(
      TenantId.create(query.securityContext.tenantId),
      {
        ...query.filters,
        ...caslConditions
      },
      query.pagination
    );
  }
}
```

## 🔄 事件驱动架构 (EDA 集成)

### 4.1 权限相关事件处理器

```typescript
// 权限缓存更新事件处理器
@EventHandler(RoleAssignedEvent)
export class RoleAssignedEventHandler implements IEventHandler<RoleAssignedEvent> {
  constructor(
    private readonly abilityService: CaslAbilityService,
    private readonly cacheService: CacheService,
    private readonly logger: Logger
  ) {}

  async handle(event: RoleAssignedEvent): Promise<void> {
    try {
      // 清除用户能力缓存
      await this.abilityService.clearUserCache(
        event.userId.value,
        event.tenantId.value
      );

      // 更新用户权限投影
      await this.updateUserPermissionProjection(event);

      // 发布权限变更通知事件
      await this.eventBus.publish(new PermissionChangedEvent(
        event.userId,
        event.tenantId,
        'role_assigned',
        { role: event.role.name }
      ));

      this.logger.log(`Role assigned event processed for user ${event.userId.value}`);

    } catch (error) {
      this.logger.error(`Failed to process role assigned event: ${error.message}`, error.stack);
      // 重试机制或死信队列处理
    }
  }

  private async updateUserPermissionProjection(event: RoleAssignedEvent): Promise<void> {
    // 更新读模型的用户权限数据
    await this.userPermissionProjection.updateUserRoles(
      event.userId,
      event.tenantId,
      event.role
    );
  }
}

// 权限变更 Saga (复杂业务流程)
@Injectable()
export class PermissionChangeSaga extends Saga {
  private readonly logger = new Logger(PermissionChangeSaga.name);

  @SagaEventHandler(RoleAssignedEvent)
  async onRoleAssigned(event: RoleAssignedEvent): Promise<void> {
    // 开始 Saga
    const sagaId = `permission_change_${event.userId.value}_${event.tenantId.value}`;
    
    try {
      // 1. 验证角色分配是否有效
      await this.validateRoleAssignment(event);

      // 2. 更新所有相关系统
      await this.updateRelatedSystems(event);

      // 3. 发送通知
      await this.sendNotifications(event);

      // 4. 记录审计日志
      await this.recordAuditLog(event);

      // Saga 完成
      await this.eventBus.publish(new PermissionChangeCompletedEvent(
        event.userId,
        event.tenantId,
        sagaId
      ));

    } catch (error) {
      // Saga 失败，触发补偿操作
      await this.eventBus.publish(new PermissionChangeFailedEvent(
        event.userId,
        event.tenantId,
        sagaId,
        error.message
      ));
    }
  }

  private async validateRoleAssignment(event: RoleAssignedEvent): Promise<void> {
    // 检查角色是否存在且有效
    const role = await this.roleRepository.findByName(event.role.name);
    if (!role) {
      throw new Error(`角色 ${event.role.name} 不存在`);
    }

    // 检查分配者权限
    const assignerAbility = await this.abilityService.getAbilityForUser(
      event.assignedBy.value,
      event.tenantId.value
    );

    if (!assignerAbility.can('assign', role)) {
      throw new AuthorizationError('分配者无权分配该角色');
    }
  }

  private async updateRelatedSystems(event: RoleAssignedEvent): Promise<void> {
    // 并行更新所有相关系统
    await Promise.all([
      this.updateUserPermissionProjection(event),
      this.updateAccessControlLists(event),
      this.updateApiGatewayPolicies(event),
      this.updateReportingSystems(event)
    ]);
  }
}

// 能力重建事件处理器
@EventHandler(PermissionChangedEvent)
export class PermissionChangedEventHandler implements IEventHandler<PermissionChangedEvent> {
  constructor(
    private readonly abilityService: CaslAbilityService,
    private readonly abilityProjection: AbilityProjection
  ) {}

  async handle(event: PermissionChangedEvent): Promise<void> {
    // 异步重建用户能力
    await this.abilityProjection.rebuildUserAbility(
      event.userId,
      event.tenantId
    );

    // 预加载能力到缓存
    await this.abilityService.getAbilityForUser(
      event.userId.value,
      event.tenantId.value
    );
  }
}
```

### 4.2 读模型投影 (Projections)

```typescript
// 用户权限投影
@Injectable()
export class UserPermissionProjection {
  constructor(
    private readonly em: EntityManager,
    private readonly eventStore: EventStore
  ) {}

  // 从事件流构建用户权限投影
  @ProjectionHandler(RoleAssignedEvent)
  async onRoleAssigned(event: RoleAssignedEvent): Promise<void> {
    const userPermission = await this.getOrCreateUserPermission(
      event.userId,
      event.tenantId
    );

    userPermission.addRole(event.role);
    userPermission.version = event.version;

    await this.em.persistAndFlush(userPermission);
  }

  @ProjectionHandler(RoleRevokedEvent)
  async onRoleRevoked(event: RoleRevokedEvent): Promise<void> {
    const userPermission = await this.getUserPermission(
      event.userId,
      event.tenantId
    );

    if (userPermission) {
      userPermission.removeRole(event.roleName);
      userPermission.version = event.version;
      await this.em.persistAndFlush(userPermission);
    }
  }

  // 重建投影
  async rebuildUserPermission(userId: UserId, tenantId: TenantId): Promise<void> {
    const events = await this.eventStore.getEvents(
      `user_auth_${userId.value}_${tenantId.value}`
    );

    // 清除现有投影
    await this.em.nativeDelete(UserPermissionEntity, {
      userId: userId.value,
      tenantId: tenantId.value
    });

    // 重新应用事件
    for (const event of events) {
      await this.applyEvent(event);
    }
  }

  // 查询方法
  async getUserPermissions(userId: UserId, tenantId: TenantId): Promise<UserPermissionEntity> {
    return this.em.findOne(UserPermissionEntity, {
      userId: userId.value,
      tenantId: tenantId.value
    });
  }

  async getUserAbilities(userId: UserId, tenantId: TenantId): Promise<RawRuleOf<AppAbility>[]> {
    const permission = await this.getUserPermissions(userId, tenantId);
    return permission ? permission.toCaslRules() : [];
  }
}

// CASL 能力投影
@Injectable()
export class AbilityProjection {
  constructor(
    private readonly abilityService: CaslAbilityService,
    private readonly userPermissionProjection: UserPermissionProjection
  ) {}

  // 预计算用户能力
  async rebuildUserAbility(userId: UserId, tenantId: TenantId): Promise<void> {
    const rules = await this.userPermissionProjection.getUserAbilities(userId, tenantId);
    
    // 预加载到缓存
    const ability = createMongoAbility<AppAbility>(rules);
    const cacheKey = `${userId.value}:${tenantId.value}`;
    
    // 这里可以存储到 Redis 或其他缓存
    await this.cacheService.set(`casl:ability:${cacheKey}`, rules, 3600); // 1小时
  }

  // 批量预计算
  async rebuildTenantAbilities(tenantId: TenantId): Promise<void> {
    const userPermissions = await this.userPermissionProjection.getTenantUserPermissions(tenantId);
    
    const batchSize = 100;
    for (let i = 0; i < userPermissions.length; i += batchSize) {
      const batch = userPermissions.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(permission => 
          this.rebuildUserAbility(
            UserId.create(permission.userId), 
            TenantId.create(permission.tenantId)
          )
        )
      );
    }
  }
}
```

## 🛡 基础设施层设计

### 5.1 事件存储集成

```typescript
// 事件存储的 CASL 能力工厂
@Injectable()
export class EventSourcedCaslAbilityFactory extends DomainCaslAbilityFactory {
  constructor(
    private readonly eventStore: EventStore,
    private readonly userAuthProjection: UserPermissionProjection
  ) {
    super(/* 依赖注入 */);
  }

  async createForUser(user: User, tenant: Tenant): Promise<AppAbility> {
    // 方法1: 从投影读取 (高性能)
    try {
      const rules = await this.userAuthProjection.getUserAbilities(user.id, tenant.id);
      if (rules.length > 0) {
        return createMongoAbility<AppAbility>(rules);
      }
    } catch (error) {
      // 投影未就绪，回退到事件溯源
    }

    // 方法2: 从事件流重建 (强一致性)
    return this.createFromEventStream(user, tenant);
  }

  private async createFromEventStream(user: User, tenant: Tenant): Promise<AppAbility> {
    const events = await this.eventStore.getEvents(
      `user_auth_${user.id.value}_${tenant.id.value}`
    );

    if (events.length === 0) {
      // 初始权限
      return createMongoAbility<AppAbility>([{
        action: 'read',
        subject: 'Tenant',
        conditions: { id: tenant.id.value }
      }]);
    }

    // 从事件重建聚合
    const userAuth = UserAuthorization.reconstitute(events);
    const rules = userAuth.toCaslRules();

    return createMongoAbility<AppAbility>(rules);
  }
}
```

### 5.2 消息总线集成

```typescript
// 权限事件发布器
@Injectable()
export class PermissionEventPublisher {
  constructor(
    private readonly eventBus: EventBus,
    private readonly messageBroker: MessageBroker
  ) {}

  async publishPermissionEvents(events: DomainEvent[]): Promise<void> {
    // 发布到内部事件总线
    this.eventBus.publishAll(events);

    // 发布到消息队列 (用于外部系统)
    for (const event of events) {
      await this.messageBroker.publish('permission.events', {
        type: event.constructor.name,
        data: event,
        timestamp: new Date(),
        metadata: {
          eventId: event.eventId,
          aggregateId: event.aggregateId
        }
      });
    }
  }

  // 发布权限变更通知
  async publishPermissionChange(
    userId: UserId,
    tenantId: TenantId,
    changeType: string,
    details: any
  ): Promise<void> {
    const event = new PermissionChangedEvent(userId, tenantId, changeType, details);
    
    await this.messageBroker.publish('permission.changes', {
      event,
      recipients: this.getNotificationRecipients(userId, tenantId)
    });
  }
}
```

## 🌐 接口层设计 (CQRS 适配)

### 6.1 CQRS 风格的控制器

```typescript
// 命令控制器
@Controller('commands')
@UseGuards(MultiTenantAuthGuard, CaslGuard)
export class CommandController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly abilityService: CaslAbilityService
  ) {}

  @Post('roles/assign')
  @CheckPolicies('assign', 'Role')
  async assignRole(
    @SecurityContext() context: SecurityContext,
    @Body() assignRoleDto: AssignRoleRequestDto
  ): Promise<ApiResponse<void>> {
    const command = new AssignRoleCommand({
      userId: UserId.create(assignRoleDto.userId),
      tenantId: TenantId.create(context.tenantId),
      role: await this.roleRepository.findByName(assignRoleDto.roleName),
      assignedBy: UserId.create(context.userId)
    }, context);

    await this.commandBus.execute(command);

    return ApiResponse.empty('角色分配成功');
  }

  @Post('orders')
  @CheckPolicies('create', 'Order')
  async createOrder(
    @SecurityContext() context: SecurityContext,
    @Body() createOrderDto: CreateOrderRequestDto
  ): Promise<ApiResponse<OrderResponseDto>> {
    const command = new CreateOrderCommand(createOrderDto, context);
    const result = await this.commandBus.execute(command);

    return ApiResponse.success(result, '订单创建成功');
  }
}

// 查询控制器
@Controller('queries')
@UseGuards(MultiTenantAuthGuard, CaslGuard)
export class QueryController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('orders')
  @CheckPolicies('read', 'Order')
  async getOrders(
    @SecurityContext() context: SecurityContext,
    @Query() queryDto: OrderQueryRequestDto
  ): Promise<ApiResponse<PaginatedResponse<OrderResponseDto>>> {
    const query = new GetOrdersQuery(queryDto, context);
    const orders = await this.queryBus.execute(query);

    return ApiResponse.paginated(
      orders.map(order => this.toOrderResponseDto(order)),
      queryDto.pagination
    );
  }

  @Get('users/:id/permissions')
  @CheckPolicies('read', 'UserPermission')
  async getUserPermissions(
    @SecurityContext() context: SecurityContext,
    @Param('id') userId: string
  ): Promise<ApiResponse<UserPermissionResponseDto>> {
    const query = new GetUserPermissionQuery(
      UserId.create(userId),
      TenantId.create(context.tenantId),
      context
    );

    const permissions = await this.queryBus.execute(query);
    return ApiResponse.success(this.toPermissionResponseDto(permissions));
  }
}

// 事件订阅控制器
@Controller('events')
@UseGuards(MultiTenantAuthGuard, CaslGuard)
export class EventController {
  constructor(private readonly eventBus: EventBus) {}

  @Post('permissions/rebuild')
  @CheckPolicies('manage', 'PermissionSystem')
  async rebuildPermissions(
    @SecurityContext() context: SecurityContext,
    @Body() rebuildDto: RebuildPermissionsRequestDto
  ): Promise<ApiResponse<void>> {
    const event = new PermissionsRebuildRequestedEvent(
      TenantId.create(context.tenantId),
      UserId.create(context.userId),
      rebuildDto.scope
    );

    await this.eventBus.publish(event);

    return ApiResponse.empty('权限重建任务已提交');
  }
}
```

## 🔧 配置和模块

### 7.1 CQRS + ES + EDA 模块配置

```typescript
@Module({
  imports: [
    CqrsModule,
    EventStoreModule.forRoot(),
    EventBusModule.forRoot(),
    // CASL 模块
    CaslModule,
  ],
  providers: [
    // 命令处理器
    AssignRoleCommandHandler,
    CreateOrderCommandHandler,
    RevokeRoleCommandHandler,

    // 查询处理器  
    GetOrdersQueryHandler,
    GetUserPermissionQueryHandler,

    // 事件处理器
    RoleAssignedEventHandler,
    PermissionChangedEventHandler,
    PermissionChangeSaga,

    // 投影
    UserPermissionProjection,
    AbilityProjection,

    // Saga
    {
      provide: 'PermissionChangeSaga',
      useClass: PermissionChangeSaga
    }
  ],
  exports: [
    CaslAbilityService,
    EventStore,
    EventBus
  ]
})
export class AuthorizationCqrsModule {}

// 事件存储配置
@Module({
  imports: [
    MikroOrmModule.forFeature([
      UserAuthorizationEntity,
      UserPermissionEntity,
      EventEntity
    ])
  ],
  providers: [
    {
      provide: EventStore,
      useClass: MikroORMEventStore
    }
  ]
})
export class EventStoreModule {}
```

## ✅ 总结

### 8.1 CQRS + ES + EDA 集成优势

1. **强一致性**: 事件溯源确保权限状态的准确重建
2. **最终一致性**: 读模型提供高性能查询
3. **事件驱动**: 权限变更自动触发相关业务流程
4. **可追溯性**: 完整的事件日志支持审计和调试

### 8.2 架构特点

- **命令查询分离**: 清晰的读写职责分离
- **事件溯源**: 完整的权限变更历史
- **Saga 模式**: 复杂的权限变更业务流程
- **投影模式**: 高性能的权限查询
- **消息驱动**: 松耦合的系统集成

### 8.3 性能考虑

- **缓存策略**: 多级能力缓存
- **批量处理**: 事件批量处理
- **异步投影**: 后台权限投影更新
- **预计算**: 能力预加载和缓存

这套设计为企业级多租户应用提供了强大、一致且高性能的权限管理解决方案，完美融合了 CASL、CQRS、ES 和 EDA 的优势。

---
*文档版本: 4.0 | 最后更新: 2024-11-XX | 特性: CASL + CQRS + ES + EDA 完整集成*