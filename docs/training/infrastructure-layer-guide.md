# 基础设施层设计规范 (MikroORM + PostgreSQL 版本)

## 📋 文档概述

本文档定义了基于 DDD + Clean Architecture + CQRS + ES + EDA 混合架构的基础设施层设计原则和实施规范，特别针对 MikroORM + PostgreSQL 技术栈进行优化。

## 🎯 核心设计理念

### 1.1 基础设施层定位

**基础设施层**是系统的**技术实现底座**，在 Clean Architecture 中处于最外层，负责实现内部层定义的接口，提供具体的技术能力。

### 1.2 MikroORM 特定优势

- **Unit of Work 模式**: 自动管理事务和变更跟踪
- **Identity Map**: 确保同一实体在上下文中的唯一性
- **数据映射器**: 清晰的领域模型与数据模型分离
- **TypeScript 优先**: 优秀的类型支持和开发体验

## 🏗 基础设施层结构规范

### 2.1 分层与职责

```
infrastructure/
├── persistence/                   # 数据持久化
│   ├── repositories/              # 仓储实现 (MikroORM)
│   ├── entities/                  # 数据库实体
│   ├── migrations/                # 数据库迁移
│   ├── seeders/                   # 数据种子
│   └── mappers/                   # 领域-实体映射器
├── external-services/             # 外部服务集成
├── message-brokers/               # 消息代理
├── caches/                        # 缓存实现
└── config/                        # 配置管理
```

## 💾 数据持久化规范 (MikroORM)

### 3.1 MikroORM 仓储实现

```typescript
// 基于 MikroORM 的仓储实现
@Repository(Order)
export class MikroOrmOrderRepository implements OrderRepository {
  constructor(
    private readonly em: EntityManager,
    private readonly orderMapper: OrderMapper,
    private readonly eventStore: DomainEventStore,
    private readonly logger: Logger
  ) {}

  async findById(id: OrderId): Promise<Order | null> {
    try {
      // 事件溯源：从事件存储重建聚合
      const events = await this.eventStore.getEvents(id.value);
      if (events.length > 0) {
        this.logger.debug(`Reconstituting order ${id.value} from ${events.length} events`);
        return Order.reconstitute(events);
      }

      // 快照方式：从数据库实体转换
      const orderEntity = await this.em.findOne(OrderEntity, id.value, {
        populate: ['items', 'payments'],
        refresh: true
      });

      if (!orderEntity) {
        return null;
      }

      return this.orderMapper.toDomain(orderEntity);

    } catch (error) {
      this.logger.error(`Failed to find order by id: ${id.value}`, error);
      throw new RepositoryError('查询订单失败', error);
    }
  }

  async save(order: Order): Promise<void> {
    const strategy = await this.selectPersistenceStrategy(order);
    
    await this.em.transactional(async (em) => {
      // 保存领域事件到事件存储
      if (order.domainEvents.length > 0) {
        await this.eventStore.saveEvents(order.id.value, order.domainEvents);
        order.clearEvents();
      }

      // 根据策略保存状态快照
      switch (strategy) {
        case 'event-sourcing-only':
          // 仅事件溯源，不保存快照
          break;
        case 'snapshot-only':
          await this.saveSnapshot(order, em);
          break;
        case 'both':
          await this.saveSnapshot(order, em);
          break;
      }
    });
  }

  private async selectPersistenceStrategy(order: Order): Promise<PersistenceStrategy> {
    // 根据业务规则选择持久化策略
    if (order.version < 10) {
      return 'both'; // 新聚合同时保存事件和快照
    }
    
    const eventCount = await this.eventStore.getEventCount(order.id.value);
    if (eventCount > 100) {
      return 'snapshot-only'; // 事件太多时只保存快照
    }
    
    return 'event-sourcing-only'; // 默认仅事件溯源
  }

  private async saveSnapshot(order: Order, em: EntityManager): Promise<void> {
    const orderEntity = this.orderMapper.toPersistence(order);
    
    // 使用 MikroORM 的 Unit of Work 管理实体状态
    if (await em.exists(OrderEntity, order.id.value)) {
      em.assign(orderEntity, this.orderMapper.toPersistence(order));
    } else {
      em.persist(orderEntity);
    }

    // 显式刷新确保数据一致性
    await em.flush();
  }

  async findByCustomerId(customerId: CustomerId): Promise<Order[]> {
    const orderEntities = await this.em.find(OrderEntity, 
      { customerId: customerId.value },
      { 
        orderBy: { createdAt: QueryOrder.DESC },
        populate: ['items']
      }
    );

    return Promise.all(
      orderEntities.map(entity => this.orderMapper.toDomain(entity))
    );
  }

  async delete(order: Order): Promise<void> {
    await this.em.nativeDelete(OrderEntity, order.id.value);
  }

  async exists(orderId: OrderId): Promise<boolean> {
    return await this.em.exists(OrderEntity, orderId.value);
  }
}
```

### 3.2 MikroORM 实体定义

```typescript
// 订单实体定义
@Entity()
export class OrderEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  customerId!: string;

  @Enum({ items: () => OrderStatus, type: 'string' })
  status!: OrderStatus;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number;

  @Property({ length: 3 })
  currency!: string;

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => OrderItemEntity, item => item.order, {
    cascade: [Cascade.ALL],
    orphanRemoval: true
  })
  items = new Collection<OrderItemEntity>(this);

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ nullable: true })
  deletedAt?: Date;

  @Property({ version: true })
  version!: number;

  // 索引定义
  @Index({ name: 'idx_order_customer_id' })
  @Index({ name: 'idx_order_status', properties: ['status'] })
  @Index({ name: 'idx_order_created_at', properties: ['createdAt'] })
}

// 订单项实体定义
@Entity()
export class OrderItemEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => OrderEntity, { nullable: false })
  order!: OrderEntity;

  @Property({ type: 'uuid' })
  productId!: string;

  @Property()
  productName!: string;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice!: number;

  @Property()
  quantity!: number;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  subtotal!: number;

  @Property({ type: 'json', nullable: true })
  attributes?: Record<string, any>;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}

// 事件存储实体
@Entity({ tableName: 'domain_events' })
export class EventEntity {
  @PrimaryKey({ type: 'uuid' })
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

  @Property()
  version!: number;

  @Index({ name: 'idx_events_aggregate_id' })
  @Index({ name: 'idx_events_event_type', properties: ['eventType'] })
  @Index({ name: 'idx_events_occurred_on', properties: ['occurredOn'] })
}
```

### 3.3 领域-实体映射器

```typescript
@Injectable()
export class OrderMapper {
  constructor(
    private readonly orderItemMapper: OrderItemMapper,
    private readonly logger: Logger
  ) {}

  toDomain(entity: OrderEntity): Order {
    try {
      const orderProps = {
        id: OrderId.create(entity.id),
        customerId: CustomerId.create(entity.customerId),
        status: entity.status as OrderStatus,
        totalAmount: new Money(entity.totalAmount, entity.currency),
        items: entity.items.getItems().map(item => 
          this.orderItemMapper.toDomain(item)
        ),
        metadata: entity.metadata,
        createdAt: DateTime.fromJSDate(entity.createdAt),
        updatedAt: DateTime.fromJSDate(entity.updatedAt),
        version: entity.version
      };

      return Order.reconstituteFromSnapshot(orderProps);

    } catch (error) {
      this.logger.error('Failed to map OrderEntity to Domain', error);
      throw new MappingError('订单实体映射失败', error);
    }
  }

  toPersistence(order: Order): OrderEntity {
    const entity = new OrderEntity();
    entity.id = order.id.value;
    entity.customerId = order.customerId.value;
    entity.status = order.status;
    entity.totalAmount = order.totalAmount.amount;
    entity.currency = order.totalAmount.currency;
    entity.metadata = order.metadata;
    entity.version = order.version;
    
    // 处理集合映射
    if (order.items.length > 0) {
      entity.items.set(
        order.items.map(item => this.orderItemMapper.toPersistence(item, order.id))
      );
    }

    return entity;
  }

  updatePersistence(order: Order, existingEntity: OrderEntity): void {
    // 使用 MikroORM 的 assign 方法更新实体
    this.em.assign(existingEntity, this.toPersistence(order));
  }
}
```

### 3.4 MikroORM 配置

```typescript
// mikro-orm.config.ts
export default defineConfig({
  entities: [OrderEntity, OrderItemEntity, EventEntity],
  entitiesTs: ['./src/infrastructure/persistence/entities'],
  dbName: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  type: 'postgresql',
  
  // 开发配置
  debug: process.env.NODE_ENV === 'development',
  logger: console.log.bind(console),
  
  // 迁移配置
  migrations: {
    path: './src/infrastructure/persistence/migrations',
    pattern: /^[\w-]+\d+\.ts$/,
    transactional: true,
    disableForeignKeys: false,
    allOrNothing: true,
    dropTables: false,
  },
  
  // 持久化配置
  persistAndFlush: false, // 手动控制 flush
  
  // 性能优化
  batchSize: 500, // 批量操作大小
  loadStrategy: LoadStrategy.JOINED,
  
  // 缓存配置
  resultCache: {
    expiration: 1000 * 60 * 5, // 5分钟
  },
  
  // 连接池配置
  pool: {
    min: 2,
    max: 10,
  },
  
  // 架构配置
  schema: process.env.DB_SCHEMA || 'public',
  
  // 驱动选项
  driverOptions: {
    connection: {
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
  },
} as Options);
```

### 3.5 事件存储实现 (MikroORM)

```typescript
@Injectable()
export class MikroOrmEventStore implements DomainEventStore {
  constructor(
    private readonly em: EntityManager,
    private readonly eventSerializer: EventSerializer,
    private readonly logger: Logger
  ) {}

  async saveEvents(aggregateId: string, events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    const eventEntities = events.map((event, index) => {
      const entity = new EventEntity();
      entity.eventId = event.eventId;
      entity.aggregateId = aggregateId;
      entity.aggregateType = this.getAggregateType(event);
      entity.eventType = event.eventType;
      entity.eventData = this.eventSerializer.serialize(event);
      entity.occurredOn = event.occurredOn;
      entity.version = index + 1; // 基于位置计算版本
      return entity;
    });

    // 批量插入事件
    await this.em.persistAndFlush(eventEntities);
    
    this.logger.debug(`Saved ${events.length} events for aggregate ${aggregateId}`);
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const eventEntities = await this.em.find(EventEntity, 
      { aggregateId },
      { 
        orderBy: { version: QueryOrder.ASC },
        cache: 1000 * 60 * 5 // 5分钟缓存
      }
    );

    return eventEntities.map(entity => 
      this.eventSerializer.deserialize(entity.eventData, entity.eventType)
    );
  }

  async getEventsByType(eventType: string, since?: Date): Promise<DomainEvent[]> {
    const where: any = { eventType };
    if (since) {
      where.occurredOn = { $gte: since };
    }

    const eventEntities = await this.em.find(EventEntity, where, {
      orderBy: { occurredOn: QueryOrder.ASC }
    });

    return eventEntities.map(entity =>
      this.eventSerializer.deserialize(entity.eventData, entity.eventType)
    );
  }

  async getEventCount(aggregateId: string): Promise<number> {
    return await this.em.count(EventEntity, { aggregateId });
  }

  private getAggregateType(event: DomainEvent): string {
    // 从事件类型推断聚合类型
    return event.constructor.name.replace(/Event$/, '');
  }
}
```

## 🔧 MikroORM 特定最佳实践

### 4.1 事务管理

```typescript
@Injectable()
export class TransactionalService {
  constructor(private readonly em: EntityManager) {}

  async executeInTransaction<T>(
    work: (em: EntityManager) => Promise<T>,
    options: { isolationLevel?: IsolationLevel } = {}
  ): Promise<T> {
    return await this.em.transactional(async (em) => {
      return await work(em);
    }, options);
  }

  // 针对特定业务场景的事务封装
  async placeOrderTransaction(order: Order, payment: Payment): Promise<void> {
    await this.executeInTransaction(async (em) => {
      // 保存订单
      const orderRepository = em.getRepository(OrderEntity);
      await orderRepository.persistAndFlush(this.orderMapper.toPersistence(order));
      
      // 保存支付记录
      const paymentRepository = em.getRepository(PaymentEntity);
      await paymentRepository.persistAndFlush(this.paymentMapper.toPersistence(payment));
      
      // 发布领域事件
      await this.eventPublisher.publishAll(order.domainEvents);
    }, { isolationLevel: IsolationLevel.READ_COMMITTED });
  }
}
```

### 4.2 查询优化

```typescript
@Injectable()
export class OrderQueryService {
  constructor(private readonly em: EntityManager) {}

  async findOrdersWithDetails(criteria: OrderQueryCriteria): Promise<OrderView[]> {
    const qb = this.em.createQueryBuilder(OrderEntity, 'o');
    
    qb.select([
      'o.id',
      'o.status',
      'o.totalAmount',
      'o.currency',
      'o.createdAt',
      'c.name as customerName',
      'COUNT(i.id) as itemCount'
    ])
    .leftJoin('o.customer', 'c')
    .leftJoin('o.items', 'i')
    .where(this.buildWhereClause(criteria))
    .groupBy('o.id', 'c.name')
    .orderBy({ 'o.createdAt': QueryOrder.DESC })
    .limit(criteria.limit || 50)
    .offset(criteria.offset || 0);

    // 使用索引提示
    qb.setHint('idx_order_query_optimized');

    const results = await qb.getResult();
    return results.map(this.toOrderView);
  }

  private buildWhereClause(criteria: OrderQueryCriteria): any {
    const where: any = {};
    
    if (criteria.customerId) {
      where.customerId = criteria.customerId;
    }
    
    if (criteria.status) {
      where.status = { $in: criteria.status };
    }
    
    if (criteria.dateRange) {
      where.createdAt = {
        $gte: criteria.dateRange.start,
        $lte: criteria.dateRange.end
      };
    }

    return where;
  }
}
```

## 🧪 测试规范 (MikroORM)

### 5.1 仓储测试

```typescript
describe('MikroOrmOrderRepository', () => {
  let repository: MikroOrmOrderRepository;
  let em: EntityManager;
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: [OrderEntity, OrderItemEntity],
      dbName: 'test_db',
      type: 'postgresql',
      // 测试专用配置
    });
    em = orm.em.fork();
    repository = new MikroOrmOrderRepository(em, mockOrderMapper, mockEventStore);
  });

  afterAll(async () => {
    await orm.close();
  });

  beforeEach(async () => {
    await em.nativeDelete(OrderEntity, {});
    await em.nativeDelete(OrderItemEntity, {});
  });

  it('应该使用 Unit of Work 正确保存订单', async () => {
    // Given
    const order = Order.create(/* ... */);
    
    // When
    await repository.save(order);
    
    // Then
    const savedEntity = await em.findOne(OrderEntity, order.id.value);
    expect(savedEntity).toBeDefined();
    expect(savedEntity.totalAmount).toBe(order.totalAmount.amount);
  });

  it('应该正确处理集合的级联操作', async () => {
    // Given
    const order = Order.create(/* 包含订单项 */);
    
    // When
    await repository.save(order);
    
    // Then
    const savedEntity = await em.findOne(OrderEntity, order.id.value, {
      populate: ['items']
    });
    expect(savedEntity.items.length).toBe(order.items.length);
  });
});
```

## 🔍 MikroORM 特定设计决策

### 6.1 配置决策

| 配置项 | 推荐值 | 理由 |
|--------|--------|------|
| **loadStrategy** | `LoadStrategy.JOINED` | 更好的类型安全和查询性能 |
| **persistAndFlush** | `false` | 手动控制 flush，更好的性能 |
| **batchSize** | `500` | 平衡内存使用和性能 |
| **resultCache** | `5分钟` | 减少重复查询 |

### 6.2 性能优化策略

```typescript
// 批量操作优化
@Injectable()
export class BatchOperationService {
  constructor(private readonly em: EntityManager) {}

  async batchInsertOrders(orders: Order[]): Promise<void> {
    const chunks = this.chunkArray(orders, 100); // 每批100条
    
    for (const chunk of chunks) {
      await this.em.transactional(async (em) => {
        const entities = chunk.map(order => this.orderMapper.toPersistence(order));
        em.persist(entities);
        await em.flush();
      });
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

## ✅ 总结

本规范针对 MikroORM + PostgreSQL 技术栈确立了基础设施层设计的核心原则：

1. **MikroORM 最佳实践**: 充分利用 Unit of Work、Identity Map 等特性
2. **性能优化**: 合理的批量操作、查询优化和缓存策略
3. **事务管理**: 明确的事务边界和隔离级别控制
4. **事件溯源集成**: 与 MikroORM 无缝集成的事件存储实现
5. **类型安全**: 充分利用 TypeScript 和 MikroORM 的类型支持

遵循本规范可以构建出高性能、可维护且与 MikroORM 深度集成的基础设施层。

---
*文档版本: 1.0 | 最后更新: 2024-11-XX | 适用项目: DDD 混合架构项目 (MikroORM + PostgreSQL)*