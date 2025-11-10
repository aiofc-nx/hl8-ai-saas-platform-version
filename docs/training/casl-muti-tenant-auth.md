# 基于 CASL 的多租户认证授权全栈设计规范

## 📋 文档概述

本文档定义基于 CASL + NestJS + DDD + Clean Architecture 的完整多租户认证授权解决方案。通过 CASL 的声明式权限管理，实现灵活、强大且类型安全的权限控制系统。

## 🏗 架构总览

### 1.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                   基于 CASL 的多租户认证授权架构              │
├─────────────────────────────────────────────────────────────┤
│  接口层  │ CASL守卫 → 策略装饰器 → 能力注入 → 异常处理        │
├─────────────────────────────────────────────────────────────┤
│  应用层  │ 能力工厂 → CASL用例 → 查询过滤 → 上下文传递        │
├─────────────────────────────────────────────────────────────┤
│  领域层  │ 权限策略 → 条件规则 → 领域能力 → 权限聚合根        │
├─────────────────────────────────────────────────────────────┤
│基础设施层│ CASL存储 → 规则引擎 → 缓存服务 → 审计日志          │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件

```typescript
// 核心类型定义
interface AppAbility extends Ability<[Action, AppSubject]> {}
type AppSubject = "all" | SubjectObject | InferSubjects<typeof Entity>;

type Action =
  | "manage" // 所有操作
  | "create" // 创建
  | "read" // 读取
  | "update" // 更新
  | "delete" // 删除
  | "export" // 导出
  | "invite" // 邀请
  | string; // 自定义操作

interface CaslPermission {
  action: Action;
  subject: AppSubject;
  conditions?: Conditions;
  inverted?: boolean;
  reason?: string;
}
```

## 🎯 领域层设计

### 2.1 核心领域模型

```typescript
// 权限策略聚合根
export class PermissionPolicy extends AggregateRoot {
  constructor(
    public readonly id: PermissionPolicyId,
    private name: string,
    private description: string,
    private rules: PolicyRule[],
    private target: PolicyTarget,
    private isActive: boolean,
    private priority: number,
    private createdAt: DateTime,
    private updatedAt: DateTime,
  ) {
    super();
  }

  // 创建权限策略
  static create(creation: PolicyCreation): PermissionPolicy {
    const policy = new PermissionPolicy(PermissionPolicyId.create(), creation.name, creation.description, creation.rules, creation.target, true, creation.priority || 0, DateTime.now(), DateTime.now());

    policy.addDomainEvent(new PermissionPolicyCreatedEvent(policy.id));
    return policy;
  }

  // 评估权限
  evaluate(context: PolicyContext): PolicyResult {
    if (!this.isActive) {
      return PolicyResult.denied("策略未激活");
    }

    for (const rule of this.rules) {
      const result = rule.evaluate(context);
      if (!result.allowed) {
        return result;
      }
    }

    return PolicyResult.allowed();
  }

  // 转换为 CASL 规则
  toCaslRules(tenantId: TenantId): RawRuleOf<AppAbility>[] {
    return this.rules.map((rule) => ({
      action: rule.action,
      subject: rule.subject,
      conditions: rule.conditions,
      inverted: rule.inverted,
      reason: rule.reason,
      // 自动添加租户隔离条件
      conditions: {
        ...rule.conditions,
        tenantId: tenantId.value,
      },
    }));
  }
}

// 策略规则值对象
export class PolicyRule extends ValueObject {
  constructor(
    public readonly action: Action,
    public readonly subject: AppSubject,
    public readonly conditions?: Conditions,
    public readonly inverted: boolean = false,
    public readonly reason?: string,
  ) {
    super();
    this.validate();
  }

  evaluate(context: PolicyContext): PolicyResult {
    try {
      // 应用条件评估
      const matches = this.evaluateConditions(context);
      const allowed = this.inverted ? !matches : matches;

      return allowed ? PolicyResult.allowed() : PolicyResult.denied(this.reason || "规则不匹配");
    } catch (error) {
      return PolicyResult.denied("规则评估失败");
    }
  }

  private evaluateConditions(context: PolicyContext): boolean {
    if (!this.conditions) return true;

    return this.evaluateConditionObject(this.conditions, context);
  }

  private evaluateConditionObject(conditions: any, context: PolicyContext): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      if (!this.evaluateCondition(key, value, context)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(key: string, value: any, context: PolicyContext): boolean {
    // 实现复杂的条件评估逻辑
    if (typeof value === "object" && value !== null) {
      return this.evaluateOperatorCondition(key, value, context);
    }

    return context.getFieldValue(key) === value;
  }

  private evaluateOperatorCondition(key: string, operator: any, context: PolicyContext): boolean {
    // 支持 CASL 操作符: $eq, $ne, $in, $nin, $gt, $gte, $lt, $lte, $elemMatch
    for (const [op, opValue] of Object.entries(operator)) {
      const fieldValue = context.getFieldValue(key);

      switch (op) {
        case "$eq":
          return fieldValue === opValue;
        case "$ne":
          return fieldValue !== opValue;
        case "$in":
          return Array.isArray(opValue) && opValue.includes(fieldValue);
        case "$nin":
          return Array.isArray(opValue) && !opValue.includes(fieldValue);
        case "$gt":
          return fieldValue > opValue;
        case "$gte":
          return fieldValue >= opValue;
        case "$lt":
          return fieldValue < opValue;
        case "$lte":
          return fieldValue <= opValue;
        default:
          return false;
      }
    }
    return false;
  }
}
```

### 2.2 CASL 能力工厂

```typescript
// 领域服务 - CASL 能力工厂
@DomainService()
export class DomainCaslAbilityFactory {
  constructor(
    private readonly policyRepository: PermissionPolicyRepository,
    private readonly tenantRepository: TenantRepository,
    private readonly userRepository: UserRepository,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  // 创建用户能力定义
  async createForUser(user: User, tenant: Tenant): Promise<AppAbility> {
    return createMongoAbility<AppAbility>(await this.buildAbilityRules(user, tenant), {
      // 自定义条件匹配器
      conditionsMatcher: (conditions, object) => this.conditionsMatcher(conditions, object),

      // 字段匹配器
      fieldMatcher: (field, fields) => this.fieldMatcher(field, fields),

      // 主题类型检测
      detectSubjectType: (subject) => this.detectSubjectType(subject),
    });
  }

  private async buildAbilityRules(user: User, tenant: Tenant): Promise<RawRuleOf<AppAbility>[]> {
    const rules: RawRuleOf<AppAbility>[] = [];

    // 1. 基础状态规则
    rules.push(...this.buildBaseRules(user, tenant));

    // 2. 租户成员规则
    if (user.tenantId.equals(tenant.id)) {
      rules.push(...(await this.buildTenantMemberRules(user, tenant)));
    }

    // 3. 全局管理员规则
    if (user.isSuperAdmin()) {
      rules.push(...this.buildSuperAdminRules());
    }

    // 4. 动态策略规则
    rules.push(...(await this.buildDynamicPolicyRules(user, tenant)));

    // 5. 订阅限制规则
    rules.push(...(await this.buildSubscriptionRules(tenant)));

    return rules;
  }

  private buildBaseRules(user: User, tenant: Tenant): RawRuleOf<AppAbility>[] {
    const rules: RawRuleOf<AppAbility>[] = [];

    // 用户必须激活
    if (!user.isActive()) {
      return rules; // 无权限
    }

    // 租户必须激活
    if (!tenant.isActive()) {
      return rules;
    }

    // 基础读取权限
    rules.push({
      action: "read",
      subject: "Tenant",
      conditions: { id: tenant.id.value },
    });

    return rules;
  }

  private async buildTenantMemberRules(user: User, tenant: Tenant): Promise<RawRuleOf<AppAbility>[]> {
    const rules: RawRuleOf<AppAbility>[] = [];
    const tenantUser = await this.tenantUserRepository.findByUserAndTenant(user.id, tenant.id);

    if (!tenantUser || !tenantUser.isActive()) {
      return rules;
    }

    // 基于租户角色的规则
    for (const role of tenantUser.roles) {
      rules.push(...this.buildRoleBasedRules(role, user, tenant));
    }

    // 直接权限规则
    for (const permission of tenantUser.permissions) {
      rules.push(...this.buildDirectPermissionRules(permission, user, tenant));
    }

    return rules;
  }

  private buildRoleBasedRules(role: TenantRole, user: User, tenant: Tenant): RawRuleOf<AppAbility>[] {
    const rules: RawRuleOf<AppAbility>[] = [];

    switch (role.name) {
      case "OWNER":
        rules.push({
          action: "manage",
          subject: "all",
          conditions: { tenantId: tenant.id.value },
        });
        break;

      case "ADMIN":
        rules.push(
          {
            action: ["read", "create", "update"],
            subject: ["User", "Product", "Order"],
            conditions: { tenantId: tenant.id.value },
          },
          {
            action: "delete",
            subject: ["User", "Product"],
            inverted: true, // 禁止删除
            reason: "管理员不能删除用户和产品",
          },
        );
        break;

      case "MEMBER":
        rules.push(
          {
            action: "create",
            subject: "Order",
            conditions: { tenantId: tenant.id.value },
          },
          {
            action: "read",
            subject: "Order",
            conditions: {
              tenantId: tenant.id.value,
              $or: [{ userId: user.id.value }, { isPublic: true }, { team: { $elemMatch: { userId: user.id.value } } }],
            },
          },
          {
            action: "update",
            subject: "Order",
            conditions: {
              tenantId: tenant.id.value,
              userId: user.id.value,
              status: { $in: ["draft", "pending"] },
            },
          },
        );
        break;
    }

    return rules;
  }

  private async buildDynamicPolicyRules(user: User, tenant: Tenant): Promise<RawRuleOf<AppAbility>[]> {
    const policies = await this.policyRepository.findActiveByTarget(PolicyTarget.forUser(user.id, tenant.id));

    const rules: RawRuleOf<AppAbility>[] = [];

    for (const policy of policies) {
      rules.push(...policy.toCaslRules(tenant.id));
    }

    return rules;
  }

  // 自定义条件匹配器
  private conditionsMatcher(conditions: Conditions, object: SubjectObject): boolean {
    if (typeof conditions !== "object" || conditions === null) {
      return conditions === object;
    }

    return this.matchConditions(conditions, object);
  }

  private matchConditions(conditions: any, object: any): boolean {
    for (const [field, condition] of Object.entries(conditions)) {
      if (!this.matchField(field, condition, object)) {
        return false;
      }
    }
    return true;
  }

  private matchField(field: string, condition: any, object: any): boolean {
    const value = this.getFieldValue(field, object);

    if (typeof condition === "object" && condition !== null) {
      return this.matchOperators(condition, value);
    }

    return value === condition;
  }

  private matchOperators(operators: any, value: any): boolean {
    for (const [operator, expected] of Object.entries(operators)) {
      if (!this.matchOperator(operator, expected, value)) {
        return false;
      }
    }
    return true;
  }

  private matchOperator(operator: string, expected: any, actual: any): boolean {
    switch (operator) {
      case "$eq":
        return actual === expected;
      case "$ne":
        return actual !== expected;
      case "$in":
        return Array.isArray(expected) && expected.includes(actual);
      case "$nin":
        return Array.isArray(expected) && !expected.includes(actual);
      case "$gt":
        return actual > expected;
      case "$gte":
        return actual >= expected;
      case "$lt":
        return actual < expected;
      case "$lte":
        return actual <= expected;
      case "$regex":
        return new RegExp(expected).test(actual);
      case "$elemMatch":
        return Array.isArray(actual) && actual.some((item) => this.matchConditions(expected, item));
      default:
        return false;
    }
  }
}
```

## 🚀 应用层设计

### 3.1 CASL 能力服务

```typescript
// 应用服务 - CASL 能力管理
@Injectable()
export class CaslAbilityService {
  private readonly cache = new LRUCache<string, AppAbility>({
    max: 1000,
    ttl: 5 * 60 * 1000, // 5分钟缓存
  });

  constructor(
    private readonly abilityFactory: DomainCaslAbilityFactory,
    private readonly userRepository: UserRepository,
    private readonly tenantRepository: TenantRepository,
    private readonly logger: Logger,
  ) {}

  // 获取用户能力
  async getAbilityForUser(userId: string, tenantId: string): Promise<AppAbility> {
    const cacheKey = `${userId}:${tenantId}`;

    // 缓存检查
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const [user, tenant] = await Promise.all([this.userRepository.findById(UserId.create(userId)), this.tenantRepository.findById(TenantId.create(tenantId))]);

      if (!user || !tenant) {
        throw new AuthorizationError("用户或租户不存在");
      }

      const ability = await this.abilityFactory.createForUser(user, tenant);

      // 缓存能力
      this.cache.set(cacheKey, ability);

      this.logger.debug(`CASL ability created for user ${userId} in tenant ${tenantId}`);
      return ability;
    } catch (error) {
      this.logger.error(`Failed to create CASL ability: ${error.message}`, error.stack);
      throw new AuthorizationError("权限系统初始化失败");
    }
  }

  // 清理用户缓存
  async clearUserCache(userId: string, tenantId?: string): Promise<void> {
    if (tenantId) {
      this.cache.delete(`${userId}:${tenantId}`);
    } else {
      // 清理用户所有租户的缓存
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.cache.delete(key);
        }
      }
    }
  }

  // 批量获取能力
  async getAbilitiesForUsers(userTenantPairs: Array<{ userId: string; tenantId: string }>): Promise<Map<string, AppAbility>> {
    const abilities = new Map<string, AppAbility>();
    const uncachedPairs = [];

    // 检查缓存
    for (const pair of userTenantPairs) {
      const cacheKey = `${pair.userId}:${pair.tenantId}`;
      const cached = this.cache.get(cacheKey);

      if (cached) {
        abilities.set(cacheKey, cached);
      } else {
        uncachedPairs.push(pair);
      }
    }

    // 批量创建未缓存的能力
    if (uncachedPairs.length > 0) {
      const newAbilities = await this.createAbilitiesForPairs(uncachedPairs);

      for (const [key, ability] of newAbilities) {
        abilities.set(key, ability);
        this.cache.set(key, ability);
      }
    }

    return abilities;
  }

  private async createAbilitiesForPairs(pairs: Array<{ userId: string; tenantId: string }>): Promise<Map<string, AppAbility>> {
    const abilities = new Map<string, AppAbility>();

    // 批量查询用户和租户
    const userIds = [...new Set(pairs.map((p) => p.userId))];
    const tenantIds = [...new Set(pairs.map((p) => p.tenantId))];

    const [users, tenants] = await Promise.all([this.userRepository.findByIds(userIds.map(UserId.create)), this.tenantRepository.findByIds(tenantIds.map(TenantId.create))]);

    const userMap = new Map(users.map((u) => [u.id.value, u]));
    const tenantMap = new Map(tenants.map((t) => [t.id.value, t]));

    // 为每个用户-租户对创建能力
    for (const pair of pairs) {
      const user = userMap.get(pair.userId);
      const tenant = tenantMap.get(pair.tenantId);

      if (user && tenant) {
        try {
          const ability = await this.abilityFactory.createForUser(user, tenant);
          abilities.set(`${pair.userId}:${pair.tenantId}`, ability);
        } catch (error) {
          this.logger.warn(`Failed to create ability for ${pair.userId}:${pair.tenantId}`, error);
        }
      }
    }

    return abilities;
  }
}
```

### 3.2 CASL 增强的用例

```typescript
// 基础 CASL 用例
export abstract class CaslAwareUseCase {
  constructor(
    protected readonly abilityService: CaslAbilityService,
    protected readonly securityContext: SecurityContext,
  ) {}

  // 权限检查快捷方法
  protected async checkPermission(action: Action, subject: AppSubject, field?: string): Promise<void> {
    const ability = await this.abilityService.getAbilityForUser(this.securityContext.userId, this.securityContext.tenantId);

    const canPerform = field ? ability.can(action, subject, field) : ability.can(action, subject);

    if (!canPerform) {
      throw new AuthorizationError(`无权执行操作: ${action} ${typeof subject === "string" ? subject : subject.__typename}`);
    }
  }

  // 过滤可访问的资源
  protected async filterAccessible<T extends SubjectObject>(resources: T[], action: Action = "read"): Promise<T[]> {
    const ability = await this.abilityService.getAbilityForUser(this.securityContext.userId, this.securityContext.tenantId);

    return resources.filter((resource) => ability.can(action, resource));
  }

  // 检查具体资源权限
  protected async checkResourcePermission<T extends SubjectObject>(resource: T, action: Action, field?: string): Promise<void> {
    const ability = await this.abilityService.getAbilityForUser(this.securityContext.userId, this.securityContext.tenantId);

    const canPerform = field ? ability.can(action, resource, field) : ability.can(action, resource);

    if (!canPerform) {
      throw new AuthorizationError(`无权访问资源: ${action} ${resource.__typename || "unknown"}`);
    }
  }
}

// CASL 命令处理器
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler extends CaslAwareUseCase implements ICommandHandler<CreateOrderCommand> {
  constructor(
    abilityService: CaslAbilityService,
    securityContext: SecurityContext,
    private readonly orderRepository: OrderRepository,
    private readonly productService: ProductService,
  ) {
    super(abilityService, securityContext);
  }

  async execute(command: CreateOrderCommand): Promise<OrderResult> {
    // 1. 检查创建订单的权限
    await this.checkPermission("create", "Order");

    // 2. 验证订单项权限
    for (const item of command.items) {
      const product = await this.productService.getProduct(item.productId);
      await this.checkResourcePermission(product, "read");
    }

    // 3. 创建订单
    const order = Order.create({
      ...command,
      userId: UserId.create(this.securityContext.userId),
      tenantId: TenantId.create(this.securityContext.tenantId),
    });

    // 4. 验证对创建后订单的权限
    await this.checkResourcePermission(order, "read");

    await this.orderRepository.save(order);

    return OrderResult.from(order);
  }
}

// CASL 查询处理器
@QueryHandler(GetOrdersQuery)
export class GetOrdersHandler extends CaslAwareUseCase implements IQueryHandler<GetOrdersQuery> {
  constructor(
    abilityService: CaslAbilityService,
    securityContext: SecurityContext,
    private readonly orderRepository: OrderRepository,
    private readonly caslFilter: CaslMikroORMFilter,
  ) {
    super(abilityService, securityContext);
  }

  async execute(query: GetOrdersQuery): Promise<Order[]> {
    // 1. 检查读取订单的权限
    await this.checkPermission("read", "Order");

    // 2. 使用 CASL 过滤条件查询
    const caslConditions = await this.caslFilter.addConditionsToQuery(Order, "read", this.securityContext.userId, this.securityContext.tenantId);

    // 3. 执行查询
    const orders = await this.orderRepository.findByTenant(
      TenantId.create(this.securityContext.tenantId),
      {
        ...query.filters,
        ...caslConditions,
      },
      query.pagination,
    );

    // 4. 二次过滤（确保权限）
    return this.filterAccessible(orders, "read");
  }
}
```

## 🛡 基础设施层设计

### 4.1 CASL 与 MikroORM 集成

```typescript
// CASL 查询过滤器
@Injectable()
export class CaslMikroORMFilter {
  constructor(private readonly abilityService: CaslAbilityService) {}

  // 将 CASL 规则转换为 MikroORM 查询条件
  async addConditionsToQuery<T extends object>(entityClass: EntityClass<T>, action: Action, userId: string, tenantId: string): Promise<FilterQuery<T>> {
    const ability = await this.abilityService.getAbilityForUser(userId, tenantId);
    const rules = ability.rulesFor(action, entityClass);

    if (rules.length === 0) {
      return { id: { $eq: null } } as FilterQuery<T>; // 无权限
    }

    const conditions = rules.map((rule) => this.ruleToMikroORMCondition(rule)).filter((condition) => condition !== null);

    if (conditions.length === 0) {
      return {} as FilterQuery<T>; // 无限制
    }

    // 合并条件：任何规则允许即可
    return { $or: conditions } as FilterQuery<T>;
  }

  private ruleToMikroORMCondition(rule: AnyRule): any {
    // 排除禁止规则
    if (rule.inverted) {
      return null;
    }

    if (!rule.conditions) {
      return {}; // 无限制
    }

    return this.transformConditions(rule.conditions);
  }

  private transformConditions(conditions: any): any {
    const result: any = {};

    for (const [key, value] of Object.entries(conditions)) {
      if (typeof value === "object" && value !== null) {
        result[key] = this.transformOperatorConditions(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private transformOperatorConditions(operators: any): any {
    const result: any = {};

    for (const [operator, value] of Object.entries(operators)) {
      switch (operator) {
        case "$eq":
          result.$eq = value;
          break;
        case "$ne":
          result.$ne = value;
          break;
        case "$in":
          result.$in = value;
          break;
        case "$nin":
          result.$nin = value;
          break;
        case "$gt":
          result.$gt = value;
          break;
        case "$gte":
          result.$gte = value;
          break;
        case "$lt":
          result.$lt = value;
          break;
        case "$lte":
          result.$lte = value;
          break;
        case "$regex":
          result.$re = value;
          break;
        case "$elemMatch":
          result.$elemMatch = this.transformConditions(value);
          break;
        default:
          // 自定义操作符处理
          result[operator] = value;
      }
    }

    return result;
  }

  // 批量过滤
  async filterResources<T extends SubjectObject>(resources: T[], action: Action, userId: string, tenantId: string): Promise<T[]> {
    const ability = await this.abilityService.getAbilityForUser(userId, tenantId);
    return resources.filter((resource) => ability.can(action, resource));
  }
}
```

### 4.2 CASL 审计服务

```typescript
// CASL 审计服务
@Injectable()
export class CaslAuditService {
  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly logger: Logger,
  ) {}

  // 记录权限检查
  async recordPermissionCheck(
    context: SecurityContext,
    action: Action,
    subject: AppSubject,
    granted: boolean,
    details?: {
      resourceId?: string;
      field?: string;
      conditions?: any;
      reason?: string;
    },
  ): Promise<void> {
    const auditLog = PermissionAudit.create({
      userId: context.userId,
      tenantId: context.tenantId,
      sessionId: context.sessionId,
      action,
      subject: typeof subject === "string" ? subject : subject.__typename,
      granted,
      resourceId: details?.resourceId,
      field: details?.field,
      conditions: details?.conditions,
      reason: details?.reason,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    });

    await this.auditRepository.save(auditLog);

    if (!granted) {
      this.logger.warn(`Permission denied: ${action} ${auditLog.subject}`, {
        userId: context.userId,
        tenantId: context.tenantId,
        reason: details?.reason,
      });
    }
  }

  // 记录能力使用情况
  async recordAbilityUsage(context: SecurityContext, ability: AppAbility, duration: number): Promise<void> {
    const usageLog = AbilityUsageAudit.create({
      userId: context.userId,
      tenantId: context.tenantId,
      rulesCount: ability.rules.length,
      duration,
      timestamp: new Date(),
    });

    await this.auditRepository.save(usageLog);
  }
}
```

## 🌐 接口层设计

### 5.1 CASL 守卫和装饰器

```typescript
// CASL 策略处理器类型
export interface CaslPolicyHandler {
  (ability: AppAbility, request: Request): boolean | Promise<boolean>;
}

// CASL 守卫
@Injectable()
export class CaslGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityService: CaslAbilityService,
    private readonly auditService: CaslAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers = this.reflector.get<CaslPolicyHandler[]>("casl_policies", context.getHandler()) || [];

    const request = context.switchToHttp().getRequest();
    const securityContext = request.securityContext;

    if (!securityContext) {
      throw new UnauthorizedException("安全上下文未设置");
    }

    const ability = await this.abilityService.getAbilityForUser(securityContext.userId, securityContext.tenantId);

    // 执行所有策略检查
    for (const handler of policyHandlers) {
      const startTime = Date.now();
      const result = await handler(ability, request);
      const duration = Date.now() - startTime;

      await this.auditService.recordAbilityUsage(securityContext, ability, duration);

      if (!result) {
        await this.auditService.recordPermissionCheck(securityContext, "access", "Endpoint", false, { reason: "策略检查失败" });
        return false;
      }
    }

    return true;
  }
}

// 策略装饰器工厂
export const CaslPolicies = (...handlers: CaslPolicyHandler[]) => SetMetadata("casl_policies", handlers);

// 常用策略装饰器
export const CheckPolicies = (action: Action, subject: AppSubject, field?: string) => CaslPolicies((ability: AppAbility) => (field ? ability.can(action, subject, field) : ability.can(action, subject)));

export const CheckResourcePolicy = (action: Action, subjectParam: string = "id") =>
  CaslPolicies((ability: AppAbility, request: Request) => {
    const subject = {
      __typename: subjectParam,
      id: request.params[subjectParam],
    };
    return ability.can(action, subject);
  });

export const RequireTenantRole = (role: string) =>
  CaslPolicies((ability: AppAbility, request: Request) => {
    const securityContext = request.securityContext;
    return securityContext.tenantRoles.includes(role);
  });

// 自定义条件策略
export const CheckConditionalPolicy = (action: Action, subject: AppSubject, conditions: (req: Request) => any) =>
  CaslPolicies((ability: AppAbility, request: Request) => {
    const subjectWithConditions = typeof subject === "string" ? subject : { ...subject, ...conditions(request) };
    return ability.can(action, subjectWithConditions);
  });
```

### 5.2 能力注入装饰器

```typescript
// 能力注入装饰器
export const InjectAbility = createParamDecorator((data: unknown, ctx: ExecutionContext): Promise<AppAbility> => {
  const request = ctx.switchToHttp().getRequest();
  const securityContext = request.securityContext;

  if (!securityContext) {
    throw new UnauthorizedException("安全上下文未设置");
  }

  const abilityService = ctx.switchToHttp().getRequest().abilityService;
  return abilityService.getAbilityForUser(securityContext.userId, securityContext.tenantId);
});

// 能力检查装饰器
export const AbilityCheck = (action: Action, subject: AppSubject | ((req: Request) => AppSubject), field?: string) =>
  createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const ability: AppAbility = request.ability;

    if (!ability) {
      throw new AuthorizationError("能力未注入");
    }

    const actualSubject = typeof subject === "function" ? subject(request) : subject;
    const allowed = field ? ability.can(action, actualSubject, field) : ability.can(action, actualSubject);

    if (!allowed) {
      throw new AuthorizationError(`无权执行操作: ${action}`);
    }

    return actualSubject;
  })();
```

### 5.3 控制器实现

```typescript
// 基础控制器
@Controller("api/:tenantId")
@UseGuards(MultiTenantAuthGuard, CaslGuard)
export class CaslAwareController {
  constructor(
    protected readonly abilityService: CaslAbilityService,
    protected readonly commandBus: CommandBus,
    protected readonly queryBus: QueryBus,
  ) {}

  // 注入能力到请求
  @UseInterceptors(AbilityInterceptor)
  protected async injectAbility(request: Request): Promise<void> {
    const securityContext = request.securityContext;
    const ability = await this.abilityService.getAbilityForUser(securityContext.userId, securityContext.tenantId);
    request.ability = ability;
  }
}

// 订单控制器
@Controller("orders")
export class OrderController extends CaslAwareController {
  @Post()
  @CaslPolicies((ability: AppAbility) => ability.can("create", "Order"))
  async createOrder(@SecurityContext() context: SecurityContext, @Body() createOrderDto: CreateOrderRequestDto, @InjectAbility() ability: AppAbility): Promise<ApiResponse<OrderResponseDto>> {
    // 使用注入的能力进行额外检查
    if (createOrderDto.totalAmount > 10000 && !ability.can("create", "LargeOrder")) {
      throw new AuthorizationError("无权创建大额订单");
    }

    const command = new CreateOrderCommand(createOrderDto, context);
    const result = await this.commandBus.execute(command);

    return ApiResponse.success(result);
  }

  @Get()
  @CheckPolicies("read", "Order")
  async getOrders(@SecurityContext() context: SecurityContext, @Query() queryDto: OrderQueryDto, @InjectAbility() ability: AppAbility): Promise<ApiResponse<PaginatedResponse<OrderResponseDto>>> {
    const query = new GetOrdersQuery(context.getCurrentTenantId(), queryDto);

    // 使用能力过滤响应字段
    const orders = await this.queryBus.execute(query);
    const filteredOrders = orders.map((order) => this.filterOrderFields(order, ability));

    return ApiResponse.paginated(filteredOrders, queryDto.pagination);
  }

  @Get(":id")
  @CheckResourcePolicy("read", "id")
  async getOrder(
    @Param("id") orderId: string,
    @AbilityCheck("read", (req) => ({ __typename: "Order", id: req.params.id }))
    orderSubject: any,
  ): Promise<ApiResponse<OrderResponseDto>> {
    const query = new GetOrderQuery(orderId);
    const order = await this.queryBus.execute(query);

    return ApiResponse.success(this.toOrderResponseDto(order));
  }

  @Patch(":id")
  @CheckResourcePolicy("update", "id")
  async updateOrder(@Param("id") orderId: string, @Body() updates: UpdateOrderRequestDto, @InjectAbility() ability: AppAbility): Promise<ApiResponse<OrderResponseDto>> {
    // 检查字段级权限
    if (updates.price && !ability.can("update", "Order", "price")) {
      throw new AuthorizationError("无权更新价格字段");
    }

    if (updates.status && !ability.can("update", "Order", "status")) {
      throw new AuthorizationError("无权更新状态字段");
    }

    const command = new UpdateOrderCommand(orderId, updates);
    const result = await this.commandBus.execute(command);

    return ApiResponse.success(result);
  }

  @Delete(":id")
  @CheckResourcePolicy("delete", "id")
  async deleteOrder(@Param("id") orderId: string): Promise<ApiResponse<void>> {
    const command = new DeleteOrderCommand(orderId);
    await this.commandBus.execute(command);

    return ApiResponse.empty("订单删除成功");
  }

  // 过滤订单字段（基于权限）
  private filterOrderFields(order: Order, ability: AppAbility): any {
    const filtered: any = { id: order.id.value };

    if (ability.can("read", order, "orderNumber")) {
      filtered.orderNumber = order.orderNumber;
    }

    if (ability.can("read", order, "totalAmount")) {
      filtered.totalAmount = order.totalAmount;
    }

    if (ability.can("read", order, "customerInfo")) {
      filtered.customerInfo = order.customerInfo;
    }

    if (ability.can("read", order, "internalNotes")) {
      filtered.internalNotes = order.internalNotes;
    }

    return filtered;
  }
}

// 租户管理控制器
@Controller("tenant")
@RequireTenantRole("OWNER")
export class TenantManagementController extends CaslAwareController {
  @Post("users/invite")
  @CheckPolicies("invite", "User")
  async inviteUser(@SecurityContext() context: SecurityContext, @Body() inviteDto: InviteUserRequestDto, @InjectAbility() ability: AppAbility): Promise<ApiResponse<InvitationResponseDto>> {
    // 检查是否可以邀请特定角色的用户
    if (!ability.can("invite", { __typename: "User", role: inviteDto.role })) {
      throw new AuthorizationError(`无权邀请 ${inviteDto.role} 角色用户`);
    }

    const command = new InviteUserCommand(inviteDto, context);
    const result = await this.commandBus.execute(command);

    return ApiResponse.success(result);
  }

  @Get("analytics")
  @CheckConditionalPolicy("read", "Analytics", (req) => ({
    type: req.query.type,
    dateRange: {
      start: req.query.startDate,
      end: req.query.endDate,
    },
  }))
  async getAnalytics(@Query() query: AnalyticsQueryDto): Promise<ApiResponse<AnalyticsResponseDto>> {
    const analyticsQuery = new GetAnalyticsQuery(query);
    const result = await this.queryBus.execute(analyticsQuery);

    return ApiResponse.success(result);
  }
}
```

### 5.4 异常处理

```typescript
// CASL 异常过滤器
@Catch(ForbiddenError, AuthorizationError)
export class CaslExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CaslExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status: number;
    let message: string;
    let code: string;

    if (exception instanceof ForbiddenError) {
      status = HttpStatus.FORBIDDEN;
      message = "权限不足";
      code = "FORBIDDEN";

      this.logger.warn(`CASL ForbiddenError: ${exception.message}`, {
        userId: request.securityContext?.userId,
        action: exception.action,
        subject: exception.subject,
      });
    } else if (exception instanceof AuthorizationError) {
      status = HttpStatus.FORBIDDEN;
      message = exception.message;
      code = "AUTHORIZATION_ERROR";
    } else {
      status = HttpStatus.FORBIDDEN;
      message = "访问被拒绝";
      code = "ACCESS_DENIED";
    }

    const errorResponse: ErrorResponseDto = {
      success: false,
      error: {
        code,
        message,
        action: (exception as any).action,
        subject: (exception as any).subject,
        path: request.url,
        timestamp: new Date().toISOString(),
        requestId: request.headers["x-request-id"],
      },
    };

    response.status(status).json(errorResponse);
  }
}
```

## 🔧 配置和模块

### 6.1 CASL 模块配置

```typescript
@Module({
  imports: [
    CqrsModule,
    // 其他模块...
  ],
  providers: [
    // 能力服务
    DomainCaslAbilityFactory,
    CaslAbilityService,

    // 查询过滤
    CaslMikroORMFilter,

    // 审计
    CaslAuditService,

    // 守卫和拦截器
    CaslGuard,
    AbilityInterceptor,

    // 异常处理
    CaslExceptionFilter,

    // 仓库
    {
      provide: PermissionPolicyRepository,
      useClass: MikroORMPermissionPolicyRepository,
    },
  ],
  exports: [CaslAbilityService, CaslMikroORMFilter, DomainCaslAbilityFactory],
})
export class CaslModule {}

// 全局注册
@Module({
  imports: [
    CaslModule,
    // 其他模块...
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: CaslExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: CaslGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AbilityInterceptor,
    },
  ],
})
export class AppModule {}
```

## ✅ 总结

基于 CASL 的多租户认证授权系统提供：

### 7.1 核心优势

- **声明式权限**: 清晰、可维护的权限定义
- **类型安全**: 完整的 TypeScript 支持
- **复杂条件**: 支持基于时间、数量、关系的复杂权限
- **性能优化**: 能力缓存和批量查询优化
- **审计追踪**: 完整的权限检查日志

### 7.2 架构特点

- **分层设计**: 清晰的职责分离
- **多租户支持**: 完整的租户隔离
- **字段级权限**: 精细化的访问控制
- **前后端一致**: 可共享的权限逻辑

### 7.3 扩展性

- **动态策略**: 运行时权限策略更新
- **插件架构**: 可扩展的条件匹配器
- **监控集成**: 完整的审计和监控

这套设计为企业级多租户应用提供了强大、灵活且安全的权限管理解决方案。

---

_文档版本: 3.0 | 最后更新: 2024-11-XX | 特性: CASL 集成 + 多租户_
