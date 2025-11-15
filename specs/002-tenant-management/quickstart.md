# 快速开始：租户管理模块

**日期**：2025-01-27  
**关联计划**：[plan.md](./plan.md) | **数据模型**：[data-model.md](./data-model.md) | **API 契约**：[contracts/openapi.yaml](./contracts/openapi.yaml)

## 概述

本文档提供租户管理模块的快速开始指南，包括模块集成、基本使用和开发流程。

## 前置条件

- Node.js >= 20
- pnpm >= 10.11.0
- PostgreSQL 数据库
- Redis（可选，用于缓存）

## 模块集成

### 1. 安装依赖

租户管理模块依赖以下平台基础设施：

```json
{
  "dependencies": {
    "@hl8/domain-base": "workspace:*",
    "@hl8/application-base": "workspace:*",
    "@hl8/infrastructure-base": "workspace:*",
    "@hl8/multi-tenancy": "workspace:*",
    "@hl8/config": "workspace:*",
    "@hl8/logger": "workspace:*",
    "@hl8/exceptions": "workspace:*",
    "@hl8/cache": "workspace:*",
    "@hl8/mikro-orm-nestjs": "workspace:*",
    "@nestjs/cqrs": "^11.0.1",
    "@casl/ability": "^6.5.0"
  }
}
```

### 2. 注册模块

在应用模块（如 `apps/fastify-api/src/app.module.ts`）中注册租户管理模块：

```typescript
import { TenantModule } from "@hl8/tenant";

@Module({
  imports: [
    // ... 其他模块
    TenantModule,
  ],
})
export class AppModule {}
```

### 3. 数据库迁移

执行数据库迁移创建租户相关表：

```bash
# 在租户模块目录下创建迁移
cd libs/modules/tenant
pnpm run db:migration:create

# 执行迁移（需要在应用层配置数据库连接）
pnpm run db:migration:up
```

**注意**：数据库迁移需要在应用层配置数据库连接后执行，租户模块仅提供迁移文件。

## 基本使用

### 创建租户

```typescript
// 在控制器中（已由 TenantCommandController 实现）
@Post('/tenants')
async createTenant(@Body() dto: CreateTenantDto) {
  // 注意：实际实现中，SecurityContext 应从请求装饰器获取
  const securityContext: SecurityContext = {
    tenantId: "system-tenant-id",
    userId: "current-user-id",
  };

  const command = new CreateTenantCommand(securityContext, {
    tenantName: TenantName.create(dto.tenantName),
    contactInfo: TenantContactInfo.create(dto.contactInfo),
    context: TenantContext.create(dto.context),
    profile: dto.profile ? TenantProfile.create(dto.profile) : undefined,
    createdBy: command.context.userId,
  });

  return await this.commandBus.execute(command);
}
```

### 查询租户列表

```typescript
@Get('/tenants')
@UseGuards(MultiTenantAuthGuard, CaslGuard)
async listTenants(@Query() query: ListTenantsQuery) {
  return await this.queryBus.execute(query);
}
```

### 启用租户

```typescript
@Post('/tenants/:id/activate')
async activateTenant(@Param('id') tenantId: string) {
  // 注意：实际实现中，SecurityContext 应从请求装饰器获取
  const securityContext: SecurityContext = {
    tenantId: "system-tenant-id",
    userId: "current-user-id",
  };

  const command = new ActivateTenantCommand(securityContext, {
    tenantId: tenantId,
  });

  return await this.commandBus.execute(command);
}
```

## 开发流程

### 1. 领域层开发

#### 创建聚合根

```typescript
// libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.ts
export class TenantAggregate extends AggregateRootBase {
  private constructor(
    private readonly id: TenantId,
    private tenantName: TenantName,
    private status: TenantStatus,
    private contactInfo: TenantContactInfo,
    private context: TenantContext,
    private profile?: TenantProfile,
  ) {
    super();
  }

  static create(data: CreateTenantData): TenantAggregate {
    const tenant = new TenantAggregate(TenantId.generate(), TenantName.create(data.tenantName), TenantStatus.Initialized, TenantContactInfo.create(data.contactInfo), TenantContext.create(data.context), data.profile ? TenantProfile.create(data.profile) : undefined);

    tenant.addDomainEvent(
      new TenantCreatedEvent({
        tenantId: tenant.id,
        tenantName: tenant.tenantName.value,
        status: tenant.status,
        contactInfo: tenant.contactInfo,
        context: tenant.context,
        auditMetadata: tenant.auditTrail.toMetadata(),
        softDeleteStatus: tenant.softDeleteStatus,
      }),
    );

    tenant.touch();
    return tenant;
  }

  activate(initiator: UserId): void {
    if (!this.status.canTransitionTo(TenantStatus.Active)) {
      throw new InvalidTenantStatusError("租户状态不允许激活");
    }

    const previousStatus = this.status;
    this.status = TenantStatus.Active;

    this.addDomainEvent(
      new TenantActivatedEvent({
        tenantId: this.id,
        tenantName: this.tenantName.value,
        previousStatus,
        currentStatus: this.status,
        auditMetadata: this.auditTrail.toMetadata(),
      }),
    );

    this.touch();
  }
}
```

#### 创建值对象

```typescript
// libs/modules/tenant/src/domains/tenant/value-objects/tenant-name.vo.ts
export class TenantName extends ValueObject {
  private constructor(public readonly value: string) {
    super();
    this.validate();
  }

  static create(value: string): TenantName {
    return new TenantName(value);
  }

  private validate(): void {
    if (!this.value || this.value.length < 1 || this.value.length > 100) {
      throw new InvalidTenantNameError("租户名称长度必须在1-100字符之间");
    }

    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/.test(this.value)) {
      throw new InvalidTenantNameError("租户名称仅允许中文、英文、数字、连字符和下划线");
    }
  }
}
```

### 2. 应用层开发

#### 创建命令处理器

```typescript
// libs/modules/tenant/src/application/commands/create-tenant.command.ts
export class CreateTenantCommand extends CaslCommandBase<{ tenantId: string }> {
  public readonly tenantName: TenantName;
  public readonly contactInfo: TenantContactInfo;
  public readonly context: TenantContext;
  public readonly profile?: TenantProfile;
  public readonly createdBy: string;

  constructor(context: SecurityContext, data: CreateTenantCommandData) {
    super(context);
    this.tenantName = data.tenantName;
    this.contactInfo = data.contactInfo;
    this.context = data.context;
    this.profile = data.profile;
    this.createdBy = data.createdBy;
  }

  public abilityDescriptor(): AbilityDescriptor {
    return {
      action: "create",
      subject: "Tenant",
    };
  }
}

// libs/modules/tenant/src/application/commands/create-tenant.handler.ts
@CommandHandler(CreateTenantCommand)
export class CreateTenantHandler extends CaslCommandHandler<CreateTenantCommand, { tenantId: string }> {
  constructor(
    abilityCoordinator: CaslAbilityCoordinator,
    auditCoordinator: AuditCoordinator,
    private readonly tenantRepository: TenantRepository,
    @Inject("EventStore") private readonly eventStore: EventStore,
    @Inject("EventPublisher") private readonly eventPublisher: EventPublisher,
    private readonly logger: LoggerService,
  ) {
    super(abilityCoordinator, auditCoordinator);
  }

  protected async handle(command: CreateTenantCommand): Promise<{ tenantId: string }> {
    // 1. 权限验证（由 CaslCommandHandler 基类处理）

    // 2. 校验租户名称唯一性
    const systemTenantId = AggregateId.fromString(command.context.tenantId);
    const existingTenant = await this.tenantRepository.findByName(command.tenantName, systemTenantId);

    if (existingTenant) {
      throw new DomainException(`租户名称 "${command.tenantName.value}" 已存在，请使用其他名称`);
    }

    // 3. 创建聚合根
    const userId = UserId.create(command.context.userId);
    const tenant = TenantAggregate.create({
      tenantName: command.tenantName,
      contactInfo: command.contactInfo,
      context: command.context,
      profile: command.profile,
      createdBy: userId,
    });

    // 4. 保存事件流
    await this.tenantRepository.save(tenant);

    // 5. 发布领域事件（由仓储实现自动处理）

    return {
      tenantId: tenant.id.toString(),
    };
  }
}
```

#### 创建查询处理器

```typescript
// libs/modules/tenant/src/application/queries/list-tenants.query.ts
export class ListTenantsQuery extends CaslQueryBase<PaginatedResponse<TenantListItem>> {
  public readonly status?: string;
  public readonly keyword?: string;
  public readonly page: number;
  public readonly pageSize: number;
  public readonly includeDeleted: boolean;

  constructor(context: SecurityContext, data: ListTenantsQueryData) {
    super(context);
    this.status = data.status;
    this.keyword = data.keyword;
    this.page = data.page ?? 1;
    this.pageSize = data.pageSize ?? 20;
    this.includeDeleted = data.includeDeleted ?? false;
  }

  public abilityDescriptor(): AbilityDescriptor {
    return {
      action: "read",
      subject: "Tenant",
    };
  }
}

// libs/modules/tenant/src/application/queries/list-tenants.handler.ts
@QueryHandler(ListTenantsQuery)
export class ListTenantsHandler extends CaslQueryHandler<ListTenantsQuery> implements IQueryHandler<ListTenantsQuery> {
  constructor(private readonly projectionRepository: TenantProjectionRepository) {
    super();
  }

  async execute(query: ListTenantsQuery): Promise<TenantListResponse> {
    // 权限验证（由 CaslQueryHandler 基类处理）

    const result = await this.projectionRepository.findByCriteria({
      tenantId: query.securityContext.tenantId,
      status: query.status,
      keyword: query.keyword,
      page: query.page,
      pageSize: query.pageSize,
      includeDeleted: query.includeDeleted,
    });

    return TenantListResponse.fromProjection(result);
  }
}
```

### 3. 基础设施层开发

#### 实现仓储

```typescript
// libs/modules/tenant/src/infrastructure/repositories/tenant.repository.impl.ts
@Injectable()
export class TenantRepositoryImpl implements TenantRepository {
  constructor(
    private readonly eventStore: EventStore,
    @InjectRepository(TenantProjection)
    private readonly projectionRepo: EntityRepository<TenantProjection>,
  ) {}

  async save(aggregate: TenantAggregate): Promise<void> {
    await this.eventStore.saveMultiTenantAggregate(aggregate);
  }

  async findById(id: TenantId): Promise<TenantAggregate | null> {
    const events = await this.eventStore.getEventsByAggregateId(id.value);
    if (events.length === 0) {
      return null;
    }

    return TenantAggregate.replay(events);
  }

  async findByName(name: TenantName, tenantId: AggregateId): Promise<TenantAggregate | null> {
    // 从读模型查询
    const projection = await this.em.findOne(TenantProjection, {
      tenantName: name.value,
      isDeleted: false,
    });

    if (!projection) {
      return null;
    }

    const aggregateId = AggregateId.fromString(projection.tenantId);
    return this.findById(aggregateId);
  }
}
```

#### 实现投影处理器

```typescript
// libs/modules/tenant/src/infrastructure/projections/tenant.projection.ts
@EventsHandler(TenantCreatedEvent)
export class TenantProjectionHandler implements IEventHandler<TenantCreatedEvent> {
  constructor(
    @InjectRepository(TenantProjection)
    private readonly repo: EntityRepository<TenantProjection>,
  ) {}

  async handle(event: TenantCreatedEvent): Promise<void> {
    const projection = new TenantProjection({
      tenantId: event.tenantId.value,
      tenantName: event.tenantName,
      status: event.status.value,
      contactInfo: event.contactInfo,
      context: event.context,
      profile: event.profile,
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
      isDeleted: false,
    });

    await this.repo.persistAndFlush(projection);
  }
}
```

### 4. 接口层开发

#### 创建控制器

```typescript
// libs/modules/tenant/src/interfaces/controllers/tenant-command.controller.ts
@Controller("tenants")
@UseGuards(MultiTenantAuthGuard, CaslGuard)
export class TenantCommandController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: "创建租户" })
  async createTenant(@Body() dto: CreateTenantDto): Promise<TenantResponse> {
    const command = new CreateTenantCommand(dto.tenantName, dto.contactInfo, dto.context, dto.profile);

    return await this.commandBus.execute(command);
  }

  @Post(":id/activate")
  @ApiOperation({ summary: "启用租户" })
  async activateTenant(@Param("id") id: string): Promise<TenantResponse> {
    const command = new ActivateTenantCommand({
      tenantId: TenantId.fromString(id),
    });

    return await this.commandBus.execute(command);
  }
}
```

## 测试

### 单元测试

```typescript
// libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.spec.ts
describe("TenantAggregate", () => {
  it("应该能够创建租户", () => {
    const tenant = TenantAggregate.create({
      tenantName: "ABC公司",
      contactInfo: {
        contactName: "张三",
        email: "zhangsan@example.com",
      },
      context: {
        defaultOrganizationId: OrganizationId.generate(),
        defaultTimezone: "Asia/Shanghai",
      },
    });

    expect(tenant.status).toBe(TenantStatus.Initialized);
    expect(tenant.getUncommittedEvents()).toHaveLength(1);
    expect(tenant.getUncommittedEvents()[0]).toBeInstanceOf(TenantCreatedEvent);
  });

  it("应该能够激活租户", () => {
    const tenant = TenantAggregate.create({
      /* ... */
    });
    tenant.activate(UserId.generate());

    expect(tenant.status).toBe(TenantStatus.Active);
    expect(tenant.getUncommittedEvents()).toHaveLength(2);
    expect(tenant.getUncommittedEvents()[1]).toBeInstanceOf(TenantActivatedEvent);
  });
});
```

### 集成测试

```typescript
// libs/modules/tenant/tests/integration/tenant-lifecycle.integration.spec.ts
describe("租户生命周期集成测试", () => {
  it("应该能够创建并激活租户", async () => {
    const command = new CreateTenantCommand(/* ... */);
    const tenant = await commandBus.execute(command);

    expect(tenant.status).toBe(TenantStatus.Initialized);

    const activateCommand = new ActivateTenantCommand({
      tenantId: tenant.tenantId,
    });
    const activated = await commandBus.execute(activateCommand);

    expect(activated.status).toBe(TenantStatus.Active);
  });
});
```

## 部署

### 环境变量

```bash
# 数据库配置
DATABASE__HOST=localhost
DATABASE__PORT=5432
DATABASE__DB_NAME=hl8-platform
DATABASE__USER=postgres
DATABASE__PASSWORD=postgres

# Redis 配置（可选）
REDIS__HOST=localhost
REDIS__PORT=6379

# 日志配置
LOG_LEVEL=info
```

### Docker Compose

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: hl8-platform
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

## 下一步

- 查看 [数据模型文档](./data-model.md) 了解详细的数据结构
- 查看 [API 契约文档](./contracts/openapi.yaml) 了解完整的 API 接口
- 查看 [研究文档](./research.md) 了解技术决策和实现模式
