# 多租户认证授权全栈设计规范

## 📋 文档概述

本文档在原有认证授权规范基础上，增加多租户支持。多租户架构要求所有数据和安全上下文都按租户隔离，确保租户间的完全数据隔离。

## 🎯 多租户架构理念

### 1.1 多租户模式选择

本项目采用 **数据库级别隔离** 模式：
- 每个租户拥有独立的数据库 schema
- 共享应用实例，数据完全隔离
- 通过租户上下文自动路由数据访问

### 1.2 核心多租户原则

- **租户隔离**: 所有数据操作必须指定租户上下文
- **租户识别**: 通过子域名、请求头或JWT识别租户
- **上下文传递**: 租户上下文在所有层间传递
- **超级租户**: 系统级管理租户，可管理所有租户数据

## 🏗 多租户领域层设计

### 2.1 核心领域模型扩展

```typescript
// 租户聚合根
export class Tenant extends AggregateRoot {
  constructor(
    public readonly id: TenantId,
    private name: string,
    private subdomain: string,
    private status: TenantStatus,
    private config: TenantConfig,
    private subscription: TenantSubscription,
    private createdAt: DateTime,
    private updatedAt: DateTime
  ) {
    super();
  }

  // 创建新租户
  public static create(registration: TenantRegistration): Tenant {
    const tenant = new Tenant(
      TenantId.create(),
      registration.name,
      registration.subdomain,
      TenantStatus.ACTIVE,
      TenantConfig.default(),
      TenantSubscription.freeTrial(),
      DateTime.now(),
      DateTime.now()
    );

    tenant.addDomainEvent(new TenantCreatedEvent(tenant.id, tenant.subdomain));
    return tenant;
  }

  // 激活租户
  public activate(): void {
    if (this.status === TenantStatus.ACTIVE) {
      return;
    }

    this.status = TenantStatus.ACTIVE;
    this.updatedAt = DateTime.now();
    this.addDomainEvent(new TenantActivatedEvent(this.id));
  }

  // 停用租户
  public deactivate(reason: string): void {
    this.status = TenantStatus.SUSPENDED;
    this.updatedAt = DateTime.now();
    this.addDomainEvent(new TenantDeactivatedEvent(this.id, reason));
  }

  // 更新配置
  public updateConfig(config: Partial<TenantConfig>): void {
    this.config = this.config.merge(config);
    this.updatedAt = DateTime.now();
    this.addDomainEvent(new TenantConfigUpdatedEvent(this.id, this.config));
  }

  // 验证租户状态
  public isActive(): boolean {
    return this.status === TenantStatus.ACTIVE;
  }

  public canLogin(): boolean {
    return this.isActive() && this.subscription.isValid();
  }
}

// 租户用户 - 关联用户和租户
export class TenantUser extends AggregateRoot {
  constructor(
    public readonly id: TenantUserId,
    public readonly tenantId: TenantId,
    public readonly userId: UserId,
    private roles: TenantRole[],
    private permissions: TenantPermission[],
    private status: TenantUserStatus,
    private joinedAt: DateTime,
    private invitedBy?: UserId
  ) {
    super();
  }

  // 邀请用户到租户
  public static invite(
    tenantId: TenantId,
    userId: UserId,
    roles: TenantRole[],
    invitedBy: UserId
  ): TenantUser {
    const tenantUser = new TenantUser(
      TenantUserId.create(),
      tenantId,
      userId,
      roles,
      [],
      TenantUserStatus.INVITED,
      DateTime.now(),
      invitedBy
    );

    tenantUser.addDomainEvent(new UserInvitedToTenantEvent(tenantId, userId, invitedBy));
    return tenantUser;
  }

  // 激活用户
  public activate(): void {
    this.status = TenantUserStatus.ACTIVE;
    this.addDomainEvent(new TenantUserActivatedEvent(this.tenantId, this.userId));
  }

  // 分配角色
  public assignRole(role: TenantRole, assignedBy: UserId): void {
    if (this.roles.some(r => r.equals(role))) {
      return;
    }

    this.roles.push(role);
    this.addDomainEvent(new RoleAssignedToUserEvent(this.tenantId, this.userId, role, assignedBy));
  }

  // 检查租户权限
  public hasTenantPermission(permission: TenantPermission): boolean {
    return this.permissions.includes(permission) || 
           this.roles.some(role => role.hasPermission(permission));
  }

  // 检查租户角色
  public hasTenantRole(role: TenantRole): boolean {
    return this.roles.some(r => r.equals(role));
  }
}

// 租户角色 - 租户内角色定义
export class TenantRole extends ValueObject {
  constructor(
    public readonly tenantId: TenantId,
    public readonly name: string,
    public readonly permissions: TenantPermission[],
    public readonly isSystem: boolean = false
  ) {
    super();
  }

  public hasPermission(permission: TenantPermission): boolean {
    return this.permissions.includes(permission);
  }

  // 预定义租户角色
  static owner(tenantId: TenantId): TenantRole {
    return new TenantRole(tenantId, 'OWNER', [
      TenantPermission.USER_MANAGE,
      TenantPermission.ROLE_MANAGE,
      TenantPermission.BILLING_MANAGE,
      TenantPermission.SETTINGS_MANAGE
    ], true);
  }

  static admin(tenantId: TenantId): TenantRole {
    return new TenantRole(tenantId, 'ADMIN', [
      TenantPermission.USER_MANAGE,
      TenantPermission.ORDER_MANAGE,
      TenantPermission.PRODUCT_MANAGE
    ], true);
  }

  static member(tenantId: TenantId): TenantRole {
    return new TenantRole(tenantId, 'MEMBER', [
      TenantPermission.ORDER_CREATE,
      TenantPermission.ORDER_VIEW_OWN,
      TenantPermission.PROFILE_VIEW
    ], true);
  }
}
```

### 2.2 多租户领域服务

```typescript
// 多租户认证服务
export interface MultiTenantAuthenticationService {
  authenticate(credentials: LoginCredentials, tenantId: TenantId): Promise<User>;
  validateToken(token: string): Promise<{ user: User; tenant: Tenant }>;
}

// 多租户授权服务
export interface MultiTenantAuthorizationService {
  checkTenantPermission(
    user: User, 
    tenant: Tenant, 
    permission: TenantPermission, 
    resource?: Resource
  ): Promise<boolean>;
  
  getUserTenants(userId: UserId): Promise<Tenant[]>;
  getUserTenantPermissions(userId: UserId, tenantId: TenantId): Promise<TenantPermission[]>;
}

// 实现
@DomainService()
export class DefaultMultiTenantAuthService implements MultiTenantAuthenticationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tenantRepository: TenantRepository,
    private readonly tenantUserRepository: TenantUserRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async authenticate(credentials: LoginCredentials, tenantId: TenantId): Promise<User> {
    // 1. 验证租户
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant || !tenant.canLogin()) {
      throw new TenantNotAccessibleError('租户不可用');
    }

    // 2. 验证用户
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new InvalidCredentialsError('用户名或密码错误');
    }

    // 3. 验证用户属于该租户
    const tenantUser = await this.tenantUserRepository.findByUserAndTenant(user.id, tenantId);
    if (!tenantUser || tenantUser.status !== TenantUserStatus.ACTIVE) {
      throw new UserNotInTenantError('用户不属于该租户');
    }

    // 4. 验证密码
    const isValid = await user.authenticate(credentials.password);
    if (!isValid) {
      throw new InvalidCredentialsError('用户名或密码错误');
    }

    return user;
  }

  async validateToken(token: string): Promise<{ user: User; tenant: Tenant }> {
    // 实现令牌验证逻辑，返回用户和租户信息
    const tokenService = new JwtTokenService(/* ... */);
    const payload = await tokenService.verifyAccessToken(token);
    
    const [user, tenant] = await Promise.all([
      this.userRepository.findById(UserId.create(payload.sub)),
      this.tenantRepository.findById(TenantId.create(payload.tenantId))
    ]);

    if (!user || !tenant) {
      throw new InvalidTokenError('令牌无效');
    }

    // 验证用户仍属于租户
    const tenantUser = await this.tenantUserRepository.findByUserAndTenant(user.id, tenant.id);
    if (!tenantUser || tenantUser.status !== TenantUserStatus.ACTIVE) {
      throw new UserNotInTenantError('用户已从租户中移除');
    }

    return { user, tenant };
  }
}
```

## 🚀 多租户应用层设计

### 3.1 多租户安全上下文

```typescript
// 多租户安全上下文
export class MultiTenantSecurityContext {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly tenantId: string,
    public readonly tenantName: string,
    public readonly tenantRoles: string[],
    public readonly tenantPermissions: string[],
    public readonly globalRoles: string[],
    public readonly globalPermissions: string[],
    public readonly sessionId: string,
    public readonly ipAddress: string,
    public readonly userAgent: string
  ) {}

  static fromUserAndTenant(
    user: User, 
    tenant: Tenant, 
    tenantUser: TenantUser,
    additionalInfo: Partial<MultiTenantSecurityContext> = {}
  ): MultiTenantSecurityContext {
    return new MultiTenantSecurityContext(
      user.id.value,
      user.email.value,
      tenant.id.value,
      tenant.name,
      tenantUser.roles.map(role => role.name),
      tenantUser.permissions.map(p => p.toString()),
      user.roles.map(role => role.name),
      user.permissions.map(p => p.toString()),
      additionalInfo.sessionId || ulid(),
      additionalInfo.ipAddress || '',
      additionalInfo.userAgent || ''
    );
  }

  // 租户权限检查
  hasTenantPermission(permission: string): boolean {
    return this.tenantPermissions.includes(permission);
  }

  hasTenantRole(role: string): boolean {
    return this.tenantRoles.includes(role);
  }

  // 全局权限检查
  hasGlobalPermission(permission: string): boolean {
    return this.globalPermissions.includes(permission);
  }

  isTenantOwner(): boolean {
    return this.hasTenantRole('OWNER');
  }

  isSuperAdmin(): boolean {
    return this.hasGlobalRole('SUPER_ADMIN');
  }

  // 获取当前租户ID
  getCurrentTenantId(): TenantId {
    return TenantId.create(this.tenantId);
  }
}
```

### 3.2 多租户用例

```typescript
// 多租户登录用例
@CommandHandler(MultiTenantLoginCommand)
export class MultiTenantLoginHandler implements ICommandHandler<MultiTenantLoginCommand> {
  constructor(
    private readonly multiTenantAuthService: MultiTenantAuthenticationService,
    private readonly tokenService: TokenService,
    private readonly eventPublisher: EventPublisher
  ) {}

  async execute(command: MultiTenantLoginCommand): Promise<LoginResult> {
    const tenantId = TenantId.create(command.tenantIdentifier);
    
    // 使用多租户认证服务
    const user = await this.multiTenantAuthService.authenticate(
      {
        email: command.email,
        password: command.password
      },
      tenantId
    );

    // 获取租户信息
    const tenant = await this.tenantRepository.findById(tenantId);
    const tenantUser = await this.tenantUserRepository.findByUserAndTenant(user.id, tenantId);

    // 生成多租户令牌
    const tokens = await this.tokenService.generateMultiTenantTokenPair(user, tenant);

    // 发布领域事件
    this.eventPublisher.publishAll(user.getUncommittedEvents());

    return LoginResult.create(user, tenant, tenantUser, tokens);
  }
}

// 租户切换用例
@CommandHandler(SwitchTenantCommand)
export class SwitchTenantHandler implements ICommandHandler<SwitchTenantCommand> {
  constructor(
    private readonly multiTenantAuthService: MultiTenantAuthorizationService,
    private readonly tokenService: TokenService
  ) {}

  async execute(command: SwitchTenantCommand): Promise<TokenPair> {
    // 验证用户有权访问目标租户
    const userTenants = await this.multiTenantAuthService.getUserTenants(command.context.userId);
    const targetTenant = userTenants.find(t => t.id.value === command.targetTenantId);
    
    if (!targetTenant) {
      throw new TenantAccessDeniedError('无权访问该租户');
    }

    // 生成新令牌
    const user = await this.userRepository.findById(command.context.userId);
    return await this.tokenService.generateMultiTenantTokenPair(user, targetTenant);
  }
}
```

## 🛡 多租户基础设施层

### 4.1 多租户令牌服务

```typescript
@Injectable()
export class MultiTenantJwtTokenService implements TokenService {
  async generateMultiTenantTokenPair(user: User, tenant: Tenant): Promise<TokenPair> {
    const payload = this.buildMultiTenantTokenPayload(user, tenant);
    
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload)
    ]);

    return { accessToken, refreshToken };
  }

  private buildMultiTenantTokenPayload(user: User, tenant: Tenant): any {
    // 获取租户特定权限
    const tenantUser = await this.tenantUserRepository.findByUserAndTenant(user.id, tenant.id);
    
    return {
      sub: user.id.value,
      email: user.email.value,
      tenantId: tenant.id.value,
      tenantName: tenant.name,
      tenantRoles: tenantUser.roles.map(role => role.name),
      tenantPermissions: tenantUser.permissions.map(p => p.toString()),
      globalRoles: user.roles.map(role => role.name),
      globalPermissions: user.permissions.map(p => p.toString()),
      iss: 'multi-tenant-system',
      iat: Math.floor(Date.now() / 1000)
    };
  }

  async verifyAccessToken(token: string): Promise<MultiTenantTokenPayload> {
    const payload = await super.verifyAccessToken(token);
    return this.validateMultiTenantPayload(payload);
  }

  private validateMultiTenantPayload(payload: any): MultiTenantTokenPayload {
    if (!payload.tenantId) {
      throw new InvalidTokenError('缺少租户信息');
    }

    return {
      ...payload,
      tenantId: payload.tenantId,
      tenantRoles: payload.tenantRoles || [],
      tenantPermissions: payload.tenantPermissions || []
    };
  }
}
```

### 4.2 多租户数据源路由

```typescript
@Injectable()
export class TenantAwareDataSource implements DataSource {
  constructor(
    private readonly dataSourceFactory: DataSourceFactory,
    private readonly tenantContext: TenantContext
  ) {}

  async getRepository<T>(entityClass: new () => T): Promise<Repository<T>> {
    const tenantId = this.tenantContext.getCurrentTenant();
    const dataSource = await this.dataSourceFactory.getDataSource(tenantId);
    
    return dataSource.getRepository(entityClass);
  }

  async transaction<T>(work: (repository: Repository<any>) => Promise<T>): Promise<T> {
    const tenantId = this.tenantContext.getCurrentTenant();
    const dataSource = await this.dataSourceFactory.getDataSource(tenantId);
    
    return dataSource.transaction(work);
  }
}
```

## 🌐 多租户接口层设计

### 5.1 租户识别中间件

```typescript
@Injectable()
export class TenantIdentificationMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly tenantContext: TenantContext
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantIdentifier = this.extractTenantIdentifier(req);
      const tenant = await this.tenantRepository.findByIdentifier(tenantIdentifier);
      
      if (!tenant || !tenant.isActive()) {
        throw new TenantNotFoundError('租户不存在或不可用');
      }

      // 设置租户上下文
      this.tenantContext.setCurrentTenant(tenant.id);
      
      next();
    } catch (error) {
      next(error);
    }
  }

  private extractTenantIdentifier(req: Request): string {
    // 1. 从子域名识别 (tenant1.app.com)
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];
    
    if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
      return subdomain;
    }

    // 2. 从请求头识别
    const headerTenant = req.headers['x-tenant-id'];
    if (headerTenant) {
      return headerTenant as string;
    }

    // 3. 从JWT令牌识别（在认证后）
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const payload = this.decodeToken(token);
      if (payload?.tenantId) {
        return payload.tenantId;
      }
    }

    throw new TenantNotIdentifiedError('无法识别租户');
  }

  private decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch {
      return null;
    }
  }
}
```

### 5.2 多租户认证守卫

```typescript
@Injectable()
export class MultiTenantAuthGuard implements CanActivate {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tenantContext: TenantContext
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('未提供访问令牌');
    }

    try {
      // 验证令牌并获取用户和租户信息
      const { user, tenant } = await this.commandBus.execute(new ValidateMultiTenantTokenCommand(token));
      
      // 获取租户用户关联信息
      const tenantUser = await this.tenantUserRepository.findByUserAndTenant(user.id, tenant.id);

      // 构建多租户安全上下文
      const securityContext = MultiTenantSecurityContext.fromUserAndTenant(
        user,
        tenant,
        tenantUser,
        {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent']
        }
      );

      // 设置请求上下文
      request.user = user;
      request.tenant = tenant;
      request.securityContext = securityContext;

      // 确保租户上下文一致
      this.tenantContext.setCurrentTenant(tenant.id);

      return true;

    } catch (error) {
      throw new UnauthorizedException('多租户认证失败');
    }
  }
}
```

### 5.3 租户权限守卫

```typescript
@Injectable()
export class TenantPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly commandBus: CommandBus
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'tenantPermissions',
      context.getHandler()
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const securityContext = request.securityContext as MultiTenantSecurityContext;

    if (!securityContext) {
      throw new UnauthorizedException('安全上下文未设置');
    }

    // 租户所有者拥有所有权限
    if (securityContext.isTenantOwner()) {
      return true;
    }

    // 检查每个所需租户权限
    for (const permission of requiredPermissions) {
      const hasPermission = securityContext.hasTenantPermission(permission);
      
      if (!hasPermission) {
        throw new ForbiddenException(`缺少租户权限: ${permission}`);
      }
    }

    return true;
  }
}
```

### 5.4 控制器使用示例

```typescript
@Controller('api/:tenantId')
@UseGuards(MultiTenantAuthGuard)
export class TenantAwareController {
  @Get('profile')
  @UseGuards(TenantPermissionGuard)
  @SetMetadata('tenantPermissions', ['profile:view'])
  async getProfile(
    @SecurityContext() context: MultiTenantSecurityContext
  ): Promise<ApiResponse<ProfileResponseDto>> {
    // 自动使用当前租户上下文
    const query = new GetUserProfileQuery(context.userId, context.getCurrentTenantId());
    const profile = await this.queryBus.execute(query);
    
    return ApiResponse.success(profile);
  }

  @Post('orders')
  @UseGuards(TenantPermissionGuard)
  @SetMetadata('tenantPermissions', ['order:create'])
  async createOrder(
    @SecurityContext() context: MultiTenantSecurityContext,
    @Body() createOrderDto: CreateOrderRequestDto
  ): Promise<ApiResponse<OrderResponseDto>> {
    const command = new CreateOrderCommand(createOrderDto, context);
    const result = await this.commandBus.execute(command);
    
    return ApiResponse.success(result);
  }
}

// 系统级管理接口（超级管理员）
@Controller('system')
@UseGuards(MultiTenantAuthGuard)
export class SystemAdminController {
  @Get('tenants')
  @UseGuards(GlobalPermissionGuard)
  @SetMetadata('globalPermissions', ['system:tenant:view'])
  async getAllTenants(
    @SecurityContext() context: MultiTenantSecurityContext
  ): Promise<ApiResponse<TenantListResponseDto>> {
    // 超级管理员可以查看所有租户
    const query = new GetAllTenantsQuery();
    const tenants = await this.queryBus.execute(query);
    
    return ApiResponse.success(tenants);
  }
}
```

## 🔧 多租户配置

### 6.1 租户配置管理

```typescript
@Injectable()
export class TenantConfigService {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async getTenantConfig(tenantId: TenantId): Promise<TenantConfig> {
    const tenant = await this.tenantRepository.findById(tenantId);
    return tenant.config;
  }

  async updateTenantConfig(
    tenantId: TenantId, 
    updates: Partial<TenantConfig>,
    updatedBy: UserId
  ): Promise<void> {
    const tenant = await this.tenantRepository.findById(tenantId);
    tenant.updateConfig(updates);
    
    await this.tenantRepository.save(tenant);
  }
}
```

## ✅ 多租户架构总结

通过以上设计，我们实现了完整的多租户认证授权系统：

1. **租户隔离**: 所有数据操作通过租户上下文自动隔离
2. **灵活识别**: 支持多种租户识别方式（子域名、请求头、JWT）
3. **权限分层**: 全局权限 + 租户权限的双层权限体系
4. **上下文传递**: 租户上下文在所有架构层间无缝传递
5. **管理界面**: 系统级超级管理员 + 租户级管理员

这种设计确保了租户数据的完全隔离，同时提供了灵活的管理和权限控制能力。

---
*文档版本: 2.0 | 最后更新: 2024-11-XX | 特性: 多租户支持*