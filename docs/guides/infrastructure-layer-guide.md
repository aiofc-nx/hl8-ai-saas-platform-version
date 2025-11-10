# 基础设施层设计规范 (多租户增强版)

## 📋 文档概述

本文档在原有基础设施层设计规范基础上，增加多租户和数据隔离支持。所有基础设施组件都需要显式处理租户上下文，确保技术实现层面的数据隔离和安全。

## 🎯 核心设计理念

### 1.1 多租户基础设施层定位

**基础设施层**是系统的**多租户技术实现底座**，在 Clean Architecture 中处于最外层，负责：

- 实现多租户数据隔离策略
- 提供租户感知的技术组件
- 管理租户特定的资源配置
- 确保跨租户的技术安全

### 1.2 多租户核心原则

- **租户数据隔离**: 数据库级别隔离 (Schema/Row-level)
- **租户资源隔离**: 连接池、缓存、队列的租户隔离
- **租户配置管理**: 租户特定的技术配置
- **跨租户运维**: 系统级管理租户的技术设施

### 1.3 示例约定

- **✅ 可直接落地示例**：完整展示依赖注入、类型与初始化方式，可直接复制到工程中。
- **⚠️ 伪代码示意**：强调概念或流程的片段，不含全部依赖/配置，需结合项目上下文补齐。

## 🏗 多租户基础设施层结构

### 2.1 分层与职责 (多租户增强)

```
infrastructure/
├── persistence/                   # 多租户数据持久化
│   ├── repositories/              # 多租户仓储实现
│   ├── entities/                  # 多租户数据库实体
│   ├── migrations/                # 多租户数据库迁移
│   ├── seeders/                   # 多租户数据种子
│   ├── mappers/                   # 多租户对象映射器
│   └── multi-tenant/              # 多租户数据隔离
│       ├── tenant-connection.ts   # 租户连接管理
│       ├── schema-manager.ts      # Schema 管理
│       └── data-isolation.ts      # 数据隔离策略
├── external-services/             # 多租户外部服务
├── message-brokers/               # 多租户消息代理
├── caches/                        # 多租户缓存
├── security/                      # 多租户安全
└── config/                        # 多租户配置管理
```

## 💾 多租户数据持久化规范

### 3.1 多租户仓储实现

```typescript
// 多租户仓储基类（命名为 BaseMultiTenantRepository 以避免与接口冲突）
export abstract class BaseMultiTenantRepository<TAggregate extends MultiTenantAggregateRoot> implements MultiTenantRepository<TAggregate> {
  constructor(
    protected readonly em: EntityManager,
    protected readonly mapper: EntityMapper<TAggregate>,
    protected readonly tenantContext: TenantContext,
    protected readonly logger: AppLoggerService /* 来源: @hl8/logger */,
  ) {}

  async findById(id: string, tenantId: TenantId): Promise<TAggregate | null> {
    await this.validateTenantAccess(tenantId);

    try {
      const entity = await this.em.findOne(this.getEntityClass(), id, {
        filters: { tenantFilter: { tenantId: tenantId.value } },
        refresh: true,
      });

      return entity ? this.mapper.toDomain(entity) : null;
    } catch (error) {
      this.logger.error(`Failed to find ${this.getEntityClass().name} by id: ${id}`, error);
      throw new RepositoryError("查询失败", error);
    }
  }

  async findAll(tenantId: TenantId, criteria?: any): Promise<TAggregate[]> {
    await this.validateTenantAccess(tenantId);

    const where = {
      ...criteria,
      tenantId: tenantId.value,
    };

    const entities = await this.em.find(this.getEntityClass(), where, {
      filters: { tenantFilter: { tenantId: tenantId.value } },
    });

    return Promise.all(entities.map((entity) => this.mapper.toDomain(entity)));
  }

  async save(aggregate: TAggregate): Promise<void> {
    await this.validateTenantAccess(aggregate.tenantId);

    await this.em.transactional(async (em) => {
      const entity = this.mapper.toPersistence(aggregate);

      if (await em.exists(this.getEntityClass(), aggregate.id.value)) {
        em.assign(entity, this.mapper.toPersistence(aggregate));
      } else {
        em.persist(entity);
      }

      await em.flush();
    });
  }

  async delete(aggregate: TAggregate): Promise<void> {
    await this.validateTenantAccess(aggregate.tenantId);
    await this.em.nativeDelete(this.getEntityClass(), aggregate.id.value);
  }

  async exists(id: string, tenantId: TenantId): Promise<boolean> {
    await this.validateTenantAccess(tenantId);
    return await this.em.exists(this.getEntityClass(), {
      id,
      tenantId: tenantId.value,
    });
  }

  protected abstract getEntityClass(): EntityClass<any>;

  protected async validateTenantAccess(tenantId: TenantId): Promise<void> {
    const currentTenantId = this.tenantContext.getCurrentTenant();

    if (!currentTenantId.equals(tenantId)) {
      throw new CrossTenantAccessError("跨租户数据访问被禁止");
    }
  }
}

// 多租户组织仓储实现
@Repository(Organization)
export class MikroOrmOrganizationRepository extends BaseMultiTenantRepository<Organization> implements OrganizationRepository {
  constructor(em: EntityManager, mapper: OrganizationMapper, tenantContext: TenantContext, logger: AppLoggerService) {
    super(em, mapper, tenantContext, logger);
  }

  protected getEntityClass(): EntityClass<OrganizationEntity> {
    return OrganizationEntity;
  }

  async findByName(name: string, tenantId: TenantId): Promise<Organization | null> {
    await this.validateTenantAccess(tenantId);

    const entity = await this.em.findOne(
      OrganizationEntity,
      {
        name,
        tenantId: tenantId.value,
      },
      {
        filters: { tenantFilter: { tenantId: tenantId.value } },
      },
    );

    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByCode(code: string, tenantId: TenantId): Promise<Organization | null> {
    await this.validateTenantAccess(tenantId);

    const entity = await this.em.findOne(
      OrganizationEntity,
      {
        code,
        tenantId: tenantId.value,
      },
      {
        filters: { tenantFilter: { tenantId: tenantId.value } },
      },
    );

    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findOrganizationsByStatus(status: OrganizationStatus, tenantId: TenantId): Promise<Organization[]> {
    await this.validateTenantAccess(tenantId);

    const entities = await this.em.find(
      OrganizationEntity,
      {
        status,
        tenantId: tenantId.value,
      },
      {
        filters: { tenantFilter: { tenantId: tenantId.value } },
        orderBy: { createdAt: QueryOrder.DESC },
      },
    );

    return Promise.all(entities.map((entity) => this.mapper.toDomain(entity)));
  }
}
```

> 注：文中 `AppLoggerService` 由 `@hl8/logger` 提供，负责统一的结构化日志输出；测试环境可通过 `@hl8/logger/testing` 提供的 `createMock<AppLoggerService>()` 生成替身。

### 3.2 多租户数据库实体

```typescript
// 多租户实体基类
export abstract class MultiTenantEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  tenantId!: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ nullable: true })
  deletedAt?: Date;

  @Property({ version: true })
  version!: number;
}

// 领域 ID 提醒：所有持久化实体 ID 均采用 PostgreSQL `uuid` 类型，需与领域层 UUID v4 值对象保持一致。

// 租户实体
@Entity({ tableName: 'tenants' })
export class TenantEntity extends MultiTenantEntity {
  @Property()
  name!: string;

  @Property()
  subdomain!: string;

  @Enum({ items: () => TenantStatus, type: 'string' })
  status!: TenantStatus;

  @Property({ type: 'json' })
  config!: any;

  @Property({ type: 'json' })
  subscription!: any;

  @Property({ nullable: true })
  suspendedAt?: Date;

  @Property({ nullable: true })
  suspendedReason?: string;

  // 租户特定的索引
  @Index({ name: 'idx_tenant_subdomain', properties: ['subdomain'] })
  @Index({ name: 'idx_tenant_status', properties: ['status'] })
}

// 组织实体
@Entity({ tableName: 'organizations' })
export class OrganizationEntity extends MultiTenantEntity {
  @Property()
  name!: string;

  @Property()
  code!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Enum({ items: () => OrganizationStatus, type: 'string' })
  status!: OrganizationStatus;

  @Property({ type: 'json' })
  settings!: any;

  // 租户内组织代码唯一性
  @Unique({ name: 'uq_organization_tenant_code', properties: ['tenantId', 'code'] })

  @Index({ name: 'idx_organization_tenant', properties: ['tenantId'] })
  @Index({ name: 'idx_organization_status', properties: ['status'] })
}

// 部门实体
@Entity({ tableName: 'departments' })
export class DepartmentEntity extends MultiTenantEntity {
  @Property({ type: 'uuid' })
  organizationId!: string;

  @Property({ type: 'uuid', nullable: true })
  parentDepartmentId?: string;

  @Property()
  name!: string;

  @Property()
  code!: string;

  @Property()
  path!: string; // 部门路径，用于层级查询

  @Property()
  level!: number;

  @Enum({ items: () => DepartmentStatus, type: 'string' })
  status!: DepartmentStatus;

  @Property({ type: 'json' })
  settings!: any;

  @ManyToOne(() => OrganizationEntity, { nullable: false })
  organization!: OrganizationEntity;

  @ManyToOne(() => DepartmentEntity, { nullable: true })
  parentDepartment?: DepartmentEntity;

  @OneToMany(() => DepartmentEntity, dept => dept.parentDepartment)
  childDepartments = new Collection<DepartmentEntity>(this);

  // 租户内部门路径唯一性
  @Unique({ name: 'uq_department_tenant_path', properties: ['tenantId', 'path'] })

  @Index({ name: 'idx_department_organization', properties: ['organizationId'] })
  @Index({ name: 'idx_department_path', properties: ['path'] })
  @Index({ name: 'idx_department_parent', properties: ['parentDepartmentId'] })
}

// 多租户事件存储实体
@Entity({ tableName: 'domain_events' })
export class EventEntity extends MultiTenantEntity {
  @Property({ type: 'uuid' })
  eventId!: string;

  @Property({ type: 'uuid' })
  aggregateId!: string;

  @Property()
  aggregateType!: string;

  @Property()
  eventType!: string;

  @Property({ type: 'json' })
  eventData!: any;

  @Property()
  occurredOn!: Date;

  @Index({ name: 'idx_events_tenant_aggregate', properties: ['tenantId', 'aggregateId'] })
  @Index({ name: 'idx_events_tenant_type', properties: ['tenantId', 'eventType'] })
  @Index({ name: 'idx_events_tenant_occurred', properties: ['tenantId', 'occurredOn'] })
}
```

> 多层次隔离说明：所有实体均显式携带 `tenantId`。`OrganizationEntity` 通过 `tenantId + code` 的唯一约束与 `tenantId` 索引落实现租户级隔离；`DepartmentEntity` 额外持有 `organizationId`、`parentDepartmentId`、`path` 等字段，并建立 `tenantId + path` 唯一键与多列索引，以保障“租户 → 组织 → 部门”三级过滤的性能与安全边界。

### 3.3 多租户对象映射器

```typescript
// 多租户映射器基类
export abstract class MultiTenantMapper<TDomain extends MultiTenantAggregateRoot, TEntity extends MultiTenantEntity> {
  constructor(protected readonly logger: AppLoggerService /* 来源: @hl8/logger */) {}

  abstract toDomain(entity: TEntity): TDomain;
  abstract toPersistence(domain: TDomain): TEntity;

  protected validateTenantConsistency(domain: TDomain, entity: TEntity): void {
    if (domain.tenantId.value !== entity.tenantId) {
      throw new MappingError("租户ID不一致");
    }
  }
}

// 组织映射器
@Injectable()
export class OrganizationMapper extends MultiTenantMapper<Organization, OrganizationEntity> {
  toDomain(entity: OrganizationEntity): Organization {
    try {
      const organization = Organization.reconstituteFromSnapshot({
        id: OrganizationId.create(entity.id),
        tenantId: TenantId.create(entity.tenantId),
        name: entity.name,
        code: entity.code,
        description: entity.description,
        status: entity.status as OrganizationStatus,
        settings: entity.settings,
        createdAt: DateTime.fromJSDate(entity.createdAt),
        updatedAt: DateTime.fromJSDate(entity.updatedAt),
        version: entity.version,
      });

      return organization;
    } catch (error) {
      this.logger.error("Failed to map OrganizationEntity to Domain", error);
      throw new MappingError("组织实体映射失败", error);
    }
  }

  toPersistence(organization: Organization): OrganizationEntity {
    const entity = new OrganizationEntity();
    entity.id = organization.id.value;
    entity.tenantId = organization.tenantId.value;
    entity.name = organization.name;
    entity.code = organization.code;
    entity.description = organization.description;
    entity.status = organization.status;
    entity.settings = organization.settings;
    entity.version = organization.version;

    this.validateTenantConsistency(organization, entity);

    return entity;
  }
}
```

### 3.4 多租户数据库配置

```typescript
// 多租户 MikroORM 配置
export class MultiTenantMikroORMConfig {
  static createDefaultConfig(): Options {
    return {
      // 多租户实体
      entities: [
        TenantEntity,
        OrganizationEntity,
        DepartmentEntity,
        EventEntity,
        // ... 其他多租户实体
      ],
      entitiesTs: ["./src/infrastructure/persistence/entities"],

      // 多租户数据库配置
      dbName: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      type: "postgresql",

      // 多租户 Schema 策略
      schema: this.getTenantSchema(), // 动态 Schema

      // 多租户过滤器
      filters: {
        tenantFilter: {
          cond: (args) => ({ tenantId: args.tenantId }),
          default: false,
          args: false,
        },
      },

      // 迁移配置 (多租户感知)
      migrations: {
        path: "./src/infrastructure/persistence/migrations",
        transactional: true,
        allOrNothing: true,
        // 多租户迁移策略
        safe: false, // 允许修改表结构
      },

      // 性能优化 (多租户级别)
      batchSize: 100, // 较小的批次大小，适应多租户
      loadStrategy: LoadStrategy.SELECT_IN, // 更好的多租户性能

      // 连接池配置 (多租户优化)
      pool: {
        min: 2,
        max: 20, // 更多的连接处理多租户
        acquireTimeoutMillis: 30000, // 更长的超时时间
      },

      // 多租户缓存配置
      resultCache: {
        expiration: 1000 * 60 * 10, // 10分钟缓存
      },

      // 驱动选项
      driverOptions: {
        connection: {
          ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
          statement_timeout: 30000, // 30秒超时
        },
      },
    } as Options;
  }

  private static getTenantSchema(): string | undefined {
    // 动态获取当前租户的 Schema
    const tenantContext = TenantContextHolder.getCurrentContext();
    return tenantContext?.tenantId?.value || "public";
  }
}

// 租户连接管理器
@Injectable()
export class TenantConnectionManager {
  private readonly tenantConnections = new Map<string, EntityManager>();
  private baseORM!: MikroORM;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * ✅ 可直接落地示例：在模块初始化阶段调用，用于建立基础 ORM 连接。
   */
  async initialize(): Promise<void> {
    if (this.baseORM) {
      return;
    }

    this.baseORM = await MikroORM.init(MultiTenantMikroORMConfig.createDefaultConfig());
    this.logger.info("TenantConnectionManager 初始化完成");
  }

  async getEntityManager(tenantId: TenantId): Promise<EntityManager> {
    const tenantKey = tenantId.value;

    if (this.tenantConnections.has(tenantKey)) {
      return this.tenantConnections.get(tenantKey)!;
    }

    if (!this.baseORM) {
      throw new Error("TenantConnectionManager 尚未初始化，需先调用 initialize()");
    }

    // 创建租户特定的 EntityManager
    const em = this.baseORM.em.fork({
      schema: tenantKey, // 使用租户ID作为Schema
      filters: { tenantFilter: { tenantId: tenantKey } },
    });

    this.tenantConnections.set(tenantKey, em);
    return em;
  }

  async closeTenantConnection(tenantId: TenantId): Promise<void> {
    const tenantKey = tenantId.value;
    const em = this.tenantConnections.get(tenantKey);

    if (em) {
      await em.getConnection().close();
      this.tenantConnections.delete(tenantKey);
    }
  }

  async closeAllConnections(): Promise<void> {
    for (const [tenantKey, em] of this.tenantConnections) {
      await em.getConnection().close();
    }
    this.tenantConnections.clear();
    await this.baseORM.close();
  }
}
```

### 3.5 多租户事件存储实现

```typescript
@Injectable()
export class MultiTenantEventStore implements DomainEventStore {
  constructor(
    private readonly connectionManager: TenantConnectionManager,
    private readonly eventSerializer: EventSerializer,
    private readonly logger: AppLoggerService /* 来源: @hl8/logger */,
  ) {}

  async saveEvents(aggregateId: string, events: MultiTenantDomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    // 按租户分组事件
    const eventsByTenant = this.groupEventsByTenant(events);

    for (const [tenantId, tenantEvents] of eventsByTenant) {
      const em = await this.connectionManager.getEntityManager(tenantId);

      await em.transactional(async (em) => {
        const eventEntities = tenantEvents.map((event, index) => {
          const entity = new EventEntity();
          entity.eventId = event.eventId;
          entity.tenantId = event.tenantId.value;
          entity.aggregateId = aggregateId;
          entity.aggregateType = this.getAggregateType(event);
          entity.eventType = event.eventType;
          entity.eventData = this.eventSerializer.serialize(event);
          entity.occurredOn = event.occurredOn;
          entity.version = index + 1;
          return entity;
        });

        await em.persistAndFlush(eventEntities);
      });

      this.logger.debug(`Saved ${tenantEvents.length} events for tenant ${tenantId.value}`);
    }
  }

  async getEvents(aggregateId: string, tenantId: TenantId): Promise<MultiTenantDomainEvent[]> {
    const em = await this.connectionManager.getEntityManager(tenantId);

    const eventEntities = await em.find(
      EventEntity,
      { aggregateId },
      {
        orderBy: { version: QueryOrder.ASC },
        filters: { tenantFilter: { tenantId: tenantId.value } },
      },
    );

    return eventEntities.map((entity) => this.eventSerializer.deserialize(entity.eventData, entity.eventType) as MultiTenantDomainEvent);
  }

  async getEventsByType(eventType: string, tenantId: TenantId, since?: Date): Promise<MultiTenantDomainEvent[]> {
    const em = await this.connectionManager.getEntityManager(tenantId);

    const where: any = {
      eventType,
      tenantId: tenantId.value,
    };

    if (since) {
      where.occurredOn = { $gte: since };
    }

    const eventEntities = await em.find(EventEntity, where, {
      orderBy: { occurredOn: QueryOrder.ASC },
      filters: { tenantFilter: { tenantId: tenantId.value } },
    });

    return eventEntities.map((entity) => this.eventSerializer.deserialize(entity.eventData, entity.eventType) as MultiTenantDomainEvent);
  }

  async getEventCount(aggregateId: string, tenantId: TenantId): Promise<number> {
    const em = await this.connectionManager.getEntityManager(tenantId);
    return await em.count(EventEntity, {
      aggregateId,
      tenantId: tenantId.value,
    });
  }

  private groupEventsByTenant(events: MultiTenantDomainEvent[]): Map<TenantId, MultiTenantDomainEvent[]> {
    const grouped = new Map<TenantId, MultiTenantDomainEvent[]>();

    for (const event of events) {
      if (!grouped.has(event.tenantId)) {
        grouped.set(event.tenantId, []);
      }
      grouped.get(event.tenantId)!.push(event);
    }

    return grouped;
  }

  private getAggregateType(event: MultiTenantDomainEvent): string {
    return event.constructor.name.replace(/Event$/, "");
  }
}
```

## 🔧 多租户特定最佳实践

### 4.1 多租户事务管理

```typescript
@Injectable()
export class MultiTenantTransactionalService {
  constructor(
    private readonly connectionManager: TenantConnectionManager,
    private readonly tenantContext: TenantContext,
  ) {}

  async executeInTenantTransaction<T>(work: (em: EntityManager) => Promise<T>, tenantId?: TenantId, options: { isolationLevel?: IsolationLevel } = {}): Promise<T> {
    const targetTenantId = tenantId || this.tenantContext.getCurrentTenant();
    const em = await this.connectionManager.getEntityManager(targetTenantId);

    return await em.transactional(async (em) => {
      // 设置当前租户上下文
      TenantContextHolder.setCurrentTenant(targetTenantId);

      try {
        return await work(em);
      } finally {
        // 清理租户上下文
        TenantContextHolder.clear();
      }
    }, options);
  }

  // 跨租户事务 (仅限超级管理员)
  async executeCrossTenantTransaction<T>(work: (tenantEmMap: Map<TenantId, EntityManager>) => Promise<T>, tenantIds: TenantId[], options: { isolationLevel?: IsolationLevel } = {}): Promise<T> {
    // 验证超级管理员权限
    if (!this.tenantContext.isSuperAdmin()) {
      throw new AuthorizationError("无权执行跨租户事务");
    }

    // 获取所有租户的 EntityManager
    const tenantEmMap = new Map<TenantId, EntityManager>();

    for (const tenantId of tenantIds) {
      const em = await this.connectionManager.getEntityManager(tenantId);
      tenantEmMap.set(tenantId, em);
    }

    // 使用第一个租户的 EntityManager 作为事务协调器
    const primaryEm = tenantEmMap.values().next().value;

    return await primaryEm.transactional(async () => {
      try {
        return await work(tenantEmMap);
      } catch (error) {
        // 跨租户事务回滚
        this.logger.error("Cross-tenant transaction failed", error);
        throw error;
      }
    }, options);
  }
}
```

### 4.2 多租户查询优化

```typescript
@Injectable()
export class MultiTenantQueryService {
  constructor(
    private readonly connectionManager: TenantConnectionManager,
    private readonly tenantContext: TenantContext,
  ) {}

  async findOrganizationsWithStats(tenantId: TenantId, criteria: OrganizationQueryCriteria): Promise<OrganizationStats[]> {
    const em = await this.connectionManager.getEntityManager(tenantId);

    const qb = em.createQueryBuilder(OrganizationEntity, "org");

    qb.select(["org.id", "org.name", "org.code", "org.status", "org.createdAt", "COUNT(DISTINCT dept.id) as departmentCount", "COUNT(DISTINCT member.id) as memberCount"])
      .leftJoin("org.departments", "dept")
      .leftJoin("dept.members", "member")
      .where(this.buildTenantWhereClause(tenantId, criteria))
      .groupBy("org.id")
      .orderBy({ "org.createdAt": QueryOrder.DESC })
      .limit(criteria.limit || 50)
      .offset(criteria.offset || 0);

    // 应用租户过滤器
    qb.setFilter("tenantFilter", { tenantId: tenantId.value });

    const results = await qb.getResult();
    return this.toOrganizationStats(results);
  }

  async findDepartmentTree(tenantId: TenantId, organizationId: OrganizationId): Promise<DepartmentTree> {
    const em = await this.connectionManager.getEntityManager(tenantId);

    // 使用递归CTE查询部门树
    const sql = `
      WITH RECURSIVE department_tree AS (
        SELECT 
          id, name, code, path, level, parent_department_id,
          1 as depth,
          ARRAY[id] as path_ids
        FROM departments 
        WHERE tenant_id = ? AND organization_id = ? AND parent_department_id IS NULL
        
        UNION ALL
        
        SELECT 
          d.id, d.name, d.code, d.path, d.level, d.parent_department_id,
          dt.depth + 1 as depth,
          dt.path_ids || d.id as path_ids
        FROM departments d
        INNER JOIN department_tree dt ON d.parent_department_id = dt.id
        WHERE d.tenant_id = ?
      )
      SELECT * FROM department_tree ORDER BY path_ids
    `;

    const results = await em.execute(sql, [tenantId.value, organizationId.value, tenantId.value]);

    return this.buildDepartmentTreeFromRows(results);
  }

  private buildTenantWhereClause(tenantId: TenantId, criteria: OrganizationQueryCriteria): any {
    const where: any = {
      tenantId: tenantId.value,
    };

    if (criteria.status) {
      where.status = { $in: criteria.status };
    }

    if (criteria.createdAfter) {
      where.createdAt = { $gte: criteria.createdAfter };
    }

    return where;
  }
}
```

## 🧪 多租户测试规范

### 5.1 多租户仓储测试

```typescript
describe("MikroOrmOrganizationRepository (Multi-tenant)", () => {
  let repository: MikroOrmOrganizationRepository;
  let tenantA: Tenant;
  let tenantB: Tenant;
  let connectionManager: TenantConnectionManager;

  beforeAll(async () => {
    connectionManager = new TenantConnectionManager();

    // 创建测试租户
    tenantA = Tenant.create({ name: "租户A", subdomain: "tenant-a" });
    tenantB = Tenant.create({ name: "租户B", subdomain: "tenant-b" });
  });

  beforeEach(async () => {
    // 为每个租户创建独立的测试数据库或Schema
    await this.setupTenantSchema(tenantA);
    await this.setupTenantSchema(tenantB);
  });

  it("应该确保租户数据隔离", async () => {
    // Given - 在租户A创建组织
    const orgA = Organization.create({
      tenantId: tenantA.id,
      name: "租户A组织",
      code: "TENANT_A_ORG",
    });

    const logger = createMock<AppLoggerService>(); // 来自 @hl8/logger/testing

    const repositoryA = new MikroOrmOrganizationRepository(await connectionManager.getEntityManager(tenantA.id), new OrganizationMapper(), new TenantContext(tenantA.id), logger);

    await repositoryA.save(orgA);

    // When - 在租户B查询组织
    const repositoryB = new MikroOrmOrganizationRepository(await connectionManager.getEntityManager(tenantB.id), new OrganizationMapper(), new TenantContext(tenantB.id), logger);

    const orgFromTenantB = await repositoryB.findById(orgA.id.value, tenantB.id);

    // Then - 租户B不应该看到租户A的数据
    expect(orgFromTenantB).toBeNull();
  });

  it("应该拒绝跨租户数据访问", async () => {
    // Given
    const repository = new MikroOrmOrganizationRepository(await connectionManager.getEntityManager(tenantA.id), new OrganizationMapper(), new TenantContext(tenantA.id), logger);

    // When & Then - 尝试用租户A的仓储访问租户B的数据应该失败
    await expect(repository.findById("some-id", tenantB.id)).rejects.toThrow(CrossTenantAccessError);
  });
});
```

## 🔍 多租户设计决策

### 6.1 多租户数据隔离策略

| 策略               | 实现方式                              | 优点             | 缺点                       | 适用场景               |
| ------------------ | ------------------------------------- | ---------------- | -------------------------- | ---------------------- |
| **Schema 隔离**    | 每个租户独立 Schema                   | 完全隔离，性能好 | 管理复杂                   | 企业级SaaS             |
| **Row-level 隔离** | 所有租户共享Schema，通过tenant_id过滤 | 简单，扩展性好   | 数据混合，安全性依赖应用层 | 中小型SaaS             |
| **Database 隔离**  | 每个租户独立数据库                    | 最高级别隔离     | 成本高，管理复杂           | 金融、医疗等高安全要求 |

### 6.2 多租户性能优化策略

```typescript
// 多租户连接池优化
@Injectable()
export class MultiTenantConnectionPool {
  private readonly tenantPools = new Map<string, DatabasePool>();
  private readonly config: MultiTenantPoolConfig;

  constructor(configService: ConfigService) {
    this.config = {
      maxConnectionsPerTenant: configService.get("DB_MAX_CONNECTIONS_PER_TENANT", 10),
      idleTimeout: configService.get("DB_IDLE_TIMEOUT", 30000),
      connectionTimeout: configService.get("DB_CONNECTION_TIMEOUT", 10000),
    };
  }

  async getConnection(tenantId: TenantId): Promise<DatabaseConnection> {
    const pool = await this.getOrCreatePool(tenantId);
    return await pool.getConnection();
  }

  private async getOrCreatePool(tenantId: TenantId): Promise<DatabasePool> {
    const tenantKey = tenantId.value;

    if (!this.tenantPools.has(tenantKey)) {
      const pool = this.createTenantPool(tenantId);
      this.tenantPools.set(tenantKey, pool);
    }

    return this.tenantPools.get(tenantKey)!;
  }

  private createTenantPool(tenantId: TenantId): DatabasePool {
    return new DatabasePool({
      ...this.config,
      // 租户特定的连接配置
      database: this.getTenantDatabaseName(tenantId),
      schema: tenantId.value,
    });
  }
}
```

## ✅ 总结

### 7.1 多租户基础设施层核心价值

1. **完整数据隔离**: Schema级别隔离，确保租户数据安全
2. **租户资源管理**: 独立的连接池、缓存、队列配置
3. **性能优化**: 租户级别的查询优化和资源分配
4. **运维支持**: 系统级的多租户管理工具

### 7.2 关键特性

- **租户感知仓储**: 自动数据过滤和权限验证
- **多租户实体设计**: 统一的租户ID管理和索引优化
- **动态连接管理**: 按需创建和销毁租户数据库连接
- **跨租户运维**: 系统级的管理和监控能力

### 7.3 合规性保证

- **数据安全**: 物理级别的数据隔离
- **审计追踪**: 完整的租户操作日志
- **性能隔离**: 防止租户间资源竞争
- **备份恢复**: 租户级别的数据保护

这套多租户基础设施层设计为企业级SaaS应用提供了安全、高性能、可扩展的技术基础。

---

_文档版本: 2.0 | 最后更新: 2024-11-XX | 特性: 多租户增强 + 数据隔离_
