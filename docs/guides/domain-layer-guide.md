# 领域层设计规范 (多租户增强版)

## 📋 文档概述

本文档在原有领域层设计规范基础上，增加多租户和数据隔离支持。所有领域对象都需要明确租户上下文，确保数据的完全隔离和安全性。

## 🎯 核心设计理念

### 1.1 多租户领域层定位

**领域层**是系统的**业务核心**和**多租户隔离基础**，在 Clean Architecture 中处于最内层，负责：
- 定义多租户业务模型
- 维护租户数据隔离规则
- 实现跨租户的业务逻辑
- 确保租户间数据安全

### 1.2 多租户核心原则

- **租户标识**: 所有聚合根必须包含租户ID
- **数据隔离**: 业务逻辑自动维护租户边界
- **租户上下文**: 显式传递租户信息，避免隐式依赖
- **超级租户**: 支持系统级管理租户的特殊权限

## 🏗 多租户领域模型结构

### 2.1 分层与职责 (多租户增强)

```
domain/
├── entities/           # 实体 (包含租户ID)
├── aggregates/         # 聚合根 (包含租户ID)  
├── value-objects/      # 值对象
├── domain-services/    # 领域服务 (租户感知)
├── domain-events/      # 领域事件 (包含租户上下文)
├── repositories/       # 仓储接口 (租户过滤)
├── policies/           # 业务策略 (租户特定)
├── specs/              # 规格模式
└── tenant/             # 租户核心概念
    ├── tenant.ts       # 租户聚合根
    ├── tenant-id.ts    # 租户ID值对象
    └── tenant-context.ts # 租户上下文
```

### 2.2 多租户组件职责

| 组件类型 | 多租户职责 | 特征 |
|---------|------------|------|
| **聚合根** | 维护租户一致性边界 | 必须包含 `tenantId` |
| **实体** | 归属特定租户 | 包含 `tenantId`，生命周期受租户约束 |
| **值对象** | 租户无关的业务概念 | 无租户标识，可跨租户共享 |
| **领域服务** | 租户感知的业务逻辑 | 接收租户上下文，处理租户特定逻辑 |
| **领域事件** | 携带租户上下文 | 事件数据包含 `tenantId` |
| **仓储接口** | 自动租户过滤 | 查询自动应用租户过滤条件 |

## 🔧 多租户聚合设计规范

### 3.1 多租户聚合根基类

```typescript
// 多租户聚合根基类
export abstract class MultiTenantAggregateRoot extends AggregateRoot {
  protected _tenantId: TenantId;

  constructor(tenantId: TenantId) {
    super();
    this._tenantId = tenantId;
  }

  public get tenantId(): TenantId {
    return this._tenantId;
  }

  // 租户相等性检查
  public isInTenant(tenantId: TenantId): boolean {
    return this._tenantId.equals(tenantId);
  }

  // 跨租户操作验证
  protected ensureSameTenant(other: MultiTenantAggregateRoot): void {
    if (!this.isInTenant(other.tenantId)) {
      throw new CrossTenantOperationError('跨租户操作被禁止');
    }
  }
}

// 租户聚合根
export class Tenant extends MultiTenantAggregateRoot {
  private _name: string;
  private _subdomain: string;
  private _status: TenantStatus;
  private _config: TenantConfig;
  private _subscription: TenantSubscription;

  constructor(
    id: TenantId,
    name: string,
    subdomain: string,
    config: TenantConfig,
    subscription: TenantSubscription
  ) {
    super(id); // 租户自身的 tenantId 就是其 ID
    this._name = name;
    this._subdomain = subdomain;
    this._status = TenantStatus.ACTIVE;
    this._config = config;
    this._subscription = subscription;
    
    this.validate();
  }

  public static create(registration: TenantRegistration): Tenant {
    const tenant = new Tenant(
      TenantId.create(),
      registration.name,
      registration.subdomain,
      TenantConfig.default(),
      TenantSubscription.freeTrial()
    );

    tenant.addDomainEvent(new TenantCreatedEvent(tenant.id, tenant.subdomain));
    return tenant;
  }

  // 激活租户
  public activate(): void {
    if (this._status === TenantStatus.ACTIVE) {
      return;
    }

    this._status = TenantStatus.ACTIVE;
    this.addDomainEvent(new TenantActivatedEvent(this.id));
  }

  // 停用租户
  public deactivate(reason: string): void {
    this._status = TenantStatus.SUSPENDED;
    this.addDomainEvent(new TenantDeactivatedEvent(this.id, reason));
  }

  // 更新配置
  public updateConfig(config: Partial<TenantConfig>): void {
    this._config = this._config.merge(config);
    this.addDomainEvent(new TenantConfigUpdatedEvent(this.id, this._config));
  }

  // 业务验证
  private validate(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new InvalidTenantError('租户名称不能为空');
    }
    
    if (!this._subdomain || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(this._subdomain)) {
      throw new InvalidTenantError('子域名格式不正确');
    }
  }

  public isActive(): boolean {
    return this._status === TenantStatus.ACTIVE;
  }
}
```

### 3.2 组织聚合根 (多租户)

```typescript
// 组织聚合根
export class Organization extends MultiTenantAggregateRoot {
  private _name: string;
  private _code: string;
  private _description: string;
  private _status: OrganizationStatus;
  private _settings: OrganizationSettings;
  private _departments: Department[] = [];

  constructor(
    id: OrganizationId,
    tenantId: TenantId,
    name: string,
    code: string,
    description: string
  ) {
    super(tenantId);
    this._id = id;
    this._name = name;
    this._code = code;
    this._description = description;
    this._status = OrganizationStatus.ACTIVE;
    this._settings = OrganizationSettings.default();
    
    this.validate();
  }

  public static create(creation: OrganizationCreation): Organization {
    const organization = new Organization(
      OrganizationId.create(),
      creation.tenantId,
      creation.name,
      creation.code,
      creation.description
    );

    organization.addDomainEvent(new OrganizationCreatedEvent(
      organization.id,
      organization.tenantId
    ));
    return organization;
  }

  // 创建部门
  public createDepartment(creation: DepartmentCreation): Department {
    // 验证操作权限
    if (!this.canCreateDepartments()) {
      throw new OrganizationOperationError('无权在组织中创建部门');
    }

    const department = Department.create({
      ...creation,
      organizationId: this.id,
      tenantId: this.tenantId
    });

    this._departments.push(department);
    return department;
  }

  // 停用组织
  public deactivate(): void {
    this._status = OrganizationStatus.INACTIVE;
    
    // 停用所有部门
    this._departments.forEach(dept => dept.deactivate());
    
    this.addDomainEvent(new OrganizationDeactivatedEvent(this.id, this.tenantId));
  }

  // 验证组织操作权限
  private canCreateDepartments(): boolean {
    return this._status === OrganizationStatus.ACTIVE && 
           this._settings.allowDepartmentCreation;
  }

  private validate(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new InvalidOrganizationError('组织名称不能为空');
    }
    
    if (!this._code || !/^[A-Z0-9_]{3,20}$/.test(this._code)) {
      throw new InvalidOrganizationError('组织代码格式不正确');
    }
  }
}
```

### 3.3 部门聚合根 (多租户 + 层级)

```typescript
// 部门聚合根
export class Department extends MultiTenantAggregateRoot {
  private _organizationId: OrganizationId;
  private _parentDepartmentId: DepartmentId | null;
  private _name: string;
  private _code: string;
  private _path: DepartmentPath;
  private _level: number;
  private _status: DepartmentStatus;
  private _settings: DepartmentSettings;

  constructor(
    id: DepartmentId,
    tenantId: TenantId,
    organizationId: OrganizationId,
    parentDepartmentId: DepartmentId | null,
    name: string,
    code: string,
    path: DepartmentPath,
    level: number
  ) {
    super(tenantId);
    this._id = id;
    this._organizationId = organizationId;
    this._parentDepartmentId = parentDepartmentId;
    this._name = name;
    this._code = code;
    this._path = path;
    this._level = level;
    this._status = DepartmentStatus.ACTIVE;
    this._settings = DepartmentSettings.default();
    
    this.validate();
  }

  public static create(creation: DepartmentCreation): Department {
    const path = creation.parentId ? 
      DepartmentPath.createChild(creation.parentId) : 
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
      level
    );

    department.addDomainEvent(new DepartmentCreatedEvent(
      department.id,
      department.tenantId,
      department.organizationId
    ));
    return department;
  }

  // 创建子部门
  public createSubDepartment(creation: SubDepartmentCreation): Department {
    if (!this.canCreateSubDepartments()) {
      throw new DepartmentOperationError('无权创建子部门');
    }

    return Department.create({
      ...creation,
      organizationId: this._organizationId,
      tenantId: this.tenantId,
      parentId: this.id
    });
  }

  // 移动部门
  public moveTo(newParent: Department): void {
    // 验证租户一致性
    this.ensureSameTenant(newParent);
    
    // 验证组织一致性
    if (!this._organizationId.equals(newParent.organizationId)) {
      throw new CrossOrganizationOperationError('不能跨组织移动部门');
    }

    // 防止循环引用
    if (this.path.isAncestorOf(newParent.path)) {
      throw new DepartmentHierarchyError('不能将部门移动到其子部门下');
    }

    const oldPath = this._path;
    const newPath = newParent.path.createChildPath(this.id);

    this._parentDepartmentId = newParent.id;
    this._path = newPath;
    this._level = newParent.level + 1;

    this.addDomainEvent(new DepartmentMovedEvent(
      this.id,
      this.tenantId,
      oldPath,
      newPath
    ));
  }

  // 停用部门
  public deactivate(): void {
    this._status = DepartmentStatus.INACTIVE;
    
    // 递归停用子部门
    const descendants = await this.getDescendants();
    descendants.forEach(dept => dept.deactivate());
    
    this.addDomainEvent(new DepartmentDeactivatedEvent(
      this.id,
      this.tenantId
    ));
  }

  private canCreateSubDepartments(): boolean {
    return this._status === DepartmentStatus.ACTIVE && 
           this._settings.allowSubDepartments &&
           this._level < this._settings.maxDepartmentLevel;
  }

  private validate(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new InvalidDepartmentError('部门名称不能为空');
    }
    
    if (this._level < 0) {
      throw new InvalidDepartmentError('部门层级不能为负数');
    }
  }
}
```

### 3.4 用户权限聚合根 (多租户)

```typescript
// 用户组织权限聚合根
export class UserOrganizationAuthorization extends MultiTenantAggregateRoot {
  private _userId: UserId;
  private _organizationMemberships: Map<OrganizationId, OrganizationMembership> = new Map();
  private _departmentMemberships: Map<DepartmentId, DepartmentMembership> = new Map();

  constructor(userId: UserId, tenantId: TenantId) {
    super(tenantId);
    this._userId = userId;
  }

  // 加入组织
  public joinOrganization(command: JoinOrganizationCommand): void {
    // 验证操作者权限
    if (!this.canManageOrganizationMembership(command.operatedBy)) {
      throw new AuthorizationError('无权管理组织成员');
    }

    if (this._organizationMemberships.has(command.organizationId.value)) {
      return; // 已存在
    }

    const membership = OrganizationMembership.create(
      this._userId,
      command.organizationId,
      command.roles
    );

    this._organizationMemberships.set(command.organizationId.value, membership);
    
    this.addDomainEvent(new UserJoinedOrganizationEvent(
      this._userId,
      command.organizationId,
      this.tenantId,
      command.roles,
      command.operatedBy
    ));
  }

  // 加入部门
  public async joinDepartment(command: JoinDepartmentCommand): Promise<void> {
    // 验证用户是否在父组织中
    const department = await this.departmentRepository.findById(command.departmentId);
    if (!this._organizationMemberships.has(department.organizationId.value)) {
      throw new AuthorizationError('用户不在该部门所属的组织中');
    }

    // 验证操作者权限
    if (!this.canManageDepartmentMembership(command.operatedBy, department)) {
      throw new AuthorizationError('无权管理部门成员');
    }

    const membership = DepartmentMembership.create(
      this._userId,
      command.departmentId,
      command.roles
    );

    this._departmentMemberships.set(command.departmentId.value, membership);
    
    this.addDomainEvent(new UserJoinedDepartmentEvent(
      this._userId,
      command.departmentId,
      this.tenantId,
      command.roles,
      command.operatedBy
    ));
  }

  // 检查组织权限
  public hasOrganizationPermission(organizationId: OrganizationId, permission: Permission): boolean {
    const membership = this._organizationMemberships.get(organizationId.value);
    return membership?.hasPermission(permission) || false;
  }

  // 检查部门权限 (包括继承)
  public async hasDepartmentPermission(departmentId: DepartmentId, permission: Permission): Promise<boolean> {
    const department = await this.departmentRepository.findById(departmentId);
    
    // 检查直接权限
    const directMembership = this._departmentMemberships.get(departmentId.value);
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
      const ancestorMembership = this._departmentMemberships.get(ancestor.id.value);
      if (ancestorMembership?.canInheritToDescendants(permission)) {
        return true;
      }
    }

    return false;
  }

  // 转换为 CASL 规则
  public async toCaslRules(): Promise<RawRuleOf<AppAbility>[]> {
    const rules: RawRuleOf<AppAbility>[] = [];

    // 组织级规则
    for (const membership of this._organizationMemberships.values()) {
      rules.push(...await membership.toCaslRules(this.tenantId));
    }

    // 部门级规则
    for (const membership of this._departmentMemberships.values()) {
      rules.push(...await membership.toCaslRulesWithInheritance(this.tenantId));
    }

    return rules;
  }
}
```

## 🎪 多租户领域服务规范

### 4.1 租户感知的领域服务

```typescript
// 多租户订单定价服务
export interface MultiTenantOrderPricingService {
  calculateOrderPrice(
    order: Order, 
    customer: Customer,
    tenantContext: TenantContext
  ): OrderPriceCalculation;
}

@DomainService()
export class DefaultMultiTenantOrderPricingService implements MultiTenantOrderPricingService {
  constructor(
    private readonly discountPolicy: TenantAwareDiscountPolicy,
    private readonly taxPolicy: TenantAwareTaxPolicy,
    private readonly tenantConfigService: TenantConfigService
  ) {}

  public calculateOrderPrice(
    order: Order, 
    customer: Customer,
    tenantContext: TenantContext
  ): OrderPriceCalculation {
    
    // 验证租户一致性
    if (!order.isInTenant(tenantContext.tenantId)) {
      throw new CrossTenantOperationError('订单不属于当前租户');
    }

    // 获取租户特定配置
    const tenantConfig = await this.tenantConfigService.getConfig(tenantContext.tenantId);
    
    // 计算商品总价
    const itemsTotal = order.items.reduce(
      (total, item) => total.add(item.subtotal),
      Money.zero()
    );

    // 应用租户特定的折扣策略
    const discount = this.discountPolicy.calculateDiscount(
      order, 
      customer, 
      tenantConfig
    );
    
    // 计算租户特定的税费
    const tax = this.taxPolicy.calculateTax(
      itemsTotal.subtract(discount.amount),
      tenantConfig
    );

    // 验证价格限制
    this.validatePriceLimits(itemsTotal, tenantConfig);

    // 计算最终价格
    const finalAmount = itemsTotal
      .subtract(discount.amount)
      .add(tax.amount);

    return new OrderPriceCalculation({
      itemsTotal,
      discount,
      tax,
      finalAmount
    });
  }

  private validatePriceLimits(total: Money, config: TenantConfig): void {
    if (config.maxOrderAmount && total.isGreaterThan(config.maxOrderAmount)) {
      throw new OrderPriceLimitExceededError('订单金额超过租户限制');
    }
  }
}
```

### 4.2 租户配置服务

```typescript
// 租户配置服务
export interface TenantConfigService {
  getConfig(tenantId: TenantId): Promise<TenantConfig>;
  updateConfig(tenantId: TenantId, updates: Partial<TenantConfig>): Promise<void>;
  validateConfig(config: TenantConfig): ValidationResult;
}

@DomainService()
export class DefaultTenantConfigService implements TenantConfigService {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async getConfig(tenantId: TenantId): Promise<TenantConfig> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new TenantNotFoundError('租户不存在');
    }
    return tenant.config;
  }

  async updateConfig(tenantId: TenantId, updates: Partial<TenantConfig>): Promise<void> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new TenantNotFoundError('租户不存在');
    }

    const newConfig = tenant.config.merge(updates);
    const validation = this.validateConfig(newConfig);
    
    if (!validation.isValid) {
      throw new InvalidTenantConfigError(validation.errors.join(', '));
    }

    tenant.updateConfig(updates);
    await this.tenantRepository.save(tenant);
  }

  validateConfig(config: TenantConfig): ValidationResult {
    const errors: string[] = [];

    if (config.maxUsers && config.maxUsers < 1) {
      errors.push('最大用户数必须大于0');
    }

    if (config.maxStorageGB && config.maxStorageGB < 0) {
      errors.push('存储空间不能为负数');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

## 📢 多租户领域事件规范

### 5.1 携带租户上下文的事件

```typescript
// 多租户领域事件基类
export abstract class MultiTenantDomainEvent extends DomainEvent {
  public readonly tenantId: TenantId;

  constructor(aggregateId: string, tenantId: TenantId) {
    super(aggregateId);
    this.tenantId = tenantId;
  }
}

// 租户创建事件
export class TenantCreatedEvent extends MultiTenantDomainEvent {
  constructor(
    tenantId: TenantId,
    public readonly subdomain: string,
    public readonly name: string
  ) {
    super(tenantId.value, tenantId);
  }
}

// 组织创建事件
export class OrganizationCreatedEvent extends MultiTenantDomainEvent {
  constructor(
    organizationId: OrganizationId,
    tenantId: TenantId
  ) {
    super(organizationId.value, tenantId);
  }
}

// 用户加入组织事件
export class UserJoinedOrganizationEvent extends MultiTenantDomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly organizationId: OrganizationId,
    tenantId: TenantId,
    public readonly roles: OrganizationRole[],
    public readonly joinedBy: UserId
  ) {
    super(userId.value, tenantId);
  }
}

// 部门移动事件
export class DepartmentMovedEvent extends MultiTenantDomainEvent {
  constructor(
    departmentId: DepartmentId,
    tenantId: TenantId,
    public readonly oldPath: DepartmentPath,
    public readonly newPath: DepartmentPath
  ) {
    super(departmentId.value, tenantId);
  }
}
```

## 🗃 多租户仓储接口规范

### 6.1 租户感知的仓储接口

```typescript
// 多租户仓储基接口
export interface MultiTenantRepository<T extends MultiTenantAggregateRoot> {
  // 基础查询方法 (自动租户过滤)
  findById(id: string, tenantId: TenantId): Promise<T | null>;
  findAll(tenantId: TenantId, criteria?: any): Promise<T[]>;
  exists(id: string, tenantId: TenantId): Promise<boolean>;
  
  // 保存方法
  save(aggregate: T): Promise<void>;
  saveAll(aggregates: T[]): Promise<void>;
  
  // 删除方法
  delete(aggregate: T): Promise<void>;
}

// 租户仓储
export interface TenantRepository extends MultiTenantRepository<Tenant> {
  findBySubdomain(subdomain: string): Promise<Tenant | null>;
  findActiveTenants(): Promise<Tenant[]>;
  findTenantsByStatus(status: TenantStatus): Promise<Tenant[]>;
}

// 组织仓储
export interface OrganizationRepository extends MultiTenantRepository<Organization> {
  findByName(name: string, tenantId: TenantId): Promise<Organization | null>;
  findByCode(code: string, tenantId: TenantId): Promise<Organization | null>;
  findOrganizationsByStatus(status: OrganizationStatus, tenantId: TenantId): Promise<Organization[]>;
}

// 部门仓储
export interface DepartmentRepository extends MultiTenantRepository<Department> {
  findByOrganization(organizationId: OrganizationId, tenantId: TenantId): Promise<Department[]>;
  findByName(name: string, organizationId: OrganizationId, tenantId: TenantId): Promise<Department | null>;
  findDescendants(departmentId: DepartmentId, tenantId: TenantId): Promise<Department[]>;
  findAncestors(departmentId: DepartmentId, tenantId: TenantId): Promise<Department[]>;
  findByPath(path: DepartmentPath, tenantId: TenantId): Promise<Department | null>;
}

// 用户权限仓储
export interface UserAuthorizationRepository extends MultiTenantRepository<UserOrganizationAuthorization> {
  findByUser(userId: UserId, tenantId: TenantId): Promise<UserOrganizationAuthorization | null>;
  findUsersInOrganization(organizationId: OrganizationId, tenantId: TenantId): Promise<UserOrganizationAuthorization[]>;
  findUsersInDepartment(departmentId: DepartmentId, tenantId: TenantId): Promise<UserOrganizationAuthorization[]>;
}
```

## 🧪 多租户测试规范

### 7.1 多租户聚合测试

```typescript
describe('Organization Aggregate (Multi-tenant)', () => {
  let tenant: Tenant;
  let otherTenant: Tenant;

  beforeEach(() => {
    tenant = Tenant.create({
      name: '测试租户A',
      subdomain: 'test-a'
    });
    
    otherTenant = Tenant.create({
      name: '测试租户B', 
      subdomain: 'test-b'
    });
  });

  describe('创建组织', () => {
    it('应该成功创建属于指定租户的组织', () => {
      // When
      const organization = Organization.create({
        tenantId: tenant.id,
        name: '测试组织',
        code: 'TEST_ORG'
      });

      // Then
      expect(organization.tenantId.equals(tenant.id)).toBe(true);
      expect(organization.isInTenant(tenant.id)).toBe(true);
    });

    it('组织创建事件应该包含租户上下文', () => {
      // When
      const organization = Organization.create({
        tenantId: tenant.id,
        name: '测试组织',
        code: 'TEST_ORG'
      });

      // Then
      const events = organization.domainEvents;
      expect(events).toHaveLength(1);
      
      const createdEvent = events[0] as OrganizationCreatedEvent;
      expect(createdEvent.tenantId.equals(tenant.id)).toBe(true);
    });
  });

  describe('跨租户操作', () => {
    it('应该禁止跨租户创建部门', () => {
      // Given
      const organization = Organization.create({
        tenantId: tenant.id,
        name: '测试组织',
        code: 'TEST_ORG'
      });

      const otherTenantDepartment = Department.create({
        tenantId: otherTenant.id,
        organizationId: OrganizationId.create(), // 其他组织的ID
        name: '其他部门',
        code: 'OTHER_DEPT'
      });

      // When & Then
      expect(() => {
        organization.createDepartment({
          tenantId: otherTenant.id, // 错误的租户ID
          name: '测试部门',
          code: 'TEST_DEPT'
        });
      }).toThrow(CrossTenantOperationError);
    });
  });
});

describe('Department Aggregate (Multi-tenant + Hierarchy)', () => {
  let tenant: Tenant;
  let organization: Organization;

  beforeEach(() => {
    tenant = Tenant.create({
      name: '测试租户',
      subdomain: 'test'
    });
    
    organization = Organization.create({
      tenantId: tenant.id,
      name: '测试组织',
      code: 'TEST_ORG'
    });
  });

  describe('部门层级操作', () => {
    it('应该正确创建子部门并维护层级关系', async () => {
      // Given
      const parentDept = Department.create({
        tenantId: tenant.id,
        organizationId: organization.id,
        name: '父部门',
        code: 'PARENT_DEPT'
      });

      // When
      const childDept = parentDept.createSubDepartment({
        name: '子部门',
        code: 'CHILD_DEPT'
      });

      // Then
      expect(childDept.tenantId.equals(tenant.id)).toBe(true);
      expect(childDept.parentDepartmentId?.equals(parentDept.id)).toBe(true);
      expect(childDept.level).toBe(parentDept.level + 1);
      expect(childDept.path.isDescendantOf(parentDept.path)).toBe(true);
    });

    it('应该禁止跨租户移动部门', () => {
      // Given
      const otherTenant = Tenant.create({
        name: '其他租户',
        subdomain: 'other'
      });
      
      const dept = Department.create({
        tenantId: tenant.id,
        organizationId: organization.id,
        name: '测试部门',
        code: 'TEST_DEPT'
      });

      const otherTenantDept = Department.create({
        tenantId: otherTenant.id,
        organizationId: OrganizationId.create(),
        name: '其他部门',
        code: 'OTHER_DEPT'
      });

      // When & Then
      expect(() => {
        dept.moveTo(otherTenantDept);
      }).toThrow(CrossTenantOperationError);
    });
  });
});
```

## 🔍 多租户设计决策

### 8.1 多租户隔离策略

| 场景 | 推荐方案 | 理由 |
|------|----------|------|
| **数据隔离** | Schema 级别隔离 | 完全的数据隔离，性能好 |
| **租户识别** | JWT + 请求头 | 灵活支持多种客户端 |
| **超级租户** | 特殊权限标记 | 系统级管理能力 |
| **跨租户查询** | 显式权限检查 | 防止数据泄露 |

### 8.2 租户上下文传递

```typescript
// 租户上下文值对象
export class TenantContext extends ValueObject {
  constructor(
    public readonly tenantId: TenantId,
    public readonly tenantName: string,
    public readonly isSuperAdmin: boolean = false
  ) {
    super();
  }

  // 创建超级管理员上下文
  static superAdmin(): TenantContext {
    return new TenantContext(
      TenantId.create('system'),
      'System',
      true
    );
  }

  // 检查跨租户权限
  canAccessTenant(targetTenantId: TenantId): boolean {
    return this.isSuperAdmin || this.tenantId.equals(targetTenantId);
  }
}
```

### 8.3 多租户事件溯源

```typescript
// 多租户事件溯源聚合根
export abstract class MultiTenantEventSourcedAggregateRoot extends MultiTenantAggregateRoot {
  private _version: number = 0;

  public get version(): number {
    return this._version;
  }

  // 应用事件 (包含租户验证)
  protected applyEvent(event: MultiTenantDomainEvent): void {
    // 验证事件租户一致性
    if (!this.tenantId.equals(event.tenantId)) {
      throw new CrossTenantEventError('事件租户与聚合根租户不一致');
    }

    this._version++;
    // 具体的状态变更逻辑在子类中实现
  }

  // 从历史事件重建
  public static reconstitute<T extends MultiTenantEventSourcedAggregateRoot>(
    this: new (...args: any[]) => T,
    events: MultiTenantDomainEvent[]
  ): T {
    if (events.length === 0) {
      throw new EmptyEventStreamError('事件流不能为空');
    }

    const firstEvent = events[0];
    const aggregate = new this(firstEvent.tenantId);
    
    events.forEach(event => {
      aggregate.applyEvent(event);
    });

    return aggregate;
  }
}
```

## ✅ 总结

### 9.1 多租户领域层核心价值

1. **完整租户隔离**: 所有领域对象显式包含租户上下文
2. **数据安全**: 自动防止跨租户数据访问
3. **业务一致性**: 租户特定的业务规则和验证
4. **灵活扩展**: 支持复杂的组织-部门层级结构

### 9.2 关键特性

- **租户感知聚合根**: 所有聚合根继承 `MultiTenantAggregateRoot`
- **租户上下文事件**: 领域事件携带完整的租户信息
- **层级数据权限**: 支持组织-部门层级的权限继承
- **超级租户支持**: 系统级管理租户的特殊权限

### 9.3 合规性保证

- **数据隔离**: Schema 级别隔离，满足数据保护要求
- **审计追踪**: 完整的租户操作日志
- **权限控制**: 细粒度的跨租户访问控制

这套多租户领域层设计为企业级 SaaS 应用提供了安全、可扩展的领域模型基础。

---
*文档版本: 2.0 | 最后更新: 2024-11-XX | 特性: 多租户增强 + 数据隔离*