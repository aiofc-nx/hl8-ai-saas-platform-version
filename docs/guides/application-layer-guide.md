# 应用层设计规范 (多租户增强版)

## 📋 文档概述

本文档在原有应用层设计规范基础上，增加多租户和数据隔离支持。所有应用层用例都需要显式处理租户上下文，确保业务流程的租户隔离和安全。

## 🎯 核心设计理念

### 1.1 多租户应用层定位

**应用层用例**是整个系统的**多租户业务流程协调中枢**，在六边形架构中负责：
- 协调跨聚合的多租户业务流程
- 维护租户数据隔离边界
- 处理租户特定的业务规则
- 管理租户间的事件驱动协作

### 1.2 多租户核心原则

- **租户上下文显式传递**: 所有命令/查询必须包含租户上下文
- **自动租户过滤**: 查询自动应用租户隔离条件
- **跨租户权限控制**: 严格验证跨租户操作权限
- **租户特定业务逻辑**: 支持租户自定义的业务规则

## 🏗 多租户架构实现规范

### 2.1 多租户技术实现形式

在 NestJS CQRS + 多租户架构中，用例以增强形式实现：

| 用例类型 | 多租户实现形式 | 职责说明 | 示例 |
|---------|----------------|----------|------|
| **命令用例** | `MultiTenantCommandHandler` | 处理状态变更，验证租户权限 | `CreateOrganizationHandler` |
| **查询用例** | `MultiTenantQueryHandler` | 处理数据查询，自动租户过滤 | `GetOrganizationTreeHandler` |
| **事件用例** | `MultiTenantEventHandler` | 响应领域事件，处理租户上下文 | `UserJoinedOrganizationHandler` |
| **Saga用例** | `MultiTenantSaga` | 协调跨租户业务流程 | `OrganizationProvisioningSaga` |

### 2.2 多租户代码结构标准

```
src/
├── tenant/
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── create-tenant/
│   │   │   │   ├── create-tenant.command.ts
│   │   │   │   ├── create-tenant.handler.ts
│   │   │   │   └── __tests__/
│   │   │   ├── update-tenant-config/
│   │   │   └── manage-tenant-subscription/
│   │   └── ports/
│   ├── domain/
│   └── infrastructure/
├── organization/
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── create-organization/
│   │   │   ├── manage-departments/
│   │   │   └── invite-members/
│   │   └── ports/
├── authorization/
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── assign-roles/
│   │   │   ├── check-permissions/
│   │   │   └── manage-policies/
│   │   └── ports/
└── shared/
    └── application/
        ├── multi-tenant/
        │   ├── commands/           # 多租户命令基类
        │   ├── queries/            # 多租户查询基类  
        │   ├── handlers/           # 多租户处理器基类
        │   └── context/            # 租户上下文管理
        └── security/
            ├── casl/               # CASL 能力服务
            └── guards/             # 多租户守卫
```

## 💻 多租户技术实现模式

### 3.1 多租户命令和查询基类

```typescript
// 多租户命令基类
export abstract class MultiTenantCommand implements ICommand {
  public readonly commandId: string;
  public readonly securityContext: SecurityContext;

  constructor(securityContext: SecurityContext, commandId?: string) {
    this.securityContext = securityContext;
    this.commandId = commandId || ulid();
    
    this.validateTenantContext();
  }

  protected validateTenantContext(): void {
    if (!this.securityContext.tenantId) {
      throw new MissingTenantContextError('命令缺少租户上下文');
    }
  }

  public get tenantId(): TenantId {
    return TenantId.create(this.securityContext.tenantId);
  }

  public get userId(): UserId {
    return UserId.create(this.securityContext.userId);
  }
}

// 多租户查询基类
export abstract class MultiTenantQuery<TResult> implements IQuery<TResult> {
  public readonly queryId: string;
  public readonly securityContext: SecurityContext;

  constructor(securityContext: SecurityContext, queryId?: string) {
    this.securityContext = securityContext;
    this.queryId = queryId || ulid();
    
    this.validateTenantContext();
  }

  protected validateTenantContext(): void {
    if (!this.securityContext.tenantId) {
      throw new MissingTenantContextError('查询缺少租户上下文');
    }
  }

  public get tenantId(): TenantId {
    return TenantId.create(this.securityContext.tenantId);
  }
}
```

### 3.2 多租户命令处理器基类

```typescript
// 多租户命令处理器基类
export abstract class MultiTenantCommandHandler<TCommand extends MultiTenantCommand>
  implements ICommandHandler<TCommand> {
  
  constructor(
    protected readonly abilityService: CaslAbilityService,
    protected readonly tenantRepository: TenantRepository,
    protected readonly eventStore: EventStore,
    protected readonly auditService: AuditService
  ) {}

  // 租户权限验证
  protected async validateTenantPermission(
    command: TCommand,
    action: Action,
    subject: AppSubject
  ): Promise<void> {
    const ability = await this.abilityService.getAbilityForUser(
      command.securityContext.userId,
      command.securityContext.tenantId
    );

    if (!ability.can(action, subject)) {
      await this.auditService.recordPermissionDenied(
        command.securityContext,
        action,
        subject,
        '租户权限验证失败'
      );
      throw new AuthorizationError(`无权执行操作: ${action}`);
    }
  }

  // 租户状态验证
  protected async validateTenantStatus(command: TCommand): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(command.tenantId);
    
    if (!tenant) {
      throw new TenantNotFoundError('租户不存在');
    }

    if (!tenant.isActive()) {
      throw new TenantInactiveError('租户未激活');
    }

    return tenant;
  }

  // 加载多租户聚合根
  protected async loadMultiTenantAggregate<TAggregate extends MultiTenantAggregateRoot>(
    aggregateClass: new (...args: any[]) => TAggregate,
    aggregateId: string,
    tenantId: TenantId
  ): Promise<TAggregate> {
    const events = await this.eventStore.getEvents(aggregateId);
    
    if (events.length === 0) {
      throw new AggregateNotFoundError(`聚合根 ${aggregateId} 未找到`);
    }

    const aggregate = aggregateClass.reconstitute(events);
    
    // 验证租户一致性
    if (!aggregate.isInTenant(tenantId)) {
      throw new CrossTenantAccessError('跨租户访问被禁止');
    }

    return aggregate;
  }

  // 保存多租户聚合根
  protected async saveMultiTenantAggregate(
    aggregate: MultiTenantAggregateRoot
  ): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    
    // 记录审计日志
    await this.auditService.recordAggregateChanges(
      aggregate.constructor.name,
      aggregate.id.value,
      aggregate.tenantId.value,
      events.length
    );

    await this.eventStore.saveEvents(aggregate.id.value, events, aggregate.version);
    aggregate.clearEvents();
  }

  // 发布多租户领域事件
  protected async publishMultiTenantEvents(events: MultiTenantDomainEvent[]): Promise<void> {
    for (const event of events) {
      // 验证事件租户一致性
      if (!(event instanceof MultiTenantDomainEvent)) {
        throw new InvalidDomainEventError('领域事件必须包含租户上下文');
      }
      
      await this.eventBus.publish(event);
    }
  }
}
```

### 3.3 多租户查询处理器基类

```typescript
// 多租户查询处理器基类
export abstract class MultiTenantQueryHandler<TQuery extends MultiTenantQuery<TResult>, TResult>
  implements IQueryHandler<TQuery, TResult> {
  
  constructor(
    protected readonly abilityService: CaslAbilityService,
    protected readonly caslFilter: CaslMikroORMFilter,
    protected readonly tenantRepository: TenantRepository
  ) {}

  // 应用 CASL 租户过滤
  protected async applyTenantFilter<T>(
    query: TQuery,
    entityClass: EntityClass<T>,
    action: Action = 'read'
  ): Promise<FilterQuery<T>> {
    const caslConditions = await this.caslFilter.addConditionsToQuery(
      entityClass,
      action,
      query.securityContext.userId,
      query.securityContext.tenantId
    );

    // 确保包含租户过滤条件
    const tenantCondition = { tenantId: query.tenantId.value };
    
    return {
      $and: [tenantCondition, caslConditions]
    } as FilterQuery<T>;
  }

  // 验证查询权限
  protected async validateQueryPermission(
    query: TQuery,
    action: Action,
    subject: AppSubject
  ): Promise<void> {
    const ability = await this.abilityService.getAbilityForUser(
      query.securityContext.userId,
      query.securityContext.tenantId
    );

    if (!ability.can(action, subject)) {
      throw new AuthorizationError(`无权执行查询: ${action}`);
    }
  }

  // 过滤查询结果 (基于租户权限)
  protected async filterResultsByTenantPermission<T extends SubjectObject>(
    results: T[],
    query: TQuery,
    action: Action = 'read'
  ): Promise<T[]> {
    const ability = await this.abilityService.getAbilityForUser(
      query.securityContext.userId,
      query.securityContext.tenantId
    );

    return results.filter(result => {
      // 确保结果属于当前租户
      if (isMultiTenantEntity(result) && !result.tenantId.equals(query.tenantId)) {
        return false;
      }
      return ability.can(action, result);
    });
  }

  // 检查租户访问权限
  protected async checkTenantAccess(query: TQuery): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(query.tenantId);
    
    if (!tenant) {
      throw new TenantNotFoundError('租户不存在');
    }

    if (!tenant.isActive()) {
      throw new TenantInactiveError('租户未激活');
    }

    return tenant;
  }
}

// 多租户实体类型检查
function isMultiTenantEntity(obj: any): obj is { tenantId: TenantId } {
  return obj && obj.tenantId instanceof TenantId;
}
```

### 3.4 具体多租户命令处理器实现

```typescript
// 创建组织命令
export class CreateOrganizationCommand extends MultiTenantCommand {
  constructor(
    public readonly name: string,
    public readonly code: string,
    public readonly description: string,
    securityContext: SecurityContext
  ) {
    super(securityContext);
  }
}

// 创建组织命令处理器
@CommandHandler(CreateOrganizationCommand)
export class CreateOrganizationHandler extends MultiTenantCommandHandler<CreateOrganizationCommand> {
  constructor(
    abilityService: CaslAbilityService,
    tenantRepository: TenantRepository,
    eventStore: EventStore,
    auditService: AuditService,
    private readonly organizationRepository: OrganizationRepository
  ) {
    super(abilityService, tenantRepository, eventStore, auditService);
  }

  async execute(command: CreateOrganizationCommand): Promise<OrganizationId> {
    // 1. 验证租户状态
    const tenant = await this.validateTenantStatus(command);

    // 2. 验证创建组织权限
    await this.validateTenantPermission(command, 'create', 'Organization');

    // 3. 创建组织聚合根
    const organization = Organization.create({
      tenantId: command.tenantId,
      name: command.name,
      code: command.code,
      description: command.description
    });

    // 4. 保存聚合根
    await this.saveMultiTenantAggregate(organization);

    // 5. 发布领域事件
    await this.publishMultiTenantEvents(organization.getUncommittedEvents());

    // 6. 记录审计日志
    await this.auditService.recordOrganizationCreated(
      command.securityContext,
      organization.id
    );

    return organization.id;
  }
}

// 创建部门命令处理器
@CommandHandler(CreateDepartmentCommand)
export class CreateDepartmentHandler extends MultiTenantCommandHandler<CreateDepartmentCommand> {
  async execute(command: CreateDepartmentCommand): Promise<DepartmentId> {
    // 验证租户状态
    await this.validateTenantStatus(command);

    // 验证组织访问权限
    const organization = await this.organizationRepository.findById(
      command.organizationId,
      command.tenantId
    );
    
    if (!organization) {
      throw new OrganizationNotFoundError('组织不存在');
    }

    // 验证创建部门权限
    await this.validateTenantPermission(command, 'create', {
      __typename: 'Department',
      organizationId: command.organizationId.value
    });

    // 创建部门
    const department = organization.createDepartment({
      name: command.name,
      code: command.code,
      parentId: command.parentDepartmentId,
      tenantId: command.tenantId,
      organizationId: command.organizationId
    });

    // 保存部门
    await this.departmentRepository.save(department);

    // 发布事件
    await this.publishMultiTenantEvents(department.getUncommittedEvents());

    return department.id;
  }
}
```

### 3.5 具体多租户查询处理器实现

```typescript
// 获取组织树查询
export class GetOrganizationTreeQuery extends MultiTenantQuery<OrganizationTree> {
  constructor(
    public readonly organizationId: OrganizationId,
    securityContext: SecurityContext
  ) {
    super(securityContext);
  }
}

// 获取组织树查询处理器
@QueryHandler(GetOrganizationTreeQuery)
export class GetOrganizationTreeHandler 
  extends MultiTenantQueryHandler<GetOrganizationTreeQuery, OrganizationTree> {
  
  constructor(
    abilityService: CaslAbilityService,
    caslFilter: CaslMikroORMFilter,
    tenantRepository: TenantRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly departmentRepository: DepartmentRepository
  ) {
    super(abilityService, caslFilter, tenantRepository);
  }

  async execute(query: GetOrganizationTreeQuery): Promise<OrganizationTree> {
    // 1. 验证租户访问权限
    await this.checkTenantAccess(query);

    // 2. 验证组织读取权限
    await this.validateQueryPermission(query, 'read', {
      __typename: 'Organization',
      id: query.organizationId.value
    });

    // 3. 获取组织信息
    const organization = await this.organizationRepository.findById(
      query.organizationId,
      query.tenantId
    );

    if (!organization) {
      throw new OrganizationNotFoundError('组织不存在');
    }

    // 4. 获取部门树 (自动应用租户过滤)
    const departments = await this.departmentRepository.findByOrganization(
      query.organizationId,
      query.tenantId
    );

    // 5. 构建组织树
    const organizationTree = this.buildOrganizationTree(organization, departments);

    // 6. 应用权限过滤
    return this.filterOrganizationTreeByPermission(organizationTree, query);
  }

  private buildOrganizationTree(
    organization: Organization,
    departments: Department[]
  ): OrganizationTree {
    // 构建组织-部门树形结构
    const departmentMap = new Map(departments.map(dept => [dept.id.value, dept]));
    const rootDepartments = departments.filter(dept => dept.level === 0);

    const buildDepartmentNode = (department: Department): DepartmentTreeNode => {
      const children = departments.filter(dept => 
        dept.parentDepartmentId?.equals(department.id)
      );

      return {
        department,
        children: children.map(buildDepartmentNode)
      };
    };

    return {
      organization,
      rootDepartments: rootDepartments.map(buildDepartmentNode)
    };
  }

  private async filterOrganizationTreeByPermission(
    tree: OrganizationTree,
    query: GetOrganizationTreeQuery
  ): Promise<OrganizationTree> {
    const ability = await this.abilityService.getAbilityForUser(
      query.securityContext.userId,
      query.securityContext.tenantId
    );

    const filterDepartmentNode = (node: DepartmentTreeNode): DepartmentTreeNode | null => {
      if (!ability.can('read', node.department)) {
        return null;
      }

      const filteredChildren = node.children
        .map(filterDepartmentNode)
        .filter((child): child is DepartmentTreeNode => child !== null);

      return {
        ...node,
        children: filteredChildren
      };
    };

    return {
      ...tree,
      rootDepartments: tree.rootDepartments
        .map(filterDepartmentNode)
        .filter((node): node is DepartmentTreeNode => node !== null)
    };
  }
}

// 获取用户数据权限范围查询
@QueryHandler(GetUserDataScopesQuery)
export class GetUserDataScopesHandler 
  extends MultiTenantQueryHandler<GetUserDataScopesQuery, DataScope[]> {
  
  async execute(query: GetUserDataScopesQuery): Promise<DataScope[]> {
    // 加载用户组织权限聚合
    const userAuth = await this.loadMultiTenantAggregate(
      UserOrganizationAuthorization,
      `user_org_auth_${query.userId.value}_${query.tenantId.value}`,
      query.tenantId
    );

    // 获取数据权限范围 (自动包含租户过滤)
    return userAuth.getDataScopes().filter(scope => 
      scope.tenantId.equals(query.tenantId)
    );
  }
}
```

### 3.6 多租户事件处理器实现

```typescript
// 用户加入组织事件处理器
@EventHandler(UserJoinedOrganizationEvent)
export class UserJoinedOrganizationHandler 
  implements IEventHandler<UserJoinedOrganizationEvent> {
  
  constructor(
    private readonly abilityService: CaslAbilityService,
    private readonly userOrganizationProjection: UserOrganizationProjection,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService
  ) {}

  async handle(event: UserJoinedOrganizationEvent): Promise<void> {
    try {
      // 1. 更新用户组织权限投影
      await this.userOrganizationProjection.addUserToOrganization(
        event.userId,
        event.organizationId,
        event.tenantId,
        event.roles
      );

      // 2. 清除用户能力缓存 (租户特定)
      await this.abilityService.clearUserCache(
        event.userId.value,
        event.tenantId.value
      );

      // 3. 发送租户特定的通知
      await this.notificationService.sendOrganizationJoinNotification(
        event.userId,
        event.organizationId,
        event.tenantId,
        event.joinedBy
      );

      // 4. 记录审计日志
      await this.auditService.recordUserJoinedOrganization(
        event.userId,
        event.organizationId,
        event.tenantId,
        event.joinedBy
      );

    } catch (error) {
      // 租户特定错误处理
      await this.auditService.recordEventHandlerFailed(
        'UserJoinedOrganizationHandler',
        event.tenantId.value,
        error
      );
      throw error;
    }
  }
}

// 部门移动事件处理器
@EventHandler(DepartmentMovedEvent)
export class DepartmentMovedEventHandler 
  implements IEventHandler<DepartmentMovedEvent> {
  
  async handle(event: DepartmentMovedEvent): Promise<void> {
    // 更新部门树投影 (租户特定)
    await this.departmentTreeProjection.updateDepartmentPath(
      event.departmentId,
      event.tenantId,
      event.oldPath,
      event.newPath
    );

    // 更新受影响用户的权限缓存
    const affectedUsers = await this.getUsersInDepartmentTree(
      event.departmentId,
      event.tenantId
    );

    await Promise.all(
      affectedUsers.map(user => 
        this.abilityService.clearUserCache(user.id.value, event.tenantId.value)
      )
    );
  }

  private async getUsersInDepartmentTree(
    departmentId: DepartmentId,
    tenantId: TenantId
  ): Promise<User[]> {
    // 获取部门树中的所有用户 (租户过滤)
    return this.userDepartmentRepository.findUsersInDepartmentTree(
      departmentId,
      tenantId
    );
  }
}
```

### 3.7 多租户 Saga 实现

```typescript
// 组织配置 Saga
@Injectable()
export class OrganizationProvisioningSaga extends Saga {
  @SagaEventHandler(OrganizationCreatedEvent)
  async onOrganizationCreated(event: OrganizationCreatedEvent): Promise<void> {
    const sagaId = `org_provisioning_${event.organizationId.value}_${event.tenantId.value}`;

    try {
      // 1. 创建默认部门结构
      await this.createDefaultDepartments(event.organizationId, event.tenantId);

      // 2. 配置默认权限策略
      await this.setupDefaultPolicies(event.organizationId, event.tenantId);

      // 3. 初始化组织设置
      await this.initializeOrganizationSettings(event.organizationId, event.tenantId);

      // Saga 完成
      await this.eventBus.publish(new OrganizationProvisioningCompletedEvent(
        event.organizationId,
        event.tenantId,
        sagaId
      ));

    } catch (error) {
      // 补偿操作
      await this.eventBus.publish(new OrganizationProvisioningFailedEvent(
        event.organizationId,
        event.tenantId,
        sagaId,
        error.message
      ));
    }
  }

  private async createDefaultDepartments(
    organizationId: OrganizationId,
    tenantId: TenantId
  ): Promise<void> {
    const defaultDepartments = [
      { name: '管理部门', code: 'MANAGEMENT' },
      { name: '技术部门', code: 'TECHNOLOGY' },
      { name: '运营部门', code: 'OPERATIONS' }
    ];

    for (const dept of defaultDepartments) {
      const command = new CreateDepartmentCommand({
        organizationId,
        name: dept.name,
        code: dept.code,
        tenantId
      }, this.getSystemSecurityContext(tenantId));

      await this.commandBus.execute(command);
    }
  }

  private getSystemSecurityContext(tenantId: TenantId): SecurityContext {
    return {
      userId: 'system',
      tenantId: tenantId.value,
      roles: ['SYSTEM_ADMIN'],
      permissions: ['*']
    };
  }
}
```

## 🧪 多租户测试策略

### 4.1 多租户业务场景测试

```typescript
describe('CreateOrganizationHandler (Multi-tenant)', () => {
  let handler: CreateOrganizationHandler;
  let mockTenantRepo: MockTenantRepository;
  let mockAbilityService: MockCaslAbilityService;

  beforeEach(() => {
    mockTenantRepo = new MockTenantRepository();
    mockAbilityService = new MockCaslAbilityService();
    
    handler = new CreateOrganizationHandler(
      mockAbilityService,
      mockTenantRepo,
      mockEventStore,
      mockAuditService,
      mockOrganizationRepo
    );
  });

  it('应该成功创建属于指定租户的组织', async () => {
    // Given
    const tenant = Tenant.create({ name: '测试租户', subdomain: 'test' });
    const securityContext = createSecurityContext(tenant.id);
    const command = new CreateOrganizationCommand(
      '测试组织',
      'TEST_ORG',
      '测试描述',
      securityContext
    );

    mockTenantRepo.findById.mockResolvedValue(tenant);
    mockAbilityService.checkPermission.mockResolvedValue(true);

    // When
    const organizationId = await handler.execute(command);

    // Then
    expect(organizationId).toBeDefined();
    expect(mockEventStore.saveEvents).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: tenant.id
        })
      ]),
      expect.any(Number)
    );
  });

  it('应该拒绝跨租户创建组织', async () => {
    // Given
    const tenantA = Tenant.create({ name: '租户A', subdomain: 'tenant-a' });
    const tenantB = Tenant.create({ name: '租户B', subdomain: 'tenant-b' });
    
    const securityContext = createSecurityContext(tenantA.id);
    const command = new CreateOrganizationCommand(
      '测试组织',
      'TEST_ORG',
      '测试描述',
      securityContext
    );

    // 模拟租户B返回，但安全上下文是租户A
    mockTenantRepo.findById.mockResolvedValue(tenantB);

    // When & Then
    await expect(handler.execute(command))
      .rejects
      .toThrow(TenantNotFoundError);
  });
});

describe('GetOrganizationTreeHandler (Multi-tenant)', () => {
  it('应该只返回当前租户的组织树', async () => {
    // Given
    const tenantA = Tenant.create({ name: '租户A', subdomain: 'tenant-a' });
    const tenantB = Tenant.create({ name: '租户B', subdomain: 'tenant-b' });
    
    const securityContext = createSecurityContext(tenantA.id);
    const query = new GetOrganizationTreeQuery(OrganizationId.create(), securityContext);

    // 模拟返回两个租户的数据，但应该只过滤出租户A的数据
    mockOrganizationRepo.findById.mockResolvedValue(createOrganization(tenantA.id));
    mockDepartmentRepo.findByOrganization.mockResolvedValue([
      createDepartment(tenantA.id),
      createDepartment(tenantB.id) // 这个应该被过滤掉
    ]);

    // When
    const result = await handler.execute(query);

    // Then
    expect(result.organization.tenantId.equals(tenantA.id)).toBe(true);
    expect(result.rootDepartments).toHaveLength(1);
    expect(result.rootDepartments[0].department.tenantId.equals(tenantA.id)).toBe(true);
  });
});
```

## 📖 多租户沟通与文档规范

### 5.1 多租户术语使用场景

| 场景 | 推荐术语 | 示例 | 理由 |
|------|----------|------|------|
| **架构设计** | 多租户用例 | "创建组织用例需要验证租户状态" | 强调租户隔离 |
| **代码实现** | MultiTenantHandler | `CreateOrganizationHandler` | 明确租户感知 |
| **团队沟通** | 租户业务流程 | "这个租户的组织配置流程" | 区分租户上下文 |
| **技术文档** | 租户隔离策略 | "基于Schema的数据隔离" | 说明技术实现 |

### 5.2 多租户架构图标注

```
[租户A界面] 
    → [CreateOrganization Use Case] (MultiTenantCommandHandler)
    → [Tenant Aggregate] (验证状态)
    → [Organization Aggregate] (租户A)
    → [OrganizationCreated Event] (租户A上下文)
    → [Department Setup] & [Policy Configuration] (租户A特定)

[租户B界面]
    → 独立的业务流程和数据处理
    → 完全的数据隔离
```

## 🚀 多租户演进与维护

### 6.1 多租户演进路径

1. **单租户阶段**: 基础业务功能，隐式租户ID
2. **多租户基础**: 显式租户上下文，基础数据隔离
3. **高级多租户**: 租户特定配置，复杂权限模型
4. **企业级多租户**: 性能优化，租户自助服务

### 6.2 多租户重构信号

- 命令/查询中缺少租户上下文参数
- 查询结果包含跨租户数据
- 业务逻辑硬编码租户特定规则
- 性能问题由于缺少租户索引

## ✅ 总结

### 7.1 多租户应用层核心价值

1. **完整租户隔离**: 所有用例显式处理租户上下文
2. **数据安全**: 自动防止跨租户数据泄露
3. **租户定制**: 支持租户特定的业务流程
4. **性能优化**: 租户级别的查询优化和缓存

### 7.2 关键特性

- **租户感知命令/查询**: 所有操作包含租户验证
- **自动数据过滤**: 查询自动应用租户隔离条件
- **租户特定业务逻辑**: 支持不同租户的业务差异
- **完整审计追踪**: 租户操作的全链路追踪

### 7.3 合规性保证

- **数据隔离**: 应用层确保租户数据边界
- **权限控制**: 细粒度的跨租户访问控制
- **审计合规**: 完整的租户操作日志记录
- **安全验证**: 多层级的租户权限验证

这套多租户应用层设计为企业级SaaS应用提供了安全、可扩展的业务流程协调基础。

---
*文档版本: 2.0 | 最后更新: 2024-11-XX | 特性: 多租户增强 + 数据隔离*