# 基于 CASL + CQRS + ES + EDA 的多租户组织权限设计规范

## 📋 文档概述

本文档定义基于 CASL + NestJS + DDD + Clean Architecture + CQRS + ES + EDA 的完整多租户组织权限解决方案，支持组织-部门层级结构和数据权限控制。

## 🏗 架构总览

### 1.1 组织层级结构

```
┌─────────────────────────────────────────────────────────────┐
│                   多租户组织权限层级结构                      │
├─────────────────────────────────────────────────────────────┤
│  租户 (Tenant)                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   组织A         │  │   组织B         │  (水平平行)        │
│  │  (Organization) │  │  (Organization) │                   │
│  └─────────────────┘  └─────────────────┘                   │
│         ↓                        ↓                          │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   部门A1        │  │   部门B1        │  (垂直层级)        │
│  │   (Department)  │  │   (Department)  │                   │
│  └─────────────────┘  └─────────────────┘                   │
│         ↓                        ↓                          │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   部门A2        │  │   部门B2        │                   │
│  │   (子部门)      │  │   (子部门)      │                   │
│  └─────────────────┘  └─────────────────┘                   │
│         ↓                        ↓                          │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   用户权限      │  │   数据权限      │                   │
│  │   (User)        │  │   (Data)        │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 权限数据流

```
┌─────────────────────────────────────────────────────────────┐
│             组织权限 CQRS + ES + EDA 数据流                  │
├─────────────────────────────────────────────────────────────┤
│  命令侧 (Write)                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Command   │ →  │ 组织/部门   │ →  │   Domain    │      │
│  │   Handler   │    │  聚合根     │    │   Event     │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         ↓                      ↓               ↓            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ Event Store │ ←  │ 组织层级    │ ←  │ 数据权限    │      │
│  │   (ES)      │    │  计算       │    │  策略       │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  查询侧 (Read)                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Query     │ →  │ 组织树      │ →  │ 部门范围    │      │
│  │   Handler   │    │  投影       │    │  过滤       │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         ↓                      ↓               ↓            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ 层级权限    │ →  │ 数据隔离    │ →  │  响应       │      │
│  │   CASL      │    │   CASL      │    │  过滤       │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 领域层设计

### 2.1 核心领域模型

```typescript
// 组织聚合根 (水平平行，无上下级)
export class Organization extends AggregateRoot {
  constructor(
    public readonly id: OrganizationId,
    private tenantId: TenantId,
    private name: string,
    private code: string,
    private description: string,
    private status: OrganizationStatus,
    private settings: OrganizationSettings,
    private createdAt: DateTime,
    private updatedAt: DateTime
  ) {
    super();
  }

  // 创建组织
  static create(creation: OrganizationCreation): Organization {
    const organization = new Organization(
      OrganizationId.create(),
      creation.tenantId,
      creation.name,
      creation.code,
      creation.description,
      OrganizationStatus.ACTIVE,
      OrganizationSettings.default(),
      DateTime.now(),
      DateTime.now()
    );

    organization.addDomainEvent(new OrganizationCreatedEvent(organization.id));
    return organization;
  }

  // 创建部门
  createDepartment(creation: DepartmentCreation): Department {
    if (!this.canManageDepartments()) {
      throw new AuthorizationError('无权在组织中创建部门');
    }

    return Department.create({
      ...creation,
      organizationId: this.id,
      tenantId: this.tenantId
    });
  }

  // 检查组织成员
  isMember(userId: UserId): boolean {
    // 实现组织成员检查逻辑
    return this.memberRepository.isUserInOrganization(userId, this.id);
  }

  // 获取组织所有部门（包括子部门）
  async getAllDepartments(): Promise<Department[]> {
    return this.departmentRepository.findByOrganization(this.id, {
      includeDescendants: true
    });
  }
}

// 部门聚合根 (垂直层级，有上下级)
export class Department extends AggregateRoot {
  constructor(
    public readonly id: DepartmentId,
    private tenantId: TenantId,
    private organizationId: OrganizationId,
    private parentDepartmentId: DepartmentId | null, // 支持层级结构
    private name: string,
    private code: string,
    private path: DepartmentPath, // 部门路径，用于快速查询层级
    private level: number,
    private status: DepartmentStatus,
    private settings: DepartmentSettings,
    private createdAt: DateTime,
    private updatedAt: DateTime
  ) {
    super();
  }

  // 创建部门
  static create(creation: DepartmentCreation): Department {
    const path = creation.parentId ? 
      await this.calculatePath(creation.parentId) : 
      DepartmentPath.root();
    
    const level = creation.parentId ? 
      await this.calculateLevel(creation.parentId) + 1 : 0;

    const department = new Department(
      DepartmentId.create(),
      creation.tenantId,
      creation.organizationId,
      creation.parentId || null,
      creation.name,
      creation.code,
      path,
      level,
      DepartmentStatus.ACTIVE,
      DepartmentSettings.default(),
      DateTime.now(),
      DateTime.now()
    );

    department.addDomainEvent(new DepartmentCreatedEvent(department.id));
    return department;
  }

  // 创建子部门
  createSubDepartment(creation: SubDepartmentCreation): Department {
    return Department.create({
      ...creation,
      organizationId: this.organizationId,
      tenantId: this.tenantId,
      parentId: this.id
    });
  }

  // 获取所有子部门
  async getDescendants(): Promise<Department[]> {
    return this.departmentRepository.findDescendants(this.id);
  }

  // 获取所有祖先部门
  async getAncestors(): Promise<Department[]> {
    return this.departmentRepository.findAncestors(this.id);
  }

  // 检查用户是否在部门或其子部门中
  async isUserInDepartmentTree(userId: UserId): Promise<boolean> {
    const userDepartments = await this.userDepartmentRepository.findByUser(userId);
    return userDepartments.some(userDept => 
      this.path.isAncestorOf(userDept.departmentPath) ||
      this.path.equals(userDept.departmentPath)
    );
  }

  // 移动到其他部门下
  async moveTo(parentDepartment: Department): Promise<void> {
    if (this.path.isAncestorOf(parentDepartment.path)) {
      throw new BusinessError('不能将部门移动到其子部门下');
    }

    const oldPath = this.path;
    const newPath = parentDepartment.path.createChildPath(this.id);

    this.parentDepartmentId = parentDepartment.id;
    this.path = newPath;
    this.level = parentDepartment.level + 1;

    this.addDomainEvent(new DepartmentMovedEvent(
      this.id,
      oldPath,
      newPath,
      new Date()
    ));
  }
}

// 部门路径值对象
export class DepartmentPath extends ValueObject {
  private readonly segments: string[];

  constructor(path: string) {
    super();
    this.segments = path.split('.');
    this.validate();
  }

  static root(): DepartmentPath {
    return new DepartmentPath('');
  }

  createChildPath(departmentId: DepartmentId): DepartmentPath {
    if (this.segments.length === 0) {
      return new DepartmentPath(departmentId.value);
    }
    return new DepartmentPath(`${this.value}.${departmentId.value}`);
  }

  isAncestorOf(other: DepartmentPath): boolean {
    if (this.segments.length >= other.segments.length) {
      return false;
    }
    
    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i] !== other.segments[i]) {
        return false;
      }
    }
    return true;
  }

  isDescendantOf(other: DepartmentPath): boolean {
    return other.isAncestorOf(this);
  }

  getParentPath(): DepartmentPath | null {
    if (this.segments.length <= 1) {
      return null;
    }
    return new DepartmentPath(this.segments.slice(0, -1).join('.'));
  }

  get value(): string {
    return this.segments.join('.');
  }
}
```

### 2.2 用户组织权限聚合根

```typescript
// 用户组织权限聚合根 (事件溯源)
export class UserOrganizationAuthorization extends EventSourcedAggregateRoot {
  private userId: UserId;
  private tenantId: TenantId;
  private organizationMemberships: Map<OrganizationId, OrganizationMembership> = new Map();
  private departmentMemberships: Map<DepartmentId, DepartmentMembership> = new Map();
  private dataScopes: DataScope[] = [];

  constructor() {
    super();
  }

  // 加入组织
  joinOrganization(command: JoinOrganizationCommand): void {
    if (this.organizationMemberships.has(command.organizationId.value)) {
      return; // 已存在
    }

    this.apply(new UserJoinedOrganizationEvent(
      this.userId,
      command.organizationId,
      command.tenantId,
      command.roles,
      command.joinedBy,
      new Date()
    ));
  }

  // 加入部门
  joinDepartment(command: JoinDepartmentCommand): void {
    // 验证用户是否在父组织中
    const department = await this.departmentRepository.findById(command.departmentId);
    if (!this.organizationMemberships.has(department.organizationId.value)) {
      throw new AuthorizationError('用户不在该部门所属的组织中');
    }

    this.apply(new UserJoinedDepartmentEvent(
      this.userId,
      command.departmentId,
      command.organizationId,
      command.roles,
      command.joinedBy,
      new Date()
    ));
  }

  // 获取用户数据权限范围
  getDataScopes(): DataScope[] {
    const scopes: DataScope[] = [];

    // 组织级数据权限
    for (const membership of this.organizationMemberships.values()) {
      scopes.push(...membership.getDataScopes());
    }

    // 部门级数据权限 (包括子部门)
    for (const membership of this.departmentMemberships.values()) {
      const department = await this.departmentRepository.findById(membership.departmentId);
      const descendantDepartments = await department.getDescendants();
      
      for (const dept of [department, ...descendantDepartments]) {
        scopes.push(...membership.getDataScopesForDepartment(dept.id));
      }
    }

    return scopes;
  }

  // 检查组织权限
  hasOrganizationPermission(organizationId: OrganizationId, permission: Permission): boolean {
    const membership = this.organizationMemberships.get(organizationId.value);
    return membership?.hasPermission(permission) || false;
  }

  // 检查部门权限 (包括继承权限)
  async hasDepartmentPermission(departmentId: DepartmentId, permission: Permission): Promise<boolean> {
    const department = await this.departmentRepository.findById(departmentId);
    
    // 检查直接部门权限
    const directMembership = this.departmentMemberships.get(departmentId.value);
    if (directMembership?.hasPermission(permission)) {
      return true;
    }

    // 检查组织级权限
    if (this.hasOrganizationPermission(department.organizationId, permission)) {
      return true;
    }

    // 检查上级部门权限继承
    const ancestors = await department.getAncestors();
    for (const ancestor of ancestors) {
      const ancestorMembership = this.departmentMemberships.get(ancestor.id.value);
      if (ancestorMembership?.canInheritToDescendants(permission)) {
        return true;
      }
    }

    return false;
  }

  // 转换为 CASL 规则
  async toCaslRules(): Promise<RawRuleOf<AppAbility>[]> {
    const rules: RawRuleOf<AppAbility>[] = [];

    // 组织级规则
    for (const membership of this.organizationMemberships.values()) {
      rules.push(...await membership.toCaslRules());
    }

    // 部门级规则 (包括层级继承)
    for (const membership of this.departmentMemberships.values()) {
      rules.push(...await membership.toCaslRulesWithInheritance());
    }

    // 数据范围规则
    for (const scope of this.getDataScopes()) {
      rules.push(...scope.toCaslRules());
    }

    return rules;
  }

  // 事件应用器
  private onUserJoinedOrganizationEvent(event: UserJoinedOrganizationEvent): void {
    const membership = OrganizationMembership.create(
      event.userId,
      event.organizationId,
      event.roles
    );
    this.organizationMemberships.set(event.organizationId.value, membership);
  }

  private onUserJoinedDepartmentEvent(event: UserJoinedDepartmentEvent): void {
    const membership = DepartmentMembership.create(
      event.userId,
      event.departmentId,
      event.organizationId,
      event.roles
    );
    this.departmentMemberships.set(event.departmentId.value, membership);
  }
}
```

### 2.3 组织权限领域事件

```typescript
// 组织权限领域事件
export class UserJoinedOrganizationEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly organizationId: OrganizationId,
    public readonly tenantId: TenantId,
    public readonly roles: OrganizationRole[],
    public readonly joinedBy: UserId,
    public readonly joinedAt: Date
  ) {
    super(userId.value);
  }
}

export class UserJoinedDepartmentEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly departmentId: DepartmentId,
    public readonly organizationId: OrganizationId,
    public readonly roles: DepartmentRole[],
    public readonly joinedBy: UserId,
    public readonly joinedAt: Date
  ) {
    super(userId.value);
  }
}

export class DepartmentMovedEvent extends DomainEvent {
  constructor(
    public readonly departmentId: DepartmentId,
    public readonly oldPath: DepartmentPath,
    public readonly newPath: DepartmentPath,
    public readonly movedAt: Date
  ) {
    super(departmentId.value);
  }
}

export class OrganizationDataScopeChangedEvent extends DomainEvent {
  constructor(
    public readonly organizationId: OrganizationId,
    public readonly dataScopes: DataScope[],
    public readonly changedBy: UserId,
    public readonly changedAt: Date
  ) {
    super(organizationId.value);
  }
}
```

## 🚀 应用层设计

### 3.1 组织权限命令处理器

```typescript
// 加入组织命令处理器
@CommandHandler(JoinOrganizationCommand)
export class JoinOrganizationCommandHandler extends CaslCommandHandler<JoinOrganizationCommand> {
  async execute(command: JoinOrganizationCommand): Promise<void> {
    // 验证操作权限
    await this.validateCommandPermission(command, 'manage', 'OrganizationMembership');

    // 加载用户组织权限聚合
    const userAuth = await this.loadAggregate(
      UserOrganizationAuthorization,
      `user_org_auth_${command.userId.value}_${command.tenantId.value}`
    );

    // 执行业务逻辑
    userAuth.joinOrganization(command);

    // 保存事件
    await this.saveAggregate(userAuth);

    // 发布事件
    this.eventBus.publishAll(userAuth.getUncommittedEvents());
  }
}

// 创建部门命令处理器
@CommandHandler(CreateDepartmentCommand)
export class CreateDepartmentCommandHandler extends CaslCommandHandler<CreateDepartmentCommand> {
  async execute(command: CreateDepartmentCommand): Promise<DepartmentId> {
    // 验证组织权限
    await this.validateCommandPermission(command, 'create', 'Department');

    // 加载组织聚合
    const organization = await this.organizationRepository.findById(command.organizationId);
    
    // 创建部门
    const department = organization.createDepartment({
      name: command.name,
      code: command.code,
      description: command.description,
      parentId: command.parentDepartmentId,
      tenantId: command.securityContext.tenantId,
      organizationId: command.organizationId
    });

    // 保存部门
    await this.departmentRepository.save(department);

    // 发布部门创建事件
    this.eventBus.publishAll(department.getUncommittedEvents());

    return department.id;
  }
}

// 移动部门命令处理器
@CommandHandler(MoveDepartmentCommand)
export class MoveDepartmentCommandHandler extends CaslCommandHandler<MoveDepartmentCommand> {
  async execute(command: MoveDepartmentCommand): Promise<void> {
    // 验证源部门和目标部门权限
    const ability = await this.abilityService.getAbilityForUser(
      command.securityContext.userId,
      command.securityContext.tenantId
    );

    if (!ability.can('move', { __typename: 'Department', id: command.departmentId.value })) {
      throw new AuthorizationError('无权移动该部门');
    }

    if (!ability.can('manage', { __typename: 'Department', id: command.newParentDepartmentId.value })) {
      throw new AuthorizationError('无权管理目标部门');
    }

    // 加载部门聚合
    const department = await this.departmentRepository.findById(command.departmentId);
    const newParent = await this.departmentRepository.findById(command.newParentDepartmentId);

    // 移动部门
    await department.moveTo(newParent);

    // 保存变更
    await this.departmentRepository.save(department);

    // 发布部门移动事件
    this.eventBus.publishAll(department.getUncommittedEvents());
  }
}
```

### 3.2 组织权限查询处理器

```typescript
// 获取用户可访问的组织查询
@QueryHandler(GetAccessibleOrganizationsQuery)
export class GetAccessibleOrganizationsQueryHandler 
  extends CaslQueryHandler<GetAccessibleOrganizationsQuery, Organization[]> {
  
  async execute(query: GetAccessibleOrganizationsQuery): Promise<Organization[]> {
    const ability = await this.abilityService.getAbilityForUser(
      query.securityContext.userId,
      query.securityContext.tenantId
    );

    // 获取所有组织
    const allOrganizations = await this.organizationRepository.findByTenant(
      TenantId.create(query.securityContext.tenantId)
    );

    // 过滤用户有权限访问的组织
    return allOrganizations.filter(org => 
      ability.can('read', { __typename: 'Organization', id: org.id.value })
    );
  }
}

// 获取部门树查询
@QueryHandler(GetDepartmentTreeQuery)
export class GetDepartmentTreeQueryHandler 
  extends CaslQueryHandler<GetDepartmentTreeQuery, DepartmentTree> {
  
  async execute(query: GetDepartmentTreeQuery): Promise<DepartmentTree> {
    // 验证组织访问权限
    await this.validateQueryPermission(query, 'read', {
      __typename: 'Organization',
      id: query.organizationId.value
    });

    // 获取部门树
    const departmentTree = await this.departmentRepository.findTreeByOrganization(
      query.organizationId
    );

    // 应用部门级权限过滤
    return this.filterDepartmentTreeByPermission(departmentTree, query);
  }

  private async filterDepartmentTreeByPermission(
    tree: DepartmentTree,
    query: GetDepartmentTreeQuery
  ): Promise<DepartmentTree> {
    const ability = await this.abilityService.getAbilityForUser(
      query.securityContext.userId,
      query.securityContext.tenantId
    );

    // 递归过滤部门树
    const filterNode = (node: DepartmentTreeNode): DepartmentTreeNode | null => {
      if (!ability.can('read', { __typename: 'Department', id: node.department.id.value })) {
        return null;
      }

      const filteredChildren = node.children
        .map(filterNode)
        .filter((child): child is DepartmentTreeNode => child !== null);

      return {
        ...node,
        children: filteredChildren
      };
    };

    return filterNode(tree.root);
  }
}

// 获取用户数据权限范围查询
@QueryHandler(GetUserDataScopesQuery)
export class GetUserDataScopesQueryHandler 
  extends CaslQueryHandler<GetUserDataScopesQuery, DataScope[]> {
  
  async execute(query: GetUserDataScopesQuery): Promise<DataScope[]> {
    // 加载用户组织权限聚合
    const userAuth = await this.loadUserAuthorization(
      query.userId,
      query.tenantId
    );

    // 获取数据权限范围
    return userAuth.getDataScopes();
  }

  private async loadUserAuthorization(
    userId: UserId,
    tenantId: TenantId
  ): Promise<UserOrganizationAuthorization> {
    const events = await this.eventStore.getEvents(
      `user_org_auth_${userId.value}_${tenantId.value}`
    );

    if (events.length === 0) {
      throw new UserAuthorizationNotFoundError('用户组织权限未找到');
    }

    return UserOrganizationAuthorization.reconstitute(events);
  }
}
```

## 🔄 事件驱动架构

### 4.1 组织权限事件处理器

```typescript
// 部门移动事件处理器
@EventHandler(DepartmentMovedEvent)
export class DepartmentMovedEventHandler implements IEventHandler<DepartmentMovedEvent> {
  constructor(
    private readonly userAuthProjection: UserOrganizationAuthorizationProjection,
    private readonly departmentTreeProjection: DepartmentTreeProjection,
    private readonly abilityService: CaslAbilityService
  ) {}

  async handle(event: DepartmentMovedEvent): Promise<void> {
    // 1. 更新部门树投影
    await this.departmentTreeProjection.updateDepartmentPath(
      event.departmentId,
      event.oldPath,
      event.newPath
    );

    // 2. 更新用户权限投影
    await this.userAuthProjection.updateDepartmentPaths(
      event.departmentId,
      event.newPath
    );

    // 3. 清除受影响用户的能力缓存
    const affectedUsers = await this.userAuthProjection.getUsersInDepartmentTree(
      event.departmentId
    );

    await Promise.all(
      affectedUsers.map(user => 
        this.abilityService.clearUserCache(user.id.value, user.tenantId.value)
      )
    );

    // 4. 发布权限重建事件
    await this.eventBus.publish(new PermissionsRebuildRequestedEvent(
      event.departmentId.tenantId,
      'system',
      { 
        scope: 'department_tree',
        departmentId: event.departmentId.value 
      }
    ));
  }
}

// 用户加入组织事件处理器
@EventHandler(UserJoinedOrganizationEvent)
export class UserJoinedOrganizationEventHandler 
  implements IEventHandler<UserJoinedOrganizationEvent> {
  
  async handle(event: UserJoinedOrganizationEvent): Promise<void> {
    // 更新用户组织成员投影
    await this.userOrganizationProjection.addUserToOrganization(
      event.userId,
      event.organizationId,
      event.roles
    );

    // 清除用户能力缓存
    await this.abilityService.clearUserCache(
      event.userId.value,
      event.tenantId.value
    );

    // 发送通知
    await this.notificationService.sendOrganizationJoinNotification(
      event.userId,
      event.organizationId,
      event.joinedBy
    );
  }
}
```

### 4.2 组织权限投影

```typescript
// 用户组织权限投影
@Injectable()
export class UserOrganizationAuthorizationProjection {
  constructor(
    private readonly em: EntityManager,
    private readonly eventStore: EventStore
  ) {}

  @ProjectionHandler(UserJoinedOrganizationEvent)
  async onUserJoinedOrganization(event: UserJoinedOrganizationEvent): Promise<void> {
    const userOrg = await this.getOrCreateUserOrganization(
      event.userId,
      event.organizationId
    );

    userOrg.addRoles(event.roles);
    userOrg.joinedAt = event.joinedAt;
    userOrg.joinedBy = event.joinedBy;

    await this.em.persistAndFlush(userOrg);
  }

  @ProjectionHandler(UserJoinedDepartmentEvent)
  async onUserJoinedDepartment(event: UserJoinedDepartmentEvent): Promise<void> {
    const userDept = await this.getOrCreateUserDepartment(
      event.userId,
      event.departmentId
    );

    userDept.addRoles(event.roles);
    userDept.joinedAt = event.joinedAt;
    userDept.joinedBy = event.joinedBy;

    await this.em.persistAndFlush(userDept);
  }

  // 获取用户在所有组织的权限
  async getUserOrganizationPermissions(userId: UserId, tenantId: TenantId): Promise<OrganizationPermission[]> {
    const userOrgs = await this.em.find(UserOrganizationEntity, {
      userId: userId.value,
      tenantId: tenantId.value
    });

    return userOrgs.map(org => org.toPermission());
  }

  // 获取用户在部门树的权限
  async getUserDepartmentPermissions(userId: UserId, tenantId: TenantId): Promise<DepartmentPermission[]> {
    const userDepts = await this.em.find(UserDepartmentEntity, {
      userId: userId.value,
      tenantId: tenantId.value
    });

    const permissions: DepartmentPermission[] = [];

    for (const userDept of userDepts) {
      const department = await this.departmentRepository.findById(
        DepartmentId.create(userDept.departmentId)
      );

      // 包括部门及其所有子部门的权限
      const descendants = await department.getDescendants();
      
      for (const dept of [department, ...descendants]) {
        permissions.push(...userDept.toPermissionsForDepartment(dept.id));
      }
    }

    return permissions;
  }
}

// 部门树投影
@Injectable()
export class DepartmentTreeProjection {
  constructor(private readonly em: EntityManager) {}

  @ProjectionHandler(DepartmentCreatedEvent)
  async onDepartmentCreated(event: DepartmentCreatedEvent): Promise<void> {
    const department = await this.departmentRepository.findById(event.departmentId);
    
    const treeNode = new DepartmentTreeNodeEntity({
      departmentId: department.id.value,
      organizationId: department.organizationId.value,
      parentId: department.parentDepartmentId?.value || null,
      path: department.path.value,
      level: department.level,
      name: department.name,
      code: department.code
    });

    await this.em.persistAndFlush(treeNode);
  }

  @ProjectionHandler(DepartmentMovedEvent)
  async onDepartmentMoved(event: DepartmentMovedEvent): Promise<void> {
    // 更新部门路径
    await this.em.nativeUpdate(
      DepartmentTreeNodeEntity,
      { departmentId: event.departmentId.value },
      { path: event.newPath.value }
    );

    // 更新所有子部门的路径
    const oldPathPrefix = `${event.oldPath.value}.`;
    const newPathPrefix = `${event.newPath.value}.`;

    await this.em.nativeUpdate(
      DepartmentTreeNodeEntity,
      { path: { $like: `${oldPathPrefix}%` } },
      { path: { $replace: [oldPathPrefix, newPathPrefix] } }
    );
  }

  // 获取组织部门树
  async getOrganizationDepartmentTree(organizationId: OrganizationId): Promise<DepartmentTree> {
    const nodes = await this.em.find(DepartmentTreeNodeEntity, {
      organizationId: organizationId.value
    }, { orderBy: { path: 'ASC' } });

    return this.buildTree(nodes);
  }

  private buildTree(nodes: DepartmentTreeNodeEntity[]): DepartmentTree {
    const nodeMap = new Map(nodes.map(node => [node.departmentId, node]));
    const rootNodes = nodes.filter(node => node.level === 0);

    const buildTreeNode = (node: DepartmentTreeNodeEntity): DepartmentTreeNode => {
      const children = nodes.filter(n => n.parentId === node.departmentId);
      
      return {
        department: {
          id: DepartmentId.create(node.departmentId),
          name: node.name,
          code: node.code,
          path: new DepartmentPath(node.path),
          level: node.level
        },
        children: children.map(buildTreeNode)
      };
    };

    return {
      root: rootNodes.map(buildTreeNode)
    };
  }
}
```

## 🛡 CASL 能力工厂增强

### 5.1 组织感知的 CASL 能力工厂

```typescript
@DomainService()
export class OrganizationAwareCaslAbilityFactory extends DomainCaslAbilityFactory {
  async createForUser(user: User, tenant: Tenant): Promise<AppAbility> {
    const baseRules = await super.createForUser(user, tenant);
    const orgRules = await this.buildOrganizationRules(user, tenant);
    
    return createMongoAbility<AppAbility>([...baseRules, ...orgRules]);
  }

  private async buildOrganizationRules(user: User, tenant: Tenant): Promise<RawRuleOf<AppAbility>[]> {
    const rules: RawRuleOf<AppAbility>[] = [];

    // 获取用户组织权限
    const orgPermissions = await this.userOrgProjection.getUserOrganizationPermissions(user.id, tenant.id);
    const deptPermissions = await this.userOrgProjection.getUserDepartmentPermissions(user.id, tenant.id);

    // 组织级规则
    for (const permission of orgPermissions) {
      rules.push({
        action: permission.action,
        subject: permission.subject,
        conditions: {
          ...permission.conditions,
          organizationId: { $in: permission.organizationIds }
        }
      });
    }

    // 部门级规则 (包括层级)
    for (const permission of deptPermissions) {
      const departmentConditions = await this.buildDepartmentConditions(permission);
      
      rules.push({
        action: permission.action,
        subject: permission.subject,
        conditions: {
          ...permission.conditions,
          $or: departmentConditions
        }
      });
    }

    return rules;
  }

  private async buildDepartmentConditions(permission: DepartmentPermission): Promise<any[]> {
    const conditions = [];

    for (const deptId of permission.departmentIds) {
      const department = await this.departmentRepository.findById(deptId);
      
      if (permission.includeDescendants) {
        // 包括所有子部门
        conditions.push({
          departmentPath: { $like: `${department.path.value}%` }
        });
      } else {
        // 仅当前部门
        conditions.push({
          departmentId: deptId.value
        });
      }
    }

    return conditions;
  }
}
```

## 🌐 接口层设计

### 6.1 组织权限控制器

```typescript
@Controller('organizations')
@UseGuards(MultiTenantAuthGuard, CaslGuard)
export class OrganizationController {
  @Post()
  @CheckPolicies('create', 'Organization')
  async createOrganization(
    @SecurityContext() context: SecurityContext,
    @Body() createDto: CreateOrganizationRequestDto
  ): Promise<ApiResponse<OrganizationResponseDto>> {
    const command = new CreateOrganizationCommand(createDto, context);
    const organization = await this.commandBus.execute(command);

    return ApiResponse.success(
      this.toOrganizationResponseDto(organization),
      '组织创建成功'
    );
  }

  @Get()
  @CheckPolicies('read', 'Organization')
  async getOrganizations(
    @SecurityContext() context: SecurityContext,
    @Query() queryDto: OrganizationQueryRequestDto
  ): Promise<ApiResponse<OrganizationResponseDto[]>> {
    const query = new GetAccessibleOrganizationsQuery(queryDto, context);
    const organizations = await this.queryBus.execute(query);

    return ApiResponse.success(
      organizations.map(org => this.toOrganizationResponseDto(org))
    );
  }

  @Post(':id/departments')
  @CheckPolicies('create', 'Department')
  async createDepartment(
    @SecurityContext() context: SecurityContext,
    @Param('id') organizationId: string,
    @Body() createDto: CreateDepartmentRequestDto
  ): Promise<ApiResponse<DepartmentResponseDto>> {
    const command = new CreateDepartmentCommand({
      ...createDto,
      organizationId: OrganizationId.create(organizationId)
    }, context);

    const departmentId = await this.commandBus.execute(command);

    return ApiResponse.success(
      { id: departmentId.value },
      '部门创建成功'
    );
  }

  @Get(':id/departments/tree')
  @CheckPolicies('read', 'Department')
  async getDepartmentTree(
    @SecurityContext() context: SecurityContext,
    @Param('id') organizationId: string
  ): Promise<ApiResponse<DepartmentTreeResponseDto>> {
    const query = new GetDepartmentTreeQuery(
      OrganizationId.create(organizationId),
      context
    );

    const departmentTree = await this.queryBus.execute(query);

    return ApiResponse.success(
      this.toDepartmentTreeResponseDto(departmentTree)
    );
  }
}

@Controller('departments')
@UseGuards(MultiTenantAuthGuard, CaslGuard)
export class DepartmentController {
  @Patch(':id/move')
  @CheckResourcePolicy('move', 'id')
  async moveDepartment(
    @SecurityContext() context: SecurityContext,
    @Param('id') departmentId: string,
    @Body() moveDto: MoveDepartmentRequestDto
  ): Promise<ApiResponse<void>> {
    const command = new MoveDepartmentCommand({
      departmentId: DepartmentId.create(departmentId),
      newParentDepartmentId: DepartmentId.create(moveDto.newParentId)
    }, context);

    await this.commandBus.execute(command);

    return ApiResponse.empty('部门移动成功');
  }

  @Get(':id/users')
  @CheckResourcePolicy('read', 'id')
  async getDepartmentUsers(
    @SecurityContext() context: SecurityContext,
    @Param('id') departmentId: string,
    @Query() queryDto: DepartmentUsersQueryRequestDto
  ): Promise<ApiResponse<UserResponseDto[]>> {
    const query = new GetDepartmentUsersQuery(
      DepartmentId.create(departmentId),
      queryDto,
      context
    );

    const users = await this.queryBus.execute(query);

    return ApiResponse.success(
      users.map(user => this.toUserResponseDto(user))
    );
  }
}
```

## ✅ 总结

### 7.1 组织权限架构优势

1. **水平组织隔离**: 组织间数据完全隔离，平行管理
2. **垂直部门层级**: 部门支持树形结构，权限可继承
3. **精细数据权限**: 基于组织-部门层级的数据访问控制
4. **动态权限继承**: 部门移动自动更新权限继承关系

### 7.2 核心特性

- **组织管理**: 多租户下的平行组织管理
- **部门层级**: 完整的部门树形结构支持
- **权限继承**: 部门层级的权限继承机制
- **数据隔离**: 基于组织-部门的数据访问控制
- **事件驱动**: 组织变更的实时权限更新

### 7.3 性能优化

- **部门路径索引**: 快速部门树查询和权限检查
- **权限投影**: 预计算用户权限范围
- **缓存策略**: 多级权限缓存机制
- **批量处理**: 部门移动的批量权限更新

这套设计为企业级多租户应用提供了强大的组织权限管理能力，完美支持复杂的组织架构和精细的数据权限控制。

---
*文档版本: 5.0 | 最后更新: 2024-11-XX | 特性: 组织-部门层级权限 + CASL + CQRS + ES + EDA*