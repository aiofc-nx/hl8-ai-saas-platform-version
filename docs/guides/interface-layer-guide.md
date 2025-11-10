# 接口层设计规范 (多租户增强版)

## 📋 文档概述

本文档在原有接口层设计规范基础上，增加多租户和数据隔离支持。所有接口层组件都需要显式处理租户上下文，确保API层面的租户隔离和安全。

## 🎯 核心设计理念

### 1.1 多租户接口层定位

**接口层**是系统的**多租户对外门户**和**协议适配器**，在 Clean Architecture 中处于最外层，负责：

- 识别和验证租户身份
- 传递租户上下文到应用层
- 实现租户级别的API路由和权限控制
- 提供租户特定的API文档和错误处理

### 1.2 多租户核心原则

- **租户识别**: 通过子域名、请求头、JWT等多种方式识别租户
- **租户上下文传递**: 所有请求必须包含明确的租户信息
- **租户数据隔离**: API响应自动过滤租户数据
- **租户特定配置**: 支持租户自定义的API行为和限制

### 1.3 示例约定

- **✅ 可直接落地示例**：包含完整依赖注入、装饰器与 Nest 组件声明，可直接复制使用。
- **⚠️ 伪代码示意**：用于说明流程或概念的代码段，可能省略底层实现或上下文配置，文内会显式标注。

## 🏗 多租户接口层结构

### 2.1 分层与职责 (多租户增强)

```
interfaces/
├── rest/                          # 多租户 REST API
│   ├── controllers/               # 多租户控制器
│   ├── dtos/                      # 多租户请求/响应 DTO
│   ├── pipes/                     # 多租户验证管道
│   ├── filters/                   # 多租户异常过滤器
│   ├── guards/                    # 多租户守卫
│   ├── interceptors/              # 多租户拦截器
│   ├── decorators/                # 多租户装饰器
│   ├── assemblers/                # 多租户装配器
│   └── multi-tenant/              # 多租户支持
│       ├── tenant-identification/ # 租户识别
│       ├── tenant-routing/        # 租户路由
│       └── tenant-context/        # 租户上下文
├── graphql/                       # 多租户 GraphQL
├── websockets/                    # 多租户 WebSocket
├── rpc/                           # 多租户 gRPC
└── cli/                           # 多租户命令行
```

## 🌐 多租户 REST API 设计规范

### 3.1 多租户控制器设计

```typescript
// 多租户控制器基类
export abstract class MultiTenantController {
  protected readonly logger = InjectLogger(this.constructor.name); // 来源: @hl8/logger

  // 获取当前租户上下文
  protected getCurrentTenantContext(@TenantContext() context: TenantContext): TenantContext {
    if (!context) {
      throw new TenantNotIdentifiedError("无法识别租户上下文");
    }
    return context;
  }

  // 构建安全上下文
  protected buildSecurityContext(tenantContext: TenantContext, user: CurrentUserDto): SecurityContext {
    return {
      tenantId: tenantContext.tenantId.value,
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      sessionId: ulid(),
      ipAddress: "127.0.0.1", // 从请求中获取
      userAgent: "unknown", // 从请求中获取
    };
  }
}

// 租户管理控制器
@ApiTags("tenants")
@Controller("tenants")
@UseGuards(MultiTenantAuthGuard, SuperAdminGuard)
export class TenantController extends MultiTenantController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly tenantAssembler: TenantAssembler,
  ) {
    super();
  }

  @Post()
  @ApiOperation({ summary: "创建租户", description: "系统管理员创建新租户" })
  @ApiResponse({
    status: 201,
    description: "租户创建成功",
    type: TenantResponseDto,
  })
  async createTenant(@Body() createTenantDto: CreateTenantRequestDto, @CurrentUser() user: CurrentUserDto): Promise<ApiResponse<TenantResponseDto>> {
    const command = this.tenantAssembler.toCreateTenantCommand(createTenantDto, user.id);
    const tenant = await this.commandBus.execute(command);

    const response = this.tenantAssembler.toTenantResponseDto(tenant);
    return ApiResponse.success(response, "租户创建成功");
  }

  @Get()
  @ApiOperation({ summary: "获取租户列表", description: "系统管理员获取所有租户" })
  async getTenants(@Query() queryDto: TenantQueryRequestDto, @CurrentUser() user: CurrentUserDto): Promise<ApiResponse<PaginatedResponse<TenantResponseDto>>> {
    const query = this.tenantAssembler.toTenantQuery(queryDto);
    const paginatedResult = await this.queryBus.execute(query);

    const response = this.tenantAssembler.toPaginatedTenantResponse(paginatedResult);
    return ApiResponse.success(response);
  }
}

// 组织管理控制器
@ApiTags("organizations")
@Controller("organizations")
@UseGuards(MultiTenantAuthGuard, TenantPermissionGuard)
export class OrganizationController extends MultiTenantController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly organizationAssembler: OrganizationAssembler,
  ) {
    super();
  }

  @Post()
  @TenantPermissions("organization:create")
  @ApiOperation({ summary: "创建组织", description: "在当前租户下创建组织" })
  async createOrganization(@TenantContext() tenantContext: TenantContext, @CurrentUser() user: CurrentUserDto, @Body() createDto: CreateOrganizationRequestDto): Promise<ApiResponse<OrganizationResponseDto>> {
    const securityContext = this.buildSecurityContext(tenantContext, user);

    const command = this.organizationAssembler.toCreateOrganizationCommand(createDto, securityContext);

    const organizationId = await this.commandBus.execute(command);

    return ApiResponse.success({ id: organizationId.value }, "组织创建成功");
  }

  @Get()
  @TenantPermissions("organization:read")
  @ApiOperation({ summary: "获取组织列表", description: "获取当前租户下的组织列表" })
  async getOrganizations(@TenantContext() tenantContext: TenantContext, @CurrentUser() user: CurrentUserDto, @Query() queryDto: OrganizationQueryRequestDto): Promise<ApiResponse<PaginatedResponse<OrganizationResponseDto>>> {
    const securityContext = this.buildSecurityContext(tenantContext, user);

    const query = this.organizationAssembler.toOrganizationQuery(queryDto, securityContext);
    const paginatedResult = await this.queryBus.execute(query);

    const response = this.organizationAssembler.toPaginatedOrganizationResponse(paginatedResult);
    return ApiResponse.success(response);
  }

  @Get(":id")
  @TenantResourcePermissions("organization:read", "id")
  @ApiOperation({ summary: "获取组织详情" })
  async getOrganization(@TenantContext() tenantContext: TenantContext, @CurrentUser() user: CurrentUserDto, @Param("id") organizationId: string): Promise<ApiResponse<OrganizationDetailResponseDto>> {
    const securityContext = this.buildSecurityContext(tenantContext, user);

    const query = new GetOrganizationDetailQuery(OrganizationId.create(organizationId), securityContext);

    const organization = await this.queryBus.execute(query);
    const response = this.organizationAssembler.toOrganizationDetailResponseDto(organization);

    return ApiResponse.success(response);
  }
}

// 部门管理控制器
@ApiTags("departments")
@Controller("organizations/:organizationId/departments")
@UseGuards(MultiTenantAuthGuard, TenantPermissionGuard)
export class DepartmentController extends MultiTenantController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly departmentAssembler: DepartmentAssembler,
  ) {
    super();
  }

  @Post()
  @TenantPermissions("department:create")
  @ApiOperation({ summary: "创建部门" })
  async createDepartment(@TenantContext() tenantContext: TenantContext, @CurrentUser() user: CurrentUserDto, @Param("organizationId") organizationId: string, @Body() createDto: CreateDepartmentRequestDto): Promise<ApiResponse<DepartmentResponseDto>> {
    const securityContext = this.buildSecurityContext(tenantContext, user);

    const command = this.departmentAssembler.toCreateDepartmentCommand(createDto, OrganizationId.create(organizationId), securityContext);

    const departmentId = await this.commandBus.execute(command);

    return ApiResponse.success({ id: departmentId.value }, "部门创建成功");
  }

  @Get("tree")
  @TenantPermissions("department:read")
  @ApiOperation({ summary: "获取部门树" })
  async getDepartmentTree(@TenantContext() tenantContext: TenantContext, @CurrentUser() user: CurrentUserDto, @Param("organizationId") organizationId: string): Promise<ApiResponse<DepartmentTreeResponseDto>> {
    const securityContext = this.buildSecurityContext(tenantContext, user);

    const query = new GetDepartmentTreeQuery(OrganizationId.create(organizationId), securityContext);

    const departmentTree = await this.queryBus.execute(query);
    const response = this.departmentAssembler.toDepartmentTreeResponseDto(departmentTree);

    return ApiResponse.success(response);
  }

  @Patch(":id/move")
  @TenantResourcePermissions("department:move", "id")
  @ApiOperation({ summary: "移动部门" })
  async moveDepartment(@TenantContext() tenantContext: TenantContext, @CurrentUser() user: CurrentUserDto, @Param("id") departmentId: string, @Body() moveDto: MoveDepartmentRequestDto): Promise<ApiResponse<void>> {
    const securityContext = this.buildSecurityContext(tenantContext, user);

    const command = new MoveDepartmentCommand(
      {
        departmentId: DepartmentId.create(departmentId),
        newParentDepartmentId: DepartmentId.create(moveDto.newParentId),
      },
      securityContext,
    );

    await this.commandBus.execute(command);

    return ApiResponse.empty("部门移动成功");
  }
}
```

> 数据隔离提示：接口层需确保请求路径和上下文中的 `tenantId`、`organizationId`、`departmentId` 一致。例如：
>
> - 解析路由参数后，结合 `TenantContext` 构造 `SecurityContext`，确保命令/查询在应用层执行前即可校验租户级隔离。
> - 在 `DepartmentController` 中，`organizationId` 与 `tenantContext` 同时传递给命令，底层处理器会再次校验组织归属，形成租户 → 组织 → 部门三级防线。

### 3.2 多租户 DTO 设计规范

```typescript
// 多租户请求 DTO 基类
export abstract class MultiTenantRequestDto {
  @ApiProperty({ description: "租户ID", required: false })
  @IsOptional()
  @IsUUID()
  tenantId?: string; // 可选，通常从上下文中获取
}

// 创建组织请求 DTO
export class CreateOrganizationRequestDto extends MultiTenantRequestDto {
  @ApiProperty({ description: "组织名称" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: "组织代码" })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z0-9_]{3,20}$/)
  code: string;

  @ApiProperty({ description: "组织描述", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: "组织设置", required: false })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

// 创建部门请求 DTO
export class CreateDepartmentRequestDto extends MultiTenantRequestDto {
  @ApiProperty({ description: "部门名称" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: "部门代码" })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z0-9_]{3,20}$/)
  code: string;

  @ApiProperty({ description: "父部门ID", required: false })
  @IsOptional()
  @IsUUID()
  parentDepartmentId?: string;

  @ApiProperty({ description: "部门设置", required: false })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

// 多租户响应 DTO
export class TenantResponseDto {
  @ApiProperty({ description: "租户ID" })
  id: string;

  @ApiProperty({ description: "租户名称" })
  name: string;

  @ApiProperty({ description: "子域名" })
  subdomain: string;

  @ApiProperty({ description: "租户状态", enum: TenantStatus })
  status: TenantStatus;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;
}

export class OrganizationResponseDto {
  @ApiProperty({ description: "组织ID" })
  id: string;

  @ApiProperty({ description: "租户ID" })
  tenantId: string;

  @ApiProperty({ description: "组织名称" })
  name: string;

  @ApiProperty({ description: "组织代码" })
  code: string;

  @ApiProperty({ description: "组织状态", enum: OrganizationStatus })
  status: OrganizationStatus;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;
}

export class OrganizationDetailResponseDto extends OrganizationResponseDto {
  @ApiProperty({ description: "部门数量" })
  departmentCount: number;

  @ApiProperty({ description: "成员数量" })
  memberCount: number;

  @ApiProperty({ description: "组织设置" })
  settings: Record<string, any>;
}

export class DepartmentResponseDto {
  @ApiProperty({ description: "部门ID" })
  id: string;

  @ApiProperty({ description: "租户ID" })
  tenantId: string;

  @ApiProperty({ description: "组织ID" })
  organizationId: string;

  @ApiProperty({ description: "部门名称" })
  name: string;

  @ApiProperty({ description: "部门代码" })
  code: string;

  @ApiProperty({ description: "部门路径" })
  path: string;

  @ApiProperty({ description: "部门层级" })
  level: number;

  @ApiProperty({ description: "父部门ID", required: false })
  parentDepartmentId?: string;
}

export class DepartmentTreeResponseDto {
  @ApiProperty({ description: "组织信息" })
  organization: OrganizationResponseDto;

  @ApiProperty({ description: "部门树", type: [DepartmentTreeNodeDto] })
  departments: DepartmentTreeNodeDto[];
}

export class DepartmentTreeNodeDto {
  @ApiProperty({ description: "部门信息" })
  department: DepartmentResponseDto;

  @ApiProperty({ description: "子部门", type: [DepartmentTreeNodeDto] })
  children: DepartmentTreeNodeDto[];
}
```

### 3.3 多租户装配器设计

```typescript
// 多租户装配器基类
export abstract class MultiTenantAssembler {
  protected validateTenantContext(securityContext: SecurityContext): void {
    if (!securityContext.tenantId) {
      throw new MissingTenantContextError("安全上下文缺少租户信息");
    }
  }
}

// 组织装配器
@Injectable()
export class OrganizationAssembler extends MultiTenantAssembler {
  constructor(
    private readonly validationService: ValidationService,
    private readonly logger: AppLoggerService /* 来源: @hl8/logger */,
  ) {
    super();
  }

  toCreateOrganizationCommand(dto: CreateOrganizationRequestDto, securityContext: SecurityContext): CreateOrganizationCommand {
    this.validateTenantContext(securityContext);

    // 验证业务规则
    this.validationService.validateOrganizationCode(dto.code);

    return new CreateOrganizationCommand({
      name: dto.name,
      code: dto.code,
      description: dto.description,
      settings: dto.settings,
      securityContext,
    });
  }

  toOrganizationQuery(dto: OrganizationQueryRequestDto, securityContext: SecurityContext): OrganizationQuery {
    this.validateTenantContext(securityContext);

    return new OrganizationQuery({
      securityContext,
      status: dto.status,
      search: dto.search,
      pagination: {
        page: dto.page || 1,
        pageSize: dto.pageSize || 20,
        sortBy: dto.sortBy,
        sortOrder: dto.sortOrder,
      },
    });
  }

  toOrganizationResponseDto(organization: Organization): OrganizationResponseDto {
    return {
      id: organization.id.value,
      tenantId: organization.tenantId.value,
      name: organization.name,
      code: organization.code,
      status: organization.status,
      createdAt: organization.createdAt.toJSDate(),
    };
  }

  toOrganizationDetailResponseDto(organization: Organization): OrganizationDetailResponseDto {
    const baseResponse = this.toOrganizationResponseDto(organization);

    return {
      ...baseResponse,
      departmentCount: organization.departments.length,
      memberCount: organization.memberCount,
      settings: organization.settings,
    };
  }

  toPaginatedOrganizationResponse(paginatedResult: Paginated<Organization>): PaginatedResponse<OrganizationResponseDto> {
    return {
      items: paginatedResult.items.map((org) => this.toOrganizationResponseDto(org)),
      pagination: {
        page: paginatedResult.page,
        pageSize: paginatedResult.pageSize,
        total: paginatedResult.total,
        totalPages: paginatedResult.totalPages,
        hasNext: paginatedResult.hasNext,
        hasPrev: paginatedResult.hasPrev,
      },
    };
  }
}

// 部门装配器
@Injectable()
export class DepartmentAssembler extends MultiTenantAssembler {
  toCreateDepartmentCommand(dto: CreateDepartmentRequestDto, organizationId: OrganizationId, securityContext: SecurityContext): CreateDepartmentCommand {
    this.validateTenantContext(securityContext);

    return new CreateDepartmentCommand({
      organizationId,
      name: dto.name,
      code: dto.code,
      parentDepartmentId: dto.parentDepartmentId ? DepartmentId.create(dto.parentDepartmentId) : undefined,
      settings: dto.settings,
      securityContext,
    });
  }

  toDepartmentResponseDto(department: Department): DepartmentResponseDto {
    return {
      id: department.id.value,
      tenantId: department.tenantId.value,
      organizationId: department.organizationId.value,
      name: department.name,
      code: department.code,
      path: department.path.value,
      level: department.level,
      parentDepartmentId: department.parentDepartmentId?.value,
      createdAt: department.createdAt.toJSDate(),
    };
  }

  toDepartmentTreeResponseDto(departmentTree: DepartmentTree): DepartmentTreeResponseDto {
    const buildTreeNode = (node: DepartmentTreeNode): DepartmentTreeNodeDto => {
      return {
        department: this.toDepartmentResponseDto(node.department),
        children: node.children.map(buildTreeNode),
      };
    };

    return {
      organization: departmentTree.organization,
      departments: departmentTree.rootDepartments.map(buildTreeNode),
    };
  }
}
```

## 🔒 多租户安全与验证规范

### 4.1 多租户装饰器

```typescript
// 租户上下文装饰器
export const TenantContext = createParamDecorator((data: unknown, ctx: ExecutionContext): TenantContext => {
  const request = ctx.switchToHttp().getRequest();
  const context = request.tenantContext;

  if (!context) {
    throw new TenantNotIdentifiedError("请求缺少租户上下文");
  }

  return context;
});

// 租户权限装饰器
export const TenantPermissions = (...permissions: string[]) => SetMetadata("tenantPermissions", permissions);

// 租户资源权限装饰器
export const TenantResourcePermissions = (permission: string, idParam: string = "id", resourceType?: string) => applyDecorators(Param(idParam, ParseUUIDPipe), UseGuards(TenantResourceGuard), SetMetadata("tenantPermission", permission), SetMetadata("resourceIdParam", idParam), SetMetadata("resourceType", resourceType));

// 租户子域名装饰器
export const TenantSubdomain = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const subdomain = request.headers["x-tenant-subdomain"] || request.query.tenant_subdomain;

  if (!subdomain) {
    throw new TenantNotIdentifiedError("无法识别租户子域名");
  }

  return subdomain;
});
```

### 4.2 多租户守卫实现

```typescript
// 多租户认证守卫
@Injectable()
export class MultiTenantAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantIdentificationService: TenantIdentificationService,
    private readonly jwtService: JwtService,
    private readonly logger: AppLoggerService /* 来源: @hl8/logger */,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      // 1. 识别租户
      const tenantContext = await this.tenantIdentificationService.identifyTenant(request);
      request.tenantContext = tenantContext;

      // 2. 验证JWT令牌
      const token = this.extractTokenFromHeader(request);
      if (!token) {
        throw new UnauthorizedException("未提供访问令牌");
      }

      const payload = await this.jwtService.verifyToken(token);

      // 3. 验证令牌中的租户信息
      if (payload.tenantId !== tenantContext.tenantId.value) {
        throw new UnauthorizedException("令牌租户与请求租户不匹配");
      }

      // 4. 设置用户信息
      request.user = {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
      };

      this.logger.debug(`User ${payload.sub} authenticated for tenant ${tenantContext.tenantId.value}`);
      return true;
    } catch (error) {
      this.logger.warn(`Multi-tenant authentication failed: ${error.message}`);
      throw new UnauthorizedException("多租户认证失败");
    }
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(" ");
    return type === "Bearer" ? token : null;
  }
}

// 租户权限守卫
@Injectable()
export class TenantPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityService: CaslAbilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>("tenantPermissions", context.getHandler());

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantContext = request.tenantContext;
    const user = request.user;

    if (!tenantContext || !user) {
      throw new UnauthorizedException("租户上下文或用户信息缺失");
    }

    const ability = await this.abilityService.getAbilityForUser(user.id, tenantContext.tenantId.value);

    // 检查每个所需权限
    for (const permission of requiredPermissions) {
      if (!ability.can(permission, "TenantResource")) {
        throw new ForbiddenException(`缺少租户权限: ${permission}`);
      }
    }

    return true;
  }
}

// 租户资源守卫
@Injectable()
export class TenantResourceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityService: CaslAbilityService,
    private readonly resourceAuthorizationService: ResourceAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<string>("tenantPermission", context.getHandler());
    const idParam = this.reflector.get<string>("resourceIdParam", context.getHandler());
    const resourceType = this.reflector.get<string>("resourceType", context.getHandler());

    const request = context.switchToHttp().getRequest();
    const tenantContext = request.tenantContext;
    const user = request.user;
    const resourceId = request.params[idParam];

    if (!tenantContext || !user || !resourceId) {
      return false;
    }

    // 验证资源级权限
    const isAuthorized = await this.resourceAuthorizationService.isAuthorized(user.id, tenantContext.tenantId, resourceType || this.inferResourceType(context), resourceId, permission);

    if (!isAuthorized) {
      throw new ForbiddenException("无权访问该资源");
    }

    return true;
  }

  private inferResourceType(context: ExecutionContext): string {
    const controller = context.getClass().name;
    return controller.replace(/Controller$/, "").toLowerCase();
  }
}

// 超级管理员守卫
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("用户未认证");
    }

    if (!user.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("需要超级管理员权限");
    }

    return true;
  }
}
```

### 4.3 租户识别服务

```typescript
@Injectable()
export class TenantIdentificationService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly jwtService: JwtService,
    private readonly logger: AppLoggerService /* 来源: @hl8/logger */,
  ) {}

  async identifyTenant(request: Request): Promise<TenantContext> {
    // 1. 从子域名识别
    const subdomain = this.extractSubdomain(request);
    if (subdomain) {
      const tenant = await this.tenantRepository.findBySubdomain(subdomain);
      if (tenant && tenant.isActive()) {
        return TenantContext.fromTenant(tenant);
      }
    }

    // 2. 从请求头识别
    const headerTenantId = request.headers["x-tenant-id"];
    if (headerTenantId) {
      const tenant = await this.tenantRepository.findById(TenantId.create(headerTenantId as string));
      if (tenant && tenant.isActive()) {
        return TenantContext.fromTenant(tenant);
      }
    }

    // 3. 从JWT令牌识别
    const token = this.extractTokenFromHeader(request);
    if (token) {
      try {
        const payload = this.decodeToken(token);
        if (payload?.tenantId) {
          const tenant = await this.tenantRepository.findById(TenantId.create(payload.tenantId));
          if (tenant && tenant.isActive()) {
            return TenantContext.fromTenant(tenant);
          }
        }
      } catch (error) {
        this.logger.warn("Failed to extract tenant from JWT token", error);
      }
    }

    throw new TenantNotIdentifiedError("无法识别租户");
  }

  private extractSubdomain(request: Request): string | null {
    const hostname = request.hostname;
    const parts = hostname.split(".");

    // 支持多种子域名格式: tenant1.app.com, app.com/tenant1
    if (parts.length >= 3 && parts[0] !== "www" && parts[0] !== "app") {
      return parts[0];
    }

    return null;
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(" ");
    return type === "Bearer" ? token : null;
  }

  private decodeToken(token: string): any {
    try {
      return this.jwtService.decode(token); // ✅ 使用 @hl8/jwt 提供的统一服务
    } catch (error) {
      this.logger.warn("JWT 解码失败", error);
      return null;
    }
  }
}
```

### 4.4 多租户异常过滤器

```typescript
@Catch()
export class MultiTenantExceptionFilter implements ExceptionFilter {
  private readonly logger = InjectLogger(MultiTenantExceptionFilter.name); // 来源: @hl8/logger

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status: number;
    let message: string;
    let code: string;
    let details: any;

    // 多租户特定异常处理
    if (exception instanceof TenantNotIdentifiedError) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
      code = "TENANT_NOT_IDENTIFIED";
    } else if (exception instanceof CrossTenantAccessError) {
      status = HttpStatus.FORBIDDEN;
      message = exception.message;
      code = "CROSS_TENANT_ACCESS_DENIED";
    } else if (exception instanceof TenantInactiveError) {
      status = HttpStatus.FORBIDDEN;
      message = exception.message;
      code = "TENANT_INACTIVE";
    } else if (exception instanceof BaseException) {
      status = exception.httpStatus;
      message = exception.message;
      code = exception.code;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
      code = "HTTP_ERROR";
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "服务器内部错误";
      code = "INTERNAL_SERVER_ERROR";
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "未知服务器错误";
      code = "UNKNOWN_ERROR";
    }

    const tenantContext = request.tenantContext;
    const errorResponse: ErrorResponseDto = {
      success: false,
      error: {
        code,
        message,
        details,
        tenantId: tenantContext?.tenantId.value,
        path: request.url,
        timestamp: new Date().toISOString(),
        requestId: request.headers["x-request-id"] || ulid(),
      },
    };

    // 记录租户特定的错误日志
    this.logError(request, exception, errorResponse);

    response.status(status).json(errorResponse);
  }

  private logError(request: any, exception: unknown, errorResponse: ErrorResponseDto): void {
    const logEntry = {
      requestId: errorResponse.error.requestId,
      tenantId: errorResponse.error.tenantId,
      method: request.method,
      url: request.url,
      userAgent: request.headers["user-agent"],
      userId: request.user?.id,
      error:
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: exception.stack,
            }
          : exception,
      response: errorResponse,
    };

    if (errorResponse.error.code === "INTERNAL_SERVER_ERROR") {
      this.logger.error("Internal server error", logEntry);
    } else {
      this.logger.warn("Business exception", logEntry);
    }
  }
}
```

## 📊 多租户可观测性规范

### 5.1 多租户日志拦截器

```typescript
@Injectable()
export class MultiTenantLoggingInterceptor implements NestInterceptor {
  private readonly logger = InjectLogger(MultiTenantLoggingInterceptor.name); // 来源: @hl8/logger

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const requestId = request.headers["x-request-id"] || ulid();
    const startTime = Date.now();

    // 设置请求ID和租户上下文
    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    const tenantContext = request.tenantContext;
    const logEntry = {
      requestId,
      tenantId: tenantContext?.tenantId.value,
      method: request.method,
      url: request.url,
      query: request.query,
      body: this.sanitizeBody(request.body),
      userAgent: request.headers["user-agent"],
      userId: request.user?.id,
      ip: request.ip,
    };

    this.logger.log("Incoming multi-tenant request", logEntry);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log("Multi-tenant request completed", {
          requestId,
          tenantId: tenantContext?.tenantId.value,
          statusCode: response.statusCode,
          duration: `${duration}ms`,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error("Multi-tenant request failed", {
          requestId,
          tenantId: tenantContext?.tenantId.value,
          error: error.message,
          duration: `${duration}ms`,
          statusCode: error.status || 500,
        });
        return throwError(() => error);
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sensitiveFields = ["password", "token", "authorization", "creditCard", "secretKey"];
    const sanitized = { ...body };

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = "***";
      }
    });

    return sanitized;
  }
}
```

### 5.2 多租户监控指标

```typescript
@Injectable()
export class MultiTenantMetricsInterceptor implements NestInterceptor {
  private readonly requestDuration: Histogram;
  private readonly tenantRequests: Counter;

  constructor(private readonly metricsService: MetricsService) {
    this.requestDuration = this.metricsService.createHistogram({
      name: "multi_tenant_http_request_duration_seconds",
      help: "Multi-tenant HTTP request duration in seconds",
      labelNames: ["method", "route", "status_code", "tenant_id"],
    });

    this.tenantRequests = this.metricsService.createCounter({
      name: "multi_tenant_http_requests_total",
      help: "Total multi-tenant HTTP requests",
      labelNames: ["method", "route", "tenant_id"],
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const startTime = Date.now();
    const method = request.method;
    const route = request.route?.path || "unknown";
    const tenantId = request.tenantContext?.tenantId.value || "unknown";

    // 记录请求计数
    this.tenantRequests.labels(method, route, tenantId).inc();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        this.requestDuration.labels(method, route, response.statusCode.toString(), tenantId).observe(duration);
      }),
    );
  }
}
```

## 🧪 多租户测试规范

### 7.1 多租户控制器测试

```typescript
describe("OrganizationController (Multi-tenant)", () => {
  let controller: OrganizationController;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [
        {
          provide: CommandBus,
          useValue: { execute: jest.fn() },
        },
        {
          provide: QueryBus,
          useValue: { execute: jest.fn() },
        },
        {
          provide: OrganizationAssembler,
          useValue: {
            toCreateOrganizationCommand: jest.fn(),
            toOrganizationResponseDto: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrganizationController>(OrganizationController);
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
  });

  describe("createOrganization", () => {
    it("应该成功创建组织并包含租户上下文", async () => {
      // Given
      const tenantContext = createTenantContext("tenant-123");
      const user = { id: "user-123", roles: ["admin"], permissions: ["organization:create"] };
      const createDto = new CreateOrganizationRequestDto();
      const command = new CreateOrganizationCommand(/* ... */);
      const organizationId = OrganizationId.create();

      jest.spyOn(controller["organizationAssembler"], "toCreateOrganizationCommand").mockReturnValue(command);
      jest.spyOn(commandBus, "execute").mockResolvedValue(organizationId);

      // When
      const result = await controller.createOrganization(tenantContext, user, createDto);

      // Then
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(organizationId.value);
      expect(commandBus.execute).toHaveBeenCalledWith(command);
      // 验证传递给应用层的命令中包含了正确的安全上下文（内含租户ID）
      expect(command.securityContext.tenantId).toBe(tenantContext.tenantId.value);
    });

    it("当缺少租户上下文时应抛出异常", async () => {
      // Given
      const user = { id: "user-123", roles: ["admin"], permissions: ["organization:create"] };
      const createDto = new CreateOrganizationRequestDto();

      // When & Then
      await expect(controller.createOrganization(null, user, createDto)).rejects.toThrow(TenantNotIdentifiedError);
    });

    it("当用户无权限时应拒绝访问", async () => {
      // Given
      const tenantContext = createTenantContext("tenant-123");
      const user = { id: "user-123", roles: ["user"], permissions: [] }; // 无创建权限
      const createDto = new CreateOrganizationRequestDto();

      // 模拟权限守卫抛出异常
      jest.spyOn(commandBus, "execute").mockRejectedValue(new ForbiddenException());

      // When & Then
      await expect(controller.createOrganization(tenantContext, user, createDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("getOrganizations", () => {
    it("应只返回当前租户下的组织列表", async () => {
      // Given
      const tenantContext = createTenantContext("tenant-123");
      const user = { id: "user-123", roles: ["admin"], permissions: ["organization:read"] };
      const queryDto = new OrganizationQueryRequestDto();

      const organizations = [
        createOrganization({ tenantId: "tenant-123" }), // 当前租户
        createOrganization({ tenantId: "tenant-123" }), // 当前租户
        // 注意：没有其他租户的组织
      ];
      const paginatedResult = createPaginatedResult(organizations);

      jest.spyOn(queryBus, "execute").mockResolvedValue(paginatedResult);

      // When
      const result = await controller.getOrganizations(tenantContext, user, queryDto);

      // Then
      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(2);
      // 验证所有返回的组织都属于当前租户
      result.data.items.forEach((org) => {
        expect(org.tenantId).toBe("tenant-123");
      });
    });
  });
});
```

### 7.2 多租户集成测试

```typescript
describe("Multi-tenant API Integration", () => {
  let app: INestApplication;
  let tenantRepository: TenantRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 应用多租户中间件和过滤器
    app.useGlobalFilters(new MultiTenantExceptionFilter());
    app.useGlobalInterceptors(new MultiTenantLoggingInterceptor());

    await app.init();

    tenantRepository = moduleFixture.get<TenantRepository>(TenantRepository);
  });

  describe("租户识别", () => {
    it("应通过子域名正确识别租户", async () => {
      // 模拟子域名请求 (通常在测试中通过Host头模拟)
      return request(app.getHttpServer())
        .get("/api/organizations")
        .set("Host", "acme.myapp.com") // acme 是租户子域名
        .set("Authorization", "Bearer valid-token-for-tenant-acme")
        .expect(200)
        .then((response) => {
          // 验证响应中包含正确的租户数据
          expect(response.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ tenantId: "tenant-acme-id" })]));
        });
    });

    it("应通过X-Tenant-ID头正确识别租户", async () => {
      return request(app.getHttpServer()).get("/api/organizations").set("X-Tenant-ID", "tenant-123").set("Authorization", "Bearer valid-token-for-tenant-123").expect(200);
    });

    it("当租户不存在时应返回错误", async () => {
      return request(app.getHttpServer())
        .get("/api/organizations")
        .set("X-Tenant-ID", "non-existent-tenant")
        .set("Authorization", "Bearer valid-token")
        .expect(400)
        .then((response) => {
          expect(response.body.error.code).toBe("TENANT_NOT_IDENTIFIED");
        });
    });

    it("当租户被停用时应返回错误", async () => {
      // 先创建一个停用的租户
      const inactiveTenant = await tenantRepository.save(
        Tenant.create({
          name: "Inactive Tenant",
          subdomain: "inactive",
          status: TenantStatus.SUSPENDED,
        }),
      );

      return request(app.getHttpServer())
        .get("/api/organizations")
        .set("X-Tenant-ID", inactiveTenant.id.value)
        .set("Authorization", "Bearer valid-token")
        .expect(403)
        .then((response) => {
          expect(response.body.error.code).toBe("TENANT_INACTIVE");
        });
    });
  });

  describe("数据隔离", () => {
    let tenantA: Tenant;
    let tenantB: Tenant;
    let orgA1: Organization;
    let orgA2: Organization;
    let orgB1: Organization;

    beforeEach(async () => {
      // 设置测试数据
      tenantA = await createTenant("Tenant A", "tenant-a");
      tenantB = await createTenant("Tenant B", "tenant-b");

      orgA1 = await createOrganization(tenantA, "Org A1");
      orgA2 = await createOrganization(tenantA, "Org A2");
      orgB1 = await createOrganization(tenantB, "Org B1");
    });

    it("租户A不应看到租户B的数据", async () => {
      return request(app.getHttpServer())
        .get("/api/organizations")
        .set("X-Tenant-ID", tenantA.id.value)
        .set("Authorization", "Bearer valid-token-for-tenant-a")
        .expect(200)
        .then((response) => {
          const organizations = response.body.data.items;
          // 只能看到租户A的组织
          expect(organizations).toHaveLength(2);
          expect(organizations).toEqual(expect.arrayContaining([expect.objectContaining({ id: orgA1.id.value }), expect.objectContaining({ id: orgA2.id.value })]));
          // 不能看到租户B的组织
          expect(organizations).not.toContain(expect.objectContaining({ id: orgB1.id.value }));
        });
    });

    it("租户B尝试访问租户A的数据应被拒绝", async () => {
      return request(app.getHttpServer())
        .get(`/api/organizations/${orgA1.id.value}`) // 租户A的组织ID
        .set("X-Tenant-ID", tenantB.id.value) // 租户B的上下文
        .set("Authorization", "Bearer valid-token-for-tenant-b")
        .expect(403) // 应该被拒绝
        .then((response) => {
          expect(response.body.error.code).toBe("CROSS_TENANT_ACCESS_DENIED");
        });
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

## 🔄 多租户 GraphQL 设计规范

### 8.1 多租户 GraphQL 解析器

```typescript
// 多租户 GraphQL 模块
@Injectable()
export class MultiTenantGraphQLModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantIdentificationMiddleware).forRoutes("graphql");
  }
}

// 多租户 GraphQL 上下文工厂
@Injectable()
export class MultiTenantGraphQLContextFactory implements GqlOptionsFactory {
  constructor(
    private readonly tenantIdentificationService: TenantIdentificationService,
    private readonly jwtService: JwtService,
  ) {}

  createGqlOptions(): GqlModuleOptions {
    return {
      autoSchemaFile: true,
      context: async ({ req, connection }) => {
        // 支持 WebSocket 连接 (GraphQL Subscriptions)
        const request = req || connection?.context;

        // 识别租户
        const tenantContext = await this.tenantIdentificationService.identifyTenant(request);

        // 验证用户
        let currentUser = null;
        const token = this.extractToken(request);
        if (token) {
          try {
            const payload = await this.jwtService.verifyToken(token);
            currentUser = {
              id: payload.sub,
              email: payload.email,
              roles: payload.roles,
              permissions: payload.permissions,
            };
          } catch (error) {
            // Token 验证失败，但不阻止上下文创建
            console.warn("GraphQL token verification failed:", error.message);
          }
        }

        return {
          tenantContext,
          currentUser,
          securityContext:
            tenantContext && currentUser
              ? {
                  tenantId: tenantContext.tenantId.value,
                  userId: currentUser.id,
                  roles: currentUser.roles,
                  permissions: currentUser.permissions,
                }
              : null,
        };
      },
      plugins: [new MultiTenantGraphQLPlugin()],
      formatError: (error) => {
        // 多租户特定的错误格式化
        return this.formatMultiTenantError(error);
      },
    };
  }

  private extractToken(request: any): string | null {
    const authHeader = request?.headers?.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(" ");
    return type === "Bearer" ? token : null;
  }

  private formatMultiTenantError(error: GraphQLFormattedError) {
    // 处理多租户特定的错误
    if (error.extensions?.code === "TENANT_NOT_IDENTIFIED") {
      return {
        ...error,
        message: "无法识别租户，请检查您的请求头或子域名",
        extensions: {
          ...error.extensions,
          code: "TENANT_NOT_IDENTIFIED",
          tenantAware: true,
        },
      };
    }

    return error;
  }
}

// 组织 GraphQL 解析器
@Resolver(() => OrganizationType)
@UseGuards(MultiTenantGqlAuthGuard)
export class OrganizationResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly organizationAssembler: OrganizationAssembler,
  ) {}

  @Query(() => OrganizationPaginationType)
  @UseGuards(TenantPermissionGuard)
  @TenantPermissions("organization:read")
  async organizations(@Args() queryArgs: OrganizationQueryArgs, @Context() context: MultiTenantGraphQLContext): Promise<OrganizationPaginationType> {
    const securityContext = this.buildSecurityContext(context);

    const query = this.organizationAssembler.toOrganizationQuery(queryArgs, securityContext);

    const paginatedResult = await this.queryBus.execute(query);
    return this.organizationAssembler.toOrganizationPaginationType(paginatedResult);
  }

  @Mutation(() => OrganizationMutationResponse)
  @UseGuards(TenantPermissionGuard)
  @TenantPermissions("organization:create")
  async createOrganization(@Args("input") input: CreateOrganizationInput, @Context() context: MultiTenantGraphQLContext): Promise<OrganizationMutationResponse> {
    const securityContext = this.buildSecurityContext(context);

    const command = this.organizationAssembler.toCreateOrganizationCommand(input, securityContext);

    const organizationId = await this.commandBus.execute(command);

    return {
      success: true,
      message: "组织创建成功",
      organizationId: organizationId.value,
    };
  }

  @Subscription(() => OrganizationEventType)
  @TenantPermissions("organization:read")
  organizationCreated(@Context() context: MultiTenantGraphQLContext, @Args("tenantId") tenantId: string) {
    // 验证订阅者只能订阅自己租户的事件
    if (context.tenantContext.tenantId.value !== tenantId) {
      throw new ForbiddenException("不能订阅其他租户的事件");
    }

    return pubSub.asyncIterator(`ORGANIZATION_CREATED_${tenantId}`);
  }

  private buildSecurityContext(context: MultiTenantGraphQLContext): SecurityContext {
    if (!context.tenantContext || !context.currentUser) {
      throw new UnauthorizedException("GraphQL上下文缺少租户或用户信息");
    }

    return {
      tenantId: context.tenantContext.tenantId.value,
      userId: context.currentUser.id,
      roles: context.currentUser.roles,
      permissions: context.currentUser.permissions,
      sessionId: ulid(),
    };
  }
}

// GraphQL 类型定义
@ObjectType("Organization")
export class OrganizationType {
  @Field(() => ID)
  id: string;

  @Field()
  tenantId: string;

  @Field()
  name: string;

  @Field()
  code: string;

  @Field(() => OrganizationStatus)
  status: OrganizationStatus;

  @Field()
  createdAt: Date;
}

@InputType("CreateOrganizationInput")
export class CreateOrganizationInput {
  @Field()
  @IsNotEmpty()
  name: string;

  @Field()
  @Matches(/^[A-Z0-9_]{3,20}$/)
  code: string;

  @Field({ nullable: true })
  description?: string;
}

@ObjectType("OrganizationMutationResponse")
export class OrganizationMutationResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => ID)
  organizationId: string;
}

@ObjectType("OrganizationPagination")
export class OrganizationPaginationType {
  @Field(() => [OrganizationType])
  items: OrganizationType[];

  @Field()
  total: number;

  @Field()
  page: number;

  @Field()
  pageSize: number;

  @Field()
  totalPages: number;
}
```

## 🚀 部署与配置规范

### 9.1 多租户环境配置

```typescript
// 多租户配置接口
export interface MultiTenantConfig {
  tenantIdentification: {
    methods: TenantIdentificationMethod[];
    defaultTenantId?: string;
    subdomainMapping: {
      enabled: boolean;
      baseDomains: string[];
    };
  };
  security: {
    enforceTenantIsolation: boolean;
    allowCrossTenantRequests: boolean;
    superAdminTenantId: string;
  };
  api: {
    versioning: {
      enabled: boolean;
      defaultVersion: string;
    };
    rateLimiting: {
      enabled: boolean;
      defaultLimit: number;
      perTenantLimit: boolean;
    };
  };
}

// 环境特定的配置
export const multiTenantConfig = (): MultiTenantConfig => ({
  tenantIdentification: {
    methods: ["subdomain", "header", "jwt"],
    subdomainMapping: {
      enabled: process.env.SUBDOMAIN_TENANT_IDENTIFICATION === "true",
      baseDomains: process.env.BASE_DOMAINS?.split(",") || ["myapp.com"],
    },
  },
  security: {
    enforceTenantIsolation: process.env.ENFORCE_TENANT_ISOLATION !== "false",
    allowCrossTenantRequests: process.env.ALLOW_CROSS_TENANT_REQUESTS === "true",
    superAdminTenantId: process.env.SUPER_ADMIN_TENANT_ID || "system",
  },
  api: {
    versioning: {
      enabled: true,
      defaultVersion: "1",
    },
    rateLimiting: {
      enabled: process.env.API_RATE_LIMITING === "true",
      defaultLimit: parseInt(process.env.API_RATE_LIMIT || "1000"),
      perTenantLimit: true,
    },
  },
});

// 配置模块
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [multiTenantConfig],
      isGlobal: true,
    }),
  ],
  providers: [
    {
      provide: TenantIdentificationService,
      useFactory: (config: ConfigService) => {
        const tenantConfig = config.get<MultiTenantConfig>("multiTenantConfig");
        return new TenantIdentificationService(tenantConfig);
      },
      inject: [ConfigService],
    },
  ],
  exports: [TenantIdentificationService],
})
export class MultiTenantConfigModule {}
```

### 9.2 Docker 与 Kubernetes 配置

```yaml
# docker-compose.multi-tenant.yml
version: "3.8"
services:
  multi-tenant-api:
    build:
      context: .
      dockerfile: Dockerfile.multi-tenant
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@multi-tenant-db:5432/app
      - REDIS_URL=redis://multi-tenant-redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - SUBDOMAIN_TENANT_IDENTIFICATION=true
      - BASE_DOMAINS=myapp.com,app.local
      - ENFORCE_TENANT_ISOLATION=true
    labels:
      - "traefik.http.routers.api.rule=HostRegexp(`{subdomain:[a-z0-9-]+}.myapp.com`) || Host(`myapp.com`)"
      - "traefik.http.middlewares.tenant-headers.headers.customrequestheaders.X-Tenant-Subdomain=${subdomain}"
    depends_on:
      - multi-tenant-db
      - multi-tenant-redis

  multi-tenant-db:
    image: postgres:14
    environment:
      - POSTGRES_MULTIPLE_DATABASES=tenant_1,tenant_2,tenant_shared
      - POSTGRES_USER=app_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - tenant_data:/var/lib/postgresql/data

  multi-tenant-redis:
    image: redis:6-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  tenant_data:
  redis_data:
```

```yaml
# kubernetes/multi-tenant-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: multi-tenant-api
  labels:
    app: multi-tenant-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: multi-tenant-api
  template:
    metadata:
      labels:
        app: multi-tenant-api
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      containers:
        - name: api
          image: myapp/multi-tenant-api:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: multi-tenant-secrets
                  key: database-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: multi-tenant-secrets
                  key: jwt-secret
            - name: BASE_DOMAINS
              value: "myapp.com,app.local"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: multi-tenant-api-service
spec:
  selector:
    app: multi-tenant-api
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-tenant-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - "*.myapp.com"
        - "myapp.com"
      secretName: multi-tenant-tls
  rules:
    - host: "*.myapp.com"
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: multi-tenant-api-service
                port:
                  number: 80
    - host: "myapp.com"
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: multi-tenant-api-service
                port:
                  number: 80
```

## 📈 性能与扩展性考虑

### 10.1 多租户缓存策略

```typescript
@Injectable()
export class MultiTenantCacheService {
  constructor(
    private readonly redisService: RedisService,
    private readonly logger: AppLoggerService /* 来源: @hl8/logger */,
  ) {}

  // 租户级别的缓存键生成
  private generateTenantCacheKey(tenantId: string, key: string): string {
    return `tenant:${tenantId}:${key}`;
  }

  // 获取租户特定缓存
  async get<T>(tenantId: string, key: string): Promise<T | null> {
    const cacheKey = this.generateTenantCacheKey(tenantId, key);
    try {
      const cached = await this.redisService.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn(`Cache get failed for key ${cacheKey}`, error);
      return null;
    }
  }

  // 设置租户特定缓存
  async set<T>(tenantId: string, key: string, value: T, ttlSeconds?: number): Promise<void> {
    const cacheKey = this.generateTenantCacheKey(tenantId, key);
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redisService.setex(cacheKey, ttlSeconds, serialized);
      } else {
        await this.redisService.set(cacheKey, serialized);
      }
    } catch (error) {
      this.logger.warn(`Cache set failed for key ${cacheKey}`, error);
    }
  }

  // 清除租户的所有缓存
  async clearTenantCache(tenantId: string): Promise<void> {
    const pattern = this.generateTenantCacheKey(tenantId, "*");
    try {
      const keys = await this.redisService.keys(pattern);
      if (keys.length > 0) {
        await this.redisService.del(...keys);
      }
    } catch (error) {
      this.logger.warn(`Clear tenant cache failed for tenant ${tenantId}`, error);
    }
  }

  // 租户缓存统计
  async getTenantCacheStats(tenantId: string): Promise<CacheStats> {
    const pattern = this.generateTenantCacheKey(tenantId, "*");
    const keys = await this.redisService.keys(pattern);

    let totalSize = 0;
    for (const key of keys) {
      const size = await this.redisService.strlen(key);
      totalSize += size;
    }

    return {
      tenantId,
      cacheKeys: keys.length,
      totalSize,
      averageSize: keys.length > 0 ? totalSize / keys.length : 0,
    };
  }
}
```

### 10.2 数据库连接池与多租户优化

```typescript
@Injectable()
export class MultiTenantDatabaseService {
  private readonly tenantConnections: Map<string, DataSource> = new Map();
  private readonly sharedConnection: DataSource;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService /* 来源: @hl8/logger */,
  ) {
    this.sharedConnection = this.createSharedConnection();
  }

  // 获取租户特定的数据库连接
  async getTenantConnection(tenantId: string): Promise<DataSource> {
    if (this.tenantConnections.has(tenantId)) {
      return this.tenantConnections.get(tenantId)!;
    }

    // 根据租户ID创建或获取数据库连接
    const connection = await this.createTenantConnection(tenantId);
    this.tenantConnections.set(tenantId, connection);

    return connection;
  }

  private async createTenantConnection(tenantId: string): Promise<DataSource> {
    const databaseName = this.getTenantDatabaseName(tenantId);

    return new DataSource({
      type: "postgres",
      host: this.configService.get("DB_HOST"),
      port: this.configService.get("DB_PORT"),
      username: this.configService.get("DB_USERNAME"),
      password: this.configService.get("DB_PASSWORD"),
      database: databaseName,
      entities: [__dirname + "/**/*.entity{.ts,.js}"],
      synchronize: false, // 生产环境关闭
      logging: this.configService.get("DB_LOGGING") === "true",
      poolSize: 10, // 每个租户连接池大小
      extra: {
        max: 20, // 最大连接数
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
      },
    }).initialize();
  }

  private getTenantDatabaseName(tenantId: string): string {
    // 根据租户ID生成数据库名
    return `tenant_${tenantId}`;
  }

  // 健康检查
  async healthCheck(): Promise<HealthCheckResult> {
    const results: HealthIndicatorResult[] = [];

    // 检查共享数据库
    try {
      await this.sharedConnection.query("SELECT 1");
      results.push({ sharedDatabase: { status: "up" } });
    } catch (error) {
      results.push({ sharedDatabase: { status: "down", error: error.message } });
    }

    // 检查活跃的租户连接
    for (const [tenantId, connection] of this.tenantConnections.entries()) {
      try {
        await connection.query("SELECT 1");
        results.push({ [`tenant_${tenantId}_database`]: { status: "up" } });
      } catch (error) {
        results.push({
          [`tenant_${tenantId}_database`]: {
            status: "down",
            error: error.message,
          },
        });
      }
    }

    return {
      status: results.every((r) => Object.values(r)[0].status === "up") ? "ok" : "error",
      details: Object.assign({}, ...results),
    };
  }
}
```

## 🔧 监控与告警

### 11.1 多租户监控仪表板

```typescript
@Injectable()
export class MultiTenantMonitoringService {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly logger: AppLoggerService /* 来源: @hl8/logger */,
  ) {}

  // 租户级别的API指标
  recordTenantApiCall(tenantId: string, method: string, endpoint: string, statusCode: number, duration: number): void {
    const labels = { tenantId, method, endpoint, statusCode: statusCode.toString() };

    // 请求持续时间
    this.metricsService.histogram("tenant_api_duration_seconds", labels).observe(duration);

    // 请求计数
    this.metricsService.counter("tenant_api_requests_total", labels).inc();

    // 错误率
    if (statusCode >= 400) {
      this.metricsService.counter("tenant_api_errors_total", labels).inc();
    }
  }

  // 租户资源使用情况
  recordTenantResourceUsage(tenantId: string, resourceType: string, usage: number): void {
    this.metricsService.gauge("tenant_resource_usage", { tenantId, resourceType }).set(usage);
  }

  // 租户活跃度指标
  recordTenantActivity(tenantId: string, activityType: string): void {
    this.metricsService.counter("tenant_activity_total", { tenantId, activityType }).inc();
  }

  // 生成租户健康报告
  async generateTenantHealthReport(tenantId: string): Promise<TenantHealthReport> {
    const [apiMetrics, resourceUsage, errorRate, activeUsers] = await Promise.all([this.getTenantApiMetrics(tenantId), this.getTenantResourceUsage(tenantId), this.getTenantErrorRate(tenantId), this.getTenantActiveUsers(tenantId)]);

    return {
      tenantId,
      timestamp: new Date(),
      overallHealth: this.calculateOverallHealth(apiMetrics, errorRate),
      apiMetrics,
      resourceUsage,
      errorRate,
      activeUsers,
      recommendations: this.generateRecommendations(apiMetrics, resourceUsage, errorRate),
    };
  }

  private calculateOverallHealth(apiMetrics: ApiMetrics, errorRate: number): "healthy" | "degraded" | "unhealthy" {
    if (errorRate > 0.1) return "unhealthy";
    if (errorRate > 0.05) return "degraded";
    if (apiMetrics.throughput < 10) return "degraded"; // 低流量
    return "healthy";
  }
}
```

## 🎯 总结

本文档详细阐述了多租户增强版的接口层设计规范，涵盖了：

1. **核心设计理念** - 明确多租户接口层的定位和核心原则
2. **分层架构** - 清晰的多租户接口层结构和职责划分
3. **REST API规范** - 包含控制器、DTO、装配器的完整设计
4. **安全与验证** - 多租户装饰器、守卫、异常处理机制
5. **可观测性** - 日志、监控、指标等全方位监控体系
6. **测试策略** - 单元测试和集成测试的最佳实践
7. **GraphQL支持** - 多租户GraphQL完整解决方案
8. **部署配置** - Docker、Kubernetes部署方案
9. **性能优化** - 缓存、数据库连接等性能考虑
10. **监控告警** - 全面的监控和健康检查机制

通过遵循本规范，可以构建出安全、可靠、可扩展的多租户系统接口层，为不同租户提供隔离且高质量的API服务。

---

**文档版本**: v2.0 (多租户增强版)  
**最后更新**: 2024年1月  
**维护团队**: 架构组 & 后端开发团队  
**相关文档**:

- 《多租户应用层设计规范》
- 《多租户数据层设计规范》
- 《多租户部署运维指南》
