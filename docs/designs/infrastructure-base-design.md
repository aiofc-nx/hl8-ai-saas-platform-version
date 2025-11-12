## @hl8/infrastructure-base 详细设计

> 关联基线：`docs/designs/infrastructure-base-baseline.md`

### 1. 背景与目标
- 为 `@hl8/infrastructure-base` 提供事件溯源、事件驱动、权限缓存、审计、配置、日志等能力的详细设计。
- 描述目录组织、接口契约、关键流程与监控指标，为应用层与业务模块提供稳定的基础设施。
- 明确扩展点与运维要求，支撑平台级多租户 SaaS 能力。

### 2. 架构视图
```
┌────────────────────────────────────────┐
│ Infrastructure Core                    │
│ ┌──────────────┐ ┌──────────────┐      │
│ │ EventStore   │ │ EventBus      │      │
│ └──────────────┘ └──────────────┘      │
│ ┌──────────────┐ ┌──────────────┐      │
│ │ CASL Service │ │ Cache Service │      │
│ └──────────────┘ └──────────────┘      │
│ ┌──────────────┐ ┌──────────────┐      │
│ │ Audit Service│ │ Logger       │      │
│ └──────────────┘ └──────────────┘      │
└────────────────────────────────────────┘
                ▲
                │ 接口注入
┌────────────────────────────────────────┐
│ @hl8/application-base / Domain Modules │
└────────────────────────────────────────┘
```

### 3. 目录结构
```
libs/infrastructure-base/
├── audit/
│   ├── audit.service.ts
│   ├── repositories/audit.repository.ts
│   └── entities/audit-log.entity.ts
├── casl/
│   ├── casl-ability.service.ts
│   ├── ability-cache.service.ts
│   └── projections/ability-projection.service.ts
├── cache/
│   ├── cache.module.ts
│   └── drivers/
│       ├── redis-cache.driver.ts
│       └── in-memory-cache.driver.ts
├── eventing/
│   ├── event-bus.module.ts
│   ├── event-publisher.service.ts
│   └── message-broker/
│       ├── message-broker.adapter.ts
│       └── kafka.adapter.ts
├── event-sourcing/
│   ├── event-store.interface.ts
│   ├── mikro-orm-event-store.ts
│   ├── snapshots/
│   │   └── snapshot.service.ts
│   └── utils/aggregate-reconstitution.ts
├── logging/
│   └── logger.provider.ts
├── configuration/
│   ├── infrastructure-config.module.ts
│   └── schemas/infrastructure-config.schema.ts
└── exceptions/
    └── infrastructure-exception.ts
```

### 4. 核心组件设计

#### 4.1 事件存储
```typescript
export interface StoredEvent {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly tenantId: TenantId;
  readonly version: number;
  readonly payload: unknown;
  readonly occurredAt: DateTimeValueObject;
  readonly metadata: Record<string, unknown>;
}

export interface EventStore {
  append(eventStream: StoredEvent[]): Promise<void>;
  load(aggregateId: string, tenantId: TenantId): Promise<StoredEvent[]>;
  loadSince(version: number, tenantId: TenantId): AsyncIterable<StoredEvent>;
}
```

- `append` 在单事务内写入事件与快照，返回未提交事件供发布。
- `load` 支持多租户隔离与乐观锁控制。
- `mikro-orm-event-store.ts` 负责映射到 PostgreSQL，表结构需包含 `tenant_id`、`version` 索引。

#### 4.2 事件发布与投影
```typescript
export class EventPublisher {
  public constructor(
    private readonly eventBus: EventBus,
    private readonly messageBroker: MessageBrokerAdapter,
  ) {}

  public async publish(events: StoredEvent[]): Promise<void> {
    for (const event of events) {
      await this.eventBus.publish(event);
      await this.messageBroker.forward(event);
    }
  }
}
```

- `EventBus` 基于 Nest CQRS。
- `MessageBrokerAdapter` 适配 Kafka/RabbitMQ 等外部消息系统。
- 投影层通过 `@ProjectionHandler` 装饰器注册，默认使用 MikroORM 写入读模型。

#### 4.3 CASL 能力服务
```typescript
export class CaslAbilityService {
  public constructor(
    private readonly cache: AbilityCacheService,
    private readonly projection: AbilityProjectionService,
  ) {}

  public async resolveAbility(context: SecurityContext): Promise<AppAbility> {
    const cacheKey = this.cache.buildKey(context);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const ability = await this.projection.buildAbility(context);
    await this.cache.set(cacheKey, ability);
    return ability;
  }
}
```

- 缓存驱动默认 Redis，可插拔。
- 投影服务可基于事件流或读模型构建权限。
- 触发刷新时需通过消息通知应用层 (`AbilityRefreshedEvent`)。

#### 4.4 审计服务
```typescript
export interface AuditRecord {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly action: string;
  readonly payload: unknown;
  readonly occurredAt: DateTimeValueObject;
}

export class AuditService {
  public constructor(private readonly repository: AuditRepository) {}

  public async append(record: AuditRecord): Promise<void> {
    await this.repository.insert(record);
  }
}
```

- `AuditRepository` 基于 MikroORM 实现，表需包含多租户索引与全文索引。
- 审计存储失败需记录告警，支持重试队列。

#### 4.5 配置模块
```typescript
@Module({
  providers: [
    {
      provide: InfrastructureConfigToken,
      useFactory: () =>
        ConfigFactory.create(InfraConfigSchema, process.env),
    },
  ],
  exports: [InfrastructureConfigToken],
})
export class InfrastructureConfigModule {}
```

- 配置类使用 `class-validator` 注解字段，保证运行时校验。
- 支持多环境覆盖与密钥管理。

### 5. 流程设计

1. **命令执行后发布事件**  
   - 应用层保存聚合，调用 `EventStore.append`。  
   - `EventPublisher.publish` 将事件投递到 EventBus 与消息队列。  
   - 投影监听事件更新读模型，权限变更事件触发 `CaslAbilityService` 刷新缓存。

2. **权限缓存预热**  
   - 权限变更投影完成后发送 `AbilityCacheInvalidatedEvent`。  
   - `AbilityCacheService` 根据租户/用户维度清理缓存，并触发预热任务。

3. **审计记录**  
   - 应用层审计协调器调用 `AuditService.append`。  
   - 审计写入数据库，失败时写入重试队列并告警。

### 6. 测试与监控
- 提供内存版事件存储、缓存、消息适配器，用于单元测试。
- 集成测试需覆盖：
  - 事件写入→读取→发布链路。
  - 权限缓存命中/失效。
  - 审计写入与失败重试。
- 监控指标通过 Prometheus/OpenTelemetry 采集，包含事件吞吐、缓存命中率、审计失败率等。

### 7. 运维策略
- 发布前执行数据库迁移（事件表、审计表、缓存表）。
- 配置在 `InfrastructureConfigModule` 注册，需通过配置中心或环境变量加载。
- 建立告警策略：事件处理延迟、死信堆积、缓存命中率低。

### 8. 扩展点
- **EventStore**：可扩展至 DynamoDB/云原生事件存储，实现需满足接口契约。
- **MessageBrokerAdapter**：支持 Kafka、RabbitMQ、RocketMQ、自研总线。
- **AbilityCacheService**：可接入多级缓存、分布式缓存集群。
- **AuditRepository**：支持 PostgreSQL、MongoDB、Elasticsearch。

### 9. 版本管理
- 所有接口变更需在 `CHANGELOG.md` 记录，并发布迁移指南。
- 使用语义化版本管理，应用层在升级前需评估兼容性。
- 重大升级需同步更新 `docs/designs/application-base-design.md`，确保依赖关系清晰。

