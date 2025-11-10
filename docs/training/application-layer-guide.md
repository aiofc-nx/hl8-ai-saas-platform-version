# 应用层设计规范

## 📋 文档概述

本文档定义了基于 NestJS + DDD + Clean Architecture + CQRS + ES + EDA 混合架构的应用层设计原则和实施规范。旨在建立统一的架构理解和开发标准。

## 🎯 核心设计理念

### 1.1 应用层定位

**应用层用例**是整个系统的**业务流程协调中枢**和**事件驱动工作流引擎**，在六边形架构中充当外部请求与内部领域模型之间的协调者。

### 1.2 核心原则

- **单一用例单一职责**: 每个业务用例对应一个独立的协调单元
- **渐进式复杂化**: 接纳简单用例，为业务演进预留架构空间
- **事件驱动协作**: 通过领域事件实现业务流程解耦
- **技术框架融合**: 在 NestJS CQRS 生态中落地架构理念

## 🏗 架构实现规范

### 2.1 技术实现形式

在 NestJS CQRS 架构中，用例以三种形式具象化实现：

| 用例类型     | 实现形式         | 职责说明                   | 示例                      |
| ------------ | ---------------- | -------------------------- | ------------------------- |
| **命令用例** | `CommandHandler` | 处理状态变更，管理事件溯源 | `PlaceOrderHandler`       |
| **查询用例** | `QueryHandler`   | 处理数据查询，支持读写分离 | `GetOrderDetailsHandler`  |
| **事件用例** | `EventHandler`   | 响应领域事件，驱动后续流程 | `OrderPlacedEventHandler` |

### 2.2 代码结构标准

```
src/
├── order/
│   ├── application/
│   │   ├── use-cases/                    # 业务用例组织
│   │   │   ├── place-order/              # 用例分组
│   │   │   │   ├── place-order.command.ts
│   │   │   │   ├── place-order.handler.ts    # 主要实现
│   │   │   │   ├── place-order.saga.ts
│   │   │   │   └── __tests__/
│   │   │   │       ├── place-order.handler.spec.ts
│   │   │   │       └── place-order.use-case.spec.ts
│   │   │   ├── cancel-order/
│   │   │   └── fulfill-order/
│   │   ├── ports/                        # 接口定义
│   │   └── dtos/                         # 数据传输对象
│   ├── domain/                           # 领域层
│   └── infrastructure/                   # 基础设施层
```

## 💻 技术实现模式

### 3.1 基础命令处理器模式

```typescript
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
  constructor(
    private readonly repository: EventSourcingRepository<Order>,
    private readonly eventBus: EventBus,
    private readonly inventoryService: InventoryService,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<OrderResult> {
    // 1. 业务规则预检查
    await this.validateBusinessRules(command);

    // 2. 创建或重建聚合根
    const order = Order.create(command.orderDetails);

    // 3. 持久化事件流
    await this.repository.save(order);

    // 4. 发布领域事件驱动后续流程
    this.eventBus.publishAll(order.getUncommittedEvents());

    return OrderResult.from(order);
  }

  private async validateBusinessRules(command: PlaceOrderCommand): Promise<void> {
    const available = await this.inventoryService.checkAvailability(command.productItems);
    if (!available) {
      throw new InsufficientStockError();
    }
  }
}
```

### 3.2 复杂协调用例模式

当业务协调逻辑足够复杂时，引入明确的 Use Case 类：

```typescript
@Injectable()
export class OrderFulfillmentUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly inventoryRepo: InventoryRepository,
    private readonly shippingService: ShippingService,
    private readonly paymentService: PaymentService,
  ) {}

  async execute(orderId: string): Promise<FulfillmentResult> {
    // 复杂的多聚合协调逻辑
    const [order, inventory] = await Promise.all([this.orderRepo.findById(orderId), this.inventoryRepo.findByProduct(order.productId)]);

    // 协调多个领域服务
    const reservation = inventory.reserveForOrder(order);
    const shippingLabel = await this.shippingService.createLabel(order);
    const paymentResult = await this.paymentService.process(order);

    // 聚合根行为调用
    order.completeFulfillment(reservation, shippingLabel, paymentResult);

    // 持久化状态变更
    await Promise.all([this.orderRepo.save(order), this.inventoryRepo.save(inventory)]);

    return FulfillmentResult.from(order, reservation, shippingLabel);
  }
}

// 薄命令处理器
@CommandHandler(FulfillOrderCommand)
export class FulfillOrderHandler implements ICommandHandler<FulfillOrderCommand> {
  constructor(private readonly fulfillmentUseCase: OrderFulfillmentUseCase) {}

  async execute(command: FulfillOrderCommand): Promise<FulfillmentResult> {
    return this.fulfillmentUseCase.execute(command.orderId);
  }
}
```

### 3.3 事件处理器模式

```typescript
@EventHandler(OrderPlacedEvent)
export class OrderPlacedHandler implements IEventHandler<OrderPlacedEvent> {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly inventoryService: InventoryService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    // 异步响应领域事件，协调多个后续动作
    await Promise.all([this.inventoryService.reserveItems(event.productItems), this.notificationService.sendOrderConfirmation(event.customerId), this.analyticsService.trackOrderCreation(event)]);
  }
}
```

## 🧪 测试策略

### 4.1 业务场景测试

```typescript
describe('订单履约用例', () => {
  let orderFulfillmentUseCase: OrderFulfillmentUseCase;
  let mockOrderRepo: MockOrderRepository;

  beforeEach(() => {
    mockOrderRepo = new MockOrderRepository();
    orderFulfillmentUseCase = new OrderFulfillmentUseCase(
      mockOrderRepo,
      mockInventoryRepo,
      mockShippingService,
      mockPaymentService,
    );
  });

  it('应该成功处理完整的订单履约业务场景', async () => {
    // 准备测试数据
    const order = Order.create({...});
    await mockOrderRepo.save(order);

    // 执行业务用例
    const result = await orderFulfillmentUseCase.execute(order.id);

    // 验证业务预期
    expect(result.status).toBe('FULFILLED');
    expect(mockInventoryRepo.reservations).toHaveLength(1);
    expect(mockShippingService.createdLabels).toHaveLength(1);
  });
});
```

### 4.2 命令处理器测试

```typescript
describe('PlaceOrderHandler', () => {
  let handler: PlaceOrderHandler;
  let mockRepository: MockRepository<Order>;

  it('应该处理下单命令并发布领域事件', async () => {
    const command = new PlaceOrderCommand({...});

    const result = await handler.execute(command);

    expect(result.orderId).toBeDefined();
    expect(mockRepository.savedEvents).toHaveLength(1);
    expect(mockEventBus.publishedEvents).toContainEqual(
      expect.any(OrderPlacedEvent)
    );
  });
});
```

## 📖 沟通与文档规范

### 5.1 术语使用场景

| 场景         | 推荐术语 | 示例                                           | 理由               |
| ------------ | -------- | ---------------------------------------------- | ------------------ |
| **架构设计** | Use Case | "创建订单用例涉及订单聚合和库存上下文"         | 强调业务能力       |
| **代码实现** | Handler  | `PlaceOrderCommandHandler`                     | 符合框架约定       |
| **团队沟通** | Use Case | "这个用例的业务规则是什么？"                   | 统一业务语言       |
| **技术文档** | 两者结合 | "PlaceOrder Use Case (由 CommandHandler 实现)" | 平衡业务与技术视角 |

### 5.2 架构图标注

```
[用户界面]
    → [PlaceOrder Use Case] (CommandHandler)
    → [Order Aggregate]
    → [OrderPlaced Event]
    → [Inventory] & [Notification] (EventHandlers)
```

## 🚀 演进与维护

### 6.1 简单到复杂的演进路径

1. **初始阶段**: 直接使用 `CommandHandler`
2. **复杂度增加**: 提取 `UseCase` 类封装复杂协调逻辑
3. **规模扩大**: 按业务能力拆分模块和限界上下文
4. **性能要求**: 引入 CQRS 读写分离和查询专用模型

### 6.2 重构信号

- Handler 方法超过 50 行代码
- 一个 Handler 协调 3 个以上聚合或服务
- 测试 setup 过于复杂
- 业务逻辑开始渗透到 Handler 中

## ✅ 总结

本规范确立了在 NestJS 混合架构中应用层设计的标准实践：

1. **思想层面**坚持"用例驱动"和"单一职责"原则
2. **实现层面**遵循框架约定的 `Handler` 模式
3. **沟通层面**根据场景灵活使用 `Use Case` 术语
4. **演进层面**支持从简单到复杂的平滑过渡

通过这套规范，我们能够在享受 NestJS CQRS 框架带来便利的同时，保持代码的领域表现力和架构可持续性。

---

_文档版本: 1.0 | 最后更新: 2024-11-XX | 适用项目: NestJS DDD 混合架构项目_
