# 认证授权全栈设计规范

## 📋 文档概述

本文档定义了基于 DDD + Clean Architecture + CQRS + ES + EDA 混合架构的认证授权全栈设计规范。认证授权作为系统的横切关注点，需要在所有架构层中协同工作。

## 🎯 核心设计理念

### 1.1 认证授权架构定位

**认证授权**是系统的**安全基石**和**访问控制中枢**，贯穿所有架构层：

```
┌─────────────────────────────────────────────────────────────┐
│                   认证授权全栈架构                            │
├─────────────────────────────────────────────────────────────┤
│  接口层  │ 守卫 → 认证上下文 → 应用层 → 领域服务 → 基础设施     │
├─────────────────────────────────────────────────────────────┤
│  应用层  │ 认证用例 │ 授权用例 │ 安全上下文传递                │
├─────────────────────────────────────────────────────────────┤
│  领域层  │ 用户聚合 │ 权限规则 │ 安全领域服务                  │
├─────────────────────────────────────────────────────────────┤
│基础设施层│ JWT实现 │ 加密服务 │ 权限存储 │ 审计日志            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心原则

- **分层协作**: 每层承担明确的认证授权职责
- **领域驱动**: 安全规则在领域层定义和验证
- **上下文传递**: 安全上下文在各层间无损传递
- **最小权限**: 基于角色的访问控制 + 资源级权限
- **可审计性**: 完整的操作日志和审计追踪

## 🏗 领域层设计规范

### 2.1 核心领域模型

```typescript
// 用户聚合根
export class User extends AggregateRoot {
  constructor(
    public readonly id: UserId,
    private email: Email,
    private passwordHash: PasswordHash,
    private status: UserStatus,
    private profile: UserProfile,
    private roles: UserRole[] = [],
    private permissions: Permission[] = [],
    private lastLoginAt?: DateTime,
    private loginAttempts: number = 0
  ) {
    super();
  }

  // 核心业务方法
  public static async create(registration: UserRegistration): Promise<User> {
    const passwordHash = await PasswordHash.hash(registration.password);
    
    const user = new User(
      UserId.create(),
      new Email(registration.email),
      passwordHash,
      UserStatus.ACTIVE,
      UserProfile.create(registration.profile),
      [UserRole.MEMBER] // 默认角色
    );

    user.addDomainEvent(new UserRegisteredEvent(user.id, user.email));
    return user;
  }

  // 认证相关方法
  public async authenticate(plainPassword: string): Promise<boolean> {
    if (this.status !== UserStatus.ACTIVE) {
      throw new UserInactiveError('用户账户未激活');
    }

    const isValid = await this.passwordHash.verify(plainPassword);
    
    if (isValid) {
      this.recordSuccessfulLogin();
    } else {
      this.recordFailedLogin();
    }

    return isValid;
  }

  public async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!await this.authenticate(oldPassword)) {
      throw new InvalidCredentialsError('原密码不正确');
    }

    this.passwordHash = await PasswordHash.hash(newPassword);
    this.addDomainEvent(new PasswordChangedEvent(this.id));
  }

  // 授权相关方法
  public hasPermission(permission: Permission): boolean {
    return this.permissions.includes(permission) || 
           this.roles.some(role => role.hasPermission(permission));
  }

  public hasRole(role: UserRole): boolean {
    return this.roles.includes(role);
  }

  public assignRole(role: UserRole, assignedBy: UserId): void {
    if (this.hasRole(role)) {
      return;
    }

    this.roles.push(role);
    this.addDomainEvent(new RoleAssignedEvent(this.id, role, assignedBy));
  }

  public isOwnerOf(resource: OwnableResource): boolean {
    return resource.isOwnedBy(this.id);
  }

  // 状态管理
  public deactivate(reason: string, deactivatedBy: UserId): void {
    this.status = UserStatus.INACTIVE;
    this.addDomainEvent(new UserDeactivatedEvent(this.id, reason, deactivatedBy));
  }

  public lockAccount(): void {
    if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      this.status = UserStatus.LOCKED;
      this.addDomainEvent(new AccountLockedEvent(this.id));
    }
  }

  private recordSuccessfulLogin(): void {
    this.lastLoginAt = DateTime.now();
    this.loginAttempts = 0;
    this.addDomainEvent(new UserLoggedInEvent(this.id, this.lastLoginAt));
  }

  private recordFailedLogin(): void {
    this.loginAttempts++;
    if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      this.lockAccount();
    }
    this.addDomainEvent(new LoginFailedEvent(this.id, this.loginAttempts));
  }
}

// 值对象 - 用户角色
export class UserRole extends ValueObject {
  constructor(
    public readonly name: string,
    public readonly permissions: Permission[],
    public readonly level: number,
    public readonly isSystem: boolean = false
  ) {
    super();
    this.validate();
  }

  public hasPermission(permission: Permission): boolean {
    return this.permissions.includes(permission);
  }

  public canAssign(other: UserRole): boolean {
    return this.level > other.level;
  }

  private validate(): void {
    if (this.level < 0) {
      throw new InvalidRoleError('角色等级不能为负数');
    }
  }

  // 预定义系统角色
  static readonly SUPER_ADMIN = new UserRole('SUPER_ADMIN', [
    Permission.USER_MANAGE,
    Permission.ROLE_MANAGE,
    Permission.SYSTEM_MANAGE
  ], 100, true);

  static readonly ADMIN = new UserRole('ADMIN', [
    Permission.USER_VIEW,
    Permission.ORDER_MANAGE,
    Permission.PRODUCT_MANAGE
  ], 90);

  static readonly MEMBER = new UserRole('MEMBER', [
    Permission.ORDER_CREATE,
    Permission.ORDER_VIEW_OWN,
    Permission.PROFILE_MANAGE
  ], 10);
}

// 值对象 - 权限
export class Permission extends ValueObject {
  constructor(
    public readonly resource: string,
    public readonly action: string,
    public readonly scope: PermissionScope = PermissionScope.GLOBAL
  ) {
    super();
  }

  public toString(): string {
    return `${this.resource}:${this.action}`;
  }

  public static fromString(permissionString: string): Permission {
    const [resource, action] = permissionString.split(':');
    return new Permission(resource, action);
  }

  // 预定义权限
  static readonly USER_MANAGE = new Permission('user', 'manage');
  static readonly USER_VIEW = new Permission('user', 'view');
  static readonly ORDER_CREATE = new Permission('order', 'create');
  static readonly ORDER_VIEW_OWN = new Permission('order', 'view_own');
  static readonly ORDER_MANAGE = new Permission('order', 'manage');
}
```

### 2.2 领域服务

```typescript
// 认证领域服务
export interface AuthenticationDomainService {
  authenticate(credentials: LoginCredentials): Promise<User>;
  validateToken(token: string): Promise<User>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
}

// 授权领域服务
export interface AuthorizationDomainService {
  checkPermission(user: User, permission: Permission, resource?: Resource): Promise<boolean>;
  checkOwnership(user: User, resourceType: string, resourceId: string): Promise<boolean>;
  getUserPermissions(userId: UserId): Promise<Permission[]>;
}

// 密码策略服务
export interface PasswordPolicyService {
  validate(password: string): ValidationResult;
  generateStrongPassword(): string;
}

// 实现
@DomainService()
export class DefaultAuthenticationService implements AuthenticationDomainService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService
  ) {}

  async authenticate(credentials: LoginCredentials): Promise<User> {
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new InvalidCredentialsError('用户名或密码错误');
    }

    const isValid = await user.authenticate(credentials.password);
    if (!isValid) {
      throw new InvalidCredentialsError('用户名或密码错误');
    }

    return user;
  }

  async validateToken(token: string): Promise<User> {
    const payload = await this.tokenService.verifyAccessToken(token);
    return await this.userRepository.findById(UserId.create(payload.sub));
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    const user = await this.userRepository.findById(UserId.create(payload.sub));
    
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new InvalidTokenError('刷新令牌无效');
    }

    return await this.tokenService.generateTokenPair(user);
  }
}
```

## 🚀 应用层设计规范

### 3.1 认证授权用例

```typescript
// 登录用例
@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    private readonly authService: AuthenticationDomainService,
    private readonly tokenService: TokenService,
    private readonly eventPublisher: EventPublisher,
    private readonly loginAuditService: LoginAuditService
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    // 调用领域服务认证
    const user = await this.authService.authenticate({
      email: command.email,
      password: command.password
    });

    // 生成令牌
    const tokens = await this.tokenService.generateTokenPair(user);
    
    // 记录审计日志
    await this.loginAuditService.recordSuccess(
      user.id, 
      command.ipAddress, 
      command.userAgent
    );

    // 发布领域事件
    user.clearEvents(); // 认证过程中可能产生的事件
    this.eventPublisher.publishAll(user.getUncommittedEvents());

    return LoginResult.create(user, tokens);
  }
}

// 权限检查用例
@CommandHandler(CheckPermissionCommand)
export class CheckPermissionHandler implements ICommandHandler<CheckPermissionCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authService: AuthorizationDomainService
  ) {}

  async execute(command: CheckPermissionCommand): Promise<boolean> {
    const user = await this.userRepository.findById(command.context.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const permission = Permission.fromString(command.permissionString);
    
    return await this.authService.checkPermission(
      user,
      permission,
      command.resource
    );
  }
}

// 令牌验证用例
@CommandHandler(ValidateTokenCommand)
export class ValidateTokenHandler implements ICommandHandler<ValidateTokenCommand> {
  constructor(
    private readonly authService: AuthenticationDomainService,
    private readonly userRepository: UserRepository
  ) {}

  async execute(command: ValidateTokenCommand): Promise<User> {
    const user = await this.authService.validateToken(command.token);
    
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new InvalidTokenError('令牌无效或用户状态异常');
    }

    return user;
  }
}
```

### 3.2 安全上下文

```typescript
// 安全上下文 - 在各层间传递
export class SecurityContext {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly roles: string[],
    public readonly permissions: string[],
    public readonly sessionId: string,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    public readonly issuedAt: Date
  ) {}

  static fromUser(user: User, additionalInfo: Partial<SecurityContext> = {}): SecurityContext {
    return new SecurityContext(
      user.id.value,
      user.email.value,
      user.roles.map(role => role.name),
      user.permissions.map(p => p.toString()),
      additionalInfo.sessionId || ulid(),
      additionalInfo.ipAddress || '',
      additionalInfo.userAgent || '',
      additionalInfo.issuedAt || new Date()
    );
  }

  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }

  isSuperAdmin(): boolean {
    return this.hasRole(UserRole.SUPER_ADMIN.name);
  }

  // 用于审计日志
  toAuditContext(): AuditContext {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      timestamp: new Date()
    };
  }
}

// 安全上下文装饰器
export const SecurityContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SecurityContext => {
    const request = ctx.switchToHttp().getRequest();
    const context = request.securityContext;
    
    if (!context) {
      throw new SecurityContextMissingError('安全上下文未设置');
    }
    
    return context;
  }
);
```

## 🛡 基础设施层设计规范

### 4.1 令牌服务实现

```typescript
@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly logger: Logger
  ) {}

  async generateTokenPair(user: User): Promise<TokenPair> {
    const payload = this.buildTokenPayload(user);
    
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload)
    ]);

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.configService.get('JWT_ACCESS_SECRET')) as any;
      return this.validateTokenPayload(payload);
    } catch (error) {
      this.logger.warn(`Access token verification failed: ${error.message}`);
      throw new InvalidTokenError('访问令牌无效');
    }
  }

  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.configService.get('JWT_REFRESH_SECRET')) as any;
      return this.validateTokenPayload(payload);
    } catch (error) {
      this.logger.warn(`Refresh token verification failed: ${error.message}`);
      throw new InvalidTokenError('刷新令牌无效');
    }
  }

  private buildTokenPayload(user: User): any {
    return {
      sub: user.id.value,
      email: user.email.value,
      roles: user.roles.map(role => role.name),
      permissions: user.permissions.map(p => p.toString()),
      iss: 'order-system',
      iat: Math.floor(Date.now() / 1000)
    };
  }

  private async generateAccessToken(payload: any): Promise<string> {
    return jwt.sign(
      { ...payload, type: 'access' },
      this.configService.get('JWT_ACCESS_SECRET'),
      {
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', '1h'),
        jwtid: ulid() // 唯一的JWT ID
      }
    );
  }

  private async generateRefreshToken(payload: any): Promise<string> {
    return jwt.sign(
      { ...payload, type: 'refresh' },
      this.configService.get('JWT_REFRESH_SECRET'),
      {
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        jwtid: ulid()
      }
    );
  }

  private validateTokenPayload(payload: any): TokenPayload {
    if (!payload.sub || !payload.email) {
      throw new InvalidTokenError('令牌负载不完整');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      type: payload.type
    };
  }
}
```

### 4.2 密码加密服务

```typescript
@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  private readonly saltRounds = 12;

  async hash(plainPassword: string): Promise<PasswordHash> {
    const hash = await bcrypt.hash(plainPassword, this.saltRounds);
    return new PasswordHash(hash);
  }

  async verify(plainPassword: string, hash: PasswordHash): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hash.value);
  }
}
```

## 🌐 接口层设计规范

### 5.1 认证守卫

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly commandBus: CommandBus,
    private readonly logger: Logger
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('未提供访问令牌');
    }

    try {
      // 使用应用层用例验证令牌
      const user = await this.commandBus.execute(new ValidateTokenCommand(token));
      
      // 构建安全上下文
      const securityContext = SecurityContext.fromUser(user, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        sessionId: this.extractSessionId(token)
      });

      // 设置请求上下文
      request.user = user;
      request.securityContext = securityContext;

      this.logger.debug(`User ${user.id.value} authenticated successfully`);
      return true;

    } catch (error) {
      this.logger.warn(`Authentication failed: ${error.message}`);
      throw new UnauthorizedException('认证失败');
    }
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private extractSessionId(token: string): string {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded.jti || ulid();
    } catch {
      return ulid();
    }
  }
}
```

### 5.2 授权守卫

```typescript
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly commandBus: CommandBus
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler()
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const securityContext = request.securityContext;

    if (!securityContext) {
      throw new UnauthorizedException('安全上下文未设置');
    }

    // 超级管理员拥有所有权限
    if (securityContext.isSuperAdmin()) {
      return true;
    }

    // 检查每个所需权限
    for (const permission of requiredPermissions) {
      const hasPermission = await this.commandBus.execute(
        new CheckPermissionCommand(securityContext, permission)
      );

      if (!hasPermission) {
        throw new ForbiddenException(`缺少权限: ${permission}`);
      }
    }

    return true;
  }
}

// 资源所有权守卫
@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly commandBus: CommandBus
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resourceType = this.reflector.get<string>('resourceType', context.getHandler());
    const idParam = this.reflector.get<string>('idParam', context.getHandler());

    const request = context.switchToHttp().getRequest();
    const securityContext = request.securityContext;
    const resourceId = request.params[idParam];

    if (!securityContext || !resourceId) {
      return false;
    }

    // 超级管理员可以访问所有资源
    if (securityContext.isSuperAdmin()) {
      return true;
    }

    const isOwner = await this.commandBus.execute(
      new CheckResourceOwnershipCommand(
        securityContext.userId,
        resourceType,
        resourceId
      )
    );

    if (!isOwner) {
      throw new ForbiddenException('无权访问该资源');
    }

    return true;
  }
}
```

### 5.3 控制器使用示例

```typescript
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('login')
  @Public()
  async login(
    @Body() loginDto: LoginRequestDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string
  ): Promise<ApiResponse<LoginResponseDto>> {
    const command = new LoginCommand(loginDto.email, loginDto.password, ipAddress, userAgent);
    const result = await this.commandBus.execute(command);
    
    return ApiResponse.success(this.toLoginResponseDto(result));
  }

  @Post('refresh')
  @Public()
  async refreshToken(@Body() refreshDto: RefreshTokenRequestDto): Promise<ApiResponse<TokenResponseDto>> {
    const command = new RefreshTokenCommand(refreshDto.refreshToken);
    const tokens = await this.commandBus.execute(command);
    
    return ApiResponse.success(this.toTokenResponseDto(tokens));
  }
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('order:create')
  async createOrder(
    @SecurityContext() context: SecurityContext,
    @Body() createOrderDto: CreateOrderRequestDto
  ): Promise<ApiResponse<OrderResponseDto>> {
    const command = new PlaceOrderCommand(createOrderDto, context);
    const result = await this.commandBus.execute(command);
    
    return ApiResponse.success(this.toOrderResponseDto(result));
  }

  @Get(':id')
  @UseGuards(ResourceOwnershipGuard)
  @SetMetadata('resourceType', 'order')
  async getOrder(
    @SecurityContext() context: SecurityContext,
    @Param('id') orderId: string
  ): Promise<ApiResponse<OrderResponseDto>> {
    const query = new GetOrderQuery(orderId, context.userId);
    const order = await this.queryBus.execute(query);
    
    return ApiResponse.success(this.toOrderResponseDto(order));
  }
}
```

## 📊 审计与监控

### 6.1 安全审计

```typescript
@Injectable()
export class SecurityAuditService {
  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly logger: Logger
  ) {}

  async recordAuthentication(
    userId: string,
    action: AuthAction,
    success: boolean,
    context: AuditContext,
    details?: any
  ): Promise<void> {
    const auditLog = AuthenticationAudit.create({
      userId,
      action,
      success,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      details
    });

    await this.auditRepository.save(auditLog);

    if (!success) {
      this.logger.warn(`Authentication failure: ${action} for user ${userId}`, {
        ip: context.ipAddress,
        details
      });
    }
  }

  async recordAuthorization(
    userId: string,
    resource: string,
    action: string,
    granted: boolean,
    context: AuditContext
  ): Promise<void> {
    const auditLog = AuthorizationAudit.create({
      userId,
      resource,
      action,
      granted,
      ipAddress: context.ipAddress,
      timestamp: context.timestamp,
      sessionId: context.sessionId
    });

    await this.auditRepository.save(auditLog);

    if (!granted) {
      this.logger.warn(`Authorization denied: ${action} on ${resource} for user ${userId}`);
    }
  }
}
```

## 🔧 配置管理

### 7.1 安全配置

```typescript
@Injectable()
export class SecurityConfig {
  // JWT 配置
  get jwtConfig(): JwtConfig {
    return {
      accessSecret: this.getRequired('JWT_ACCESS_SECRET'),
      refreshSecret: this.getRequired('JWT_REFRESH_SECRET'),
      accessExpiresIn: this.get('JWT_ACCESS_EXPIRES_IN', '1h'),
      refreshExpiresIn: this.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      issuer: this.get('JWT_ISSUER', 'order-system')
    };
  }

  // 密码策略配置
  get passwordPolicy(): PasswordPolicy {
    return {
      minLength: parseInt(this.get('PASSWORD_MIN_LENGTH', '8')),
      requireUppercase: this.get('PASSWORD_REQUIRE_UPPERCASE', 'true') === 'true',
      requireLowercase: this.get('PASSWORD_REQUIRE_LOWERCASE', 'true') === 'true',
      requireNumbers: this.get('PASSWORD_REQUIRE_NUMBERS', 'true') === 'true',
      requireSymbols: this.get('PASSWORD_REQUIRE_SYMBOLS', 'false') === 'true',
      maxAgeDays: parseInt(this.get('PASSWORD_MAX_AGE_DAYS', '90'))
    };
  }

  // 登录安全配置
  get loginSecurity(): LoginSecurityConfig {
    return {
      maxAttempts: parseInt(this.get('LOGIN_MAX_ATTEMPTS', '5')),
      lockoutDuration: parseInt(this.get('LOGIN_LOCKOUT_DURATION', '900')), // 15分钟
      requireEmailVerification: this.get('REQUIRE_EMAIL_VERIFICATION', 'true') === 'true'
    };
  }
}
```

## ✅ 总结

本规范确立了认证授权全栈设计的核心原则：

1. **领域驱动安全**: 安全规则在领域层定义和验证
2. **分层协作**: 每层承担明确的认证授权职责
3. **上下文传递**: 安全上下文在各层间无损传递
4. **最小权限**: 基于角色的访问控制 + 资源级权限
5. **全面审计**: 完整的操作日志和安全监控
6. **防御性编程**: 多重验证和错误处理

通过这种全栈设计，我们构建了一个安全、可扩展、可维护的认证授权系统，为整个应用提供坚实的安全保障。

---
*文档版本: 1.0 | 最后更新: 2024-11-XX | 适用项目: NestJS DDD 混合架构项目*