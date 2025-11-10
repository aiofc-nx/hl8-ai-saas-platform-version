# 领域层设计规范

## 📋 文档概述

本文档定义了基于 DDD + Clean Architecture + CQRS + ES + EDA 混合架构的领域层设计原则和实施规范。领域层是系统的核心，承载业务逻辑和规则，确保业务一致性和不变性。

## 🎯 核心设计理念

### 1.1 领域层定位

**领域层**是系统的**业务核心**和**规则引擎**，在 Clean Architecture 中处于最内层，不依赖任何外部框架或基础设施。

### 1.2 核心原则

- **富领域模型**: 业务逻辑内聚在领域对象中，避免贫血模型
- **聚合设计**: 通过聚合根维护业务不变性和一致性边界
- **值对象优先**: 使用值对象封装概念完整的业务概念
- **事件驱动**: 通过领域事件通知系统状态变化
- **显式建模**: 所有业务概念都应在领域层有对应的显式表达

## 🏗 领域模型结构规范

### 2.1 分层与职责

```
domain/
├── entities/           # 实体
├── aggregates/         # 聚合根
├── value-objects/      # 值对象
├── domain-services/    # 领域服务
├── domain-events/      # 领域事件
├── repositories/       # 仓储接口
├── policies/           # 业务策略
└── specs/              # 规格模式
```

### 2.2 组件职责定义

| 组件类型     | 职责                         | 特征                       | 示例                            |
| ------------ | ---------------------------- | -------------------------- | ------------------------------- |
| **聚合根**   | 维护一致性边界，对外唯一入口 | 有唯一标识，包含业务逻辑   | `Order`, `Product`              |
| **实体**     | 具有生命周期的业务对象       | 有唯一标识，可跟踪状态变化 | `OrderItem`, `Payment`          |
| **值对象**   | 描述业务概念的不变属性       | 无标识，不可变，自验证     | `Money`, `Address`, `TimeRange` |
| **领域服务** | 处理跨聚合的业务逻辑         | 无状态，协调多个领域对象   | `OrderPricingService`           |
| **领域事件** | 记录业务领域中发生的事       | 不可变，命名使用过去时     | `OrderPlacedEvent`              |
| **仓储接口** | 定义聚合持久化契约           | 面向聚合，领域层定义       | `OrderRepository`               |

## 🔧 聚合设计规范

### 3.1 聚合根设计模式

```typescript
// 聚合根基类
export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }
}

// 订单聚合根
export class Order extends AggregateRoot {
  private _id: OrderId;
  private _status: OrderStatus;
  private _items: OrderItem[] = [];
  private _totalAmount: Money;
  private _customerId: CustomerId;
  private _createdAt: DateTime;

  // 静态工厂方法 - 主要创建方式
  public static create(props: OrderCreateProps): Order {
    const order = new Order();

    // 初始化逻辑
    order._id = OrderId.create();
    order._status = OrderStatus.PENDING;
    order._customerId = props.customerId;
    order._createdAt = DateTime.now();

    // 添加领域事件
    order.addDomainEvent(
      new OrderCreatedEvent({
        orderId: order._id,
        customerId: order._customerId,
        createdAt: order._createdAt,
      }),
    );

    return order;
  }

  // 从事件重建 - 用于事件溯源
  public static reconstitute(events: OrderDomainEvent[]): Order {
    const order = new Order();

    events.forEach((event) => {
      order.apply(event);
    });

    return order;
  }

  // 业务方法
  public addItem(productId: ProductId, quantity: number, price: Money): void {
    // 业务规则验证
    if (this._status !== OrderStatus.PENDING) {
      throw new OrderModificationError("只能修改待处理状态的订单");
    }

    if (quantity <= 0) {
      throw new InvalidQuantityError("数量必须大于0");
    }

    const existingItem = this._items.find((item) => item.productId.equals(productId));

    if (existingItem) {
      existingItem.increaseQuantity(quantity);
    } else {
      const newItem = OrderItem.create({
        productId,
        quantity,
        unitPrice: price,
      });
      this._items.push(newItem);
    }

    this.calculateTotal();
  }

  public cancel(reason: string): void {
    // 业务规则
    if (!this.isCancellable()) {
      throw new OrderCancellationError("当前订单状态不可取消");
    }

    this._status = OrderStatus.CANCELLED;

    this.addDomainEvent(
      new OrderCancelledEvent({
        orderId: this._id,
        reason,
        cancelledAt: DateTime.now(),
      }),
    );
  }

  // 私有方法封装内部逻辑
  private calculateTotal(): void {
    this._totalAmount = this._items.reduce((total, item) => total.add(item.subtotal), Money.zero());
  }

  private isCancellable(): boolean {
    return [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(this._status);
  }

  // 查询方法
  public get id(): OrderId {
    return this._id;
  }
  public get status(): OrderStatus {
    return this._status;
  }
  public get totalAmount(): Money {
    return this._totalAmount;
  }
  public get items(): ReadonlyArray<OrderItem> {
    return [...this._items];
  }
}
```

### 3.2 实体设计模式

```typescript
export class OrderItem extends Entity<OrderItemId> {
  private _productId: ProductId;
  private _quantity: number;
  private _unitPrice: Money;

  constructor(props: OrderItemProps) {
    super(props.id);
    this._productId = props.productId;
    this._quantity = props.quantity;
    this._unitPrice = props.unitPrice;
  }

  public increaseQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new InvalidQuantityError("增加数量必须大于0");
    }
    this._quantity += quantity;
  }

  public updateUnitPrice(newPrice: Money): void {
    if (newPrice.isNegative()) {
      throw new InvalidPriceError("价格不能为负");
    }
    this._unitPrice = newPrice;
  }

  public get subtotal(): Money {
    return this._unitPrice.multiply(this._quantity);
  }

  // 值对象相等性比较
  public equals(other: OrderItem): boolean {
    if (!(other instanceof OrderItem)) return false;
    return this._id.equals(other._id);
  }
}
```

### 3.3 值对象设计模式

```typescript
export class Money extends ValueObject {
  private readonly _amount: number;
  private readonly _currency: string;

  constructor(amount: number, currency: string = "CNY") {
    super();

    // 自验证
    if (amount < 0) {
      throw new InvalidMoneyError("金额不能为负数");
    }

    if (!currency.match(/^[A-Z]{3}$/)) {
      throw new InvalidMoneyError("货币格式不正确");
    }

    this._amount = Math.round(amount * 100) / 100; // 保留两位小数
    this._currency = currency;

    Object.freeze(this); // 确保不可变
  }

  // 业务操作
  public add(other: Money): Money {
    this.validateSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  public multiply(factor: number): Money {
    if (factor < 0) {
      throw new InvalidMoneyError("乘数不能为负数");
    }
    return new Money(this._amount * factor, this._currency);
  }

  public isGreaterThan(other: Money): boolean {
    this.validateSameCurrency(other);
    return this._amount > other._amount;
  }

  private validateSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new CurrencyMismatchError("货币类型不匹配");
    }
  }

  // 值对象相等性
  public equals(other: Money): boolean {
    return other instanceof Money && this._amount === other._amount && this._currency === other._currency;
  }

  // 静态工厂方法
  public static zero(currency: string = "CNY"): Money {
    return new Money(0, currency);
  }

  public static fromString(amountStr: string, currency: string): Money {
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      throw new InvalidMoneyError("金额格式不正确");
    }
    return new Money(amount, currency);
  }

  // 获取器
  public get amount(): number {
    return this._amount;
  }
  public get currency(): string {
    return this._currency;
  }
}
```

## 🎪 领域服务规范

### 4.1 领域服务设计

```typescript
export interface OrderPricingService {
  calculateOrderPrice(order: Order, customer: Customer): OrderPriceCalculation;
}

@DomainService()
export class DefaultOrderPricingService implements OrderPricingService {
  constructor(
    private readonly discountPolicy: DiscountPolicy,
    private readonly taxPolicy: TaxPolicy,
  ) {}

  public calculateOrderPrice(order: Order, customer: Customer): OrderPriceCalculation {
    // 计算商品总价
    const itemsTotal = order.items.reduce((total, item) => total.add(item.subtotal), Money.zero());

    // 应用折扣策略
    const discount = this.discountPolicy.calculateDiscount(order, customer);

    // 计算税费
    const tax = this.taxPolicy.calculateTax(itemsTotal.subtract(discount.amount));

    // 计算最终价格
    const finalAmount = itemsTotal.subtract(discount.amount).add(tax.amount);

    return new OrderPriceCalculation({
      itemsTotal,
      discount,
      tax,
      finalAmount,
    });
  }
}
```

## 📢 领域事件规范

### 5.1 事件设计模式

```typescript
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventType: string;

  constructor(public readonly aggregateId: string) {
    this.eventId = ulid();
    this.occurredOn = new Date();
    this.eventType = this.constructor.name;
  }
}

export class OrderPlacedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      orderId: string;
      customerId: string;
      totalAmount: number;
      items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
      }>;
    },
  ) {
    super(payload.orderId);
  }
}

export class OrderCancelledEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      orderId: string;
      reason: string;
      cancelledBy: string;
      cancelledAt: Date;
    },
  ) {
    super(payload.orderId);
  }
}
```

## 🗃 仓储接口规范

### 6.1 仓储接口设计

```typescript
export interface OrderRepository {
  // 查询方法
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: CustomerId): Promise<Order[]>;
  findPendingOrders(): Promise<Order[]>;

  // 保存方法
  save(order: Order): Promise<void>;

  // 删除方法
  delete(order: Order): Promise<void>;

  // 存在性检查
  exists(orderId: OrderId): Promise<boolean>;

  // 事件溯源专用方法
  getEvents(aggregateId: string): Promise<DomainEvent[]>;
  saveEvents(aggregateId: string, events: DomainEvent[]): Promise<void>;
}

export interface DomainEventStore {
  saveEvents(aggregateId: string, events: DomainEvent[]): Promise<void>;
  getEvents(aggregateId: string): Promise<DomainEvent[]>;
  getEventsByType(eventType: string): Promise<DomainEvent[]>;
}
```

## 🧪 测试规范

### 7.1 领域对象测试

```typescript
describe("Order Aggregate", () => {
  describe("创建订单", () => {
    it("应该成功创建待处理状态的订单", () => {
      // Given
      const customerId = CustomerId.create();
      const productId = ProductId.create();

      // When
      const order = Order.create({
        customerId,
        items: [
          {
            productId,
            quantity: 2,
            price: new Money(100),
          },
        ],
      });

      // Then
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.totalAmount.amount).toBe(200);
      expect(order.domainEvents).toHaveLength(1);
      expect(order.domainEvents[0]).toBeInstanceOf(OrderCreatedEvent);
    });

    it("应该拒绝创建空订单", () => {
      // Given
      const customerId = CustomerId.create();

      // When & Then
      expect(() => Order.create({ customerId, items: [] })).toThrow(EmptyOrderError);
    });
  });

  describe("取消订单", () => {
    it("应该允许取消待处理订单", () => {
      // Given
      const order = createPendingOrder();

      // When
      order.cancel("客户要求取消");

      // Then
      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(order.domainEvents).toContainEqual(expect.any(OrderCancelledEvent));
    });

    it("应该拒绝取消已发货订单", () => {
      // Given
      const order = createShippedOrder();

      // When & Then
      expect(() => order.cancel("取消太晚了")).toThrow(OrderCancellationError);
    });
  });
});
```

### 7.2 值对象测试

```typescript
describe("Money ValueObject", () => {
  it("应该正确计算金额加法", () => {
    const money1 = new Money(100);
    const money2 = new Money(50);

    const result = money1.add(money2);

    expect(result.amount).toBe(150);
  });

  it("应该拒绝不同货币的金额加法", () => {
    const cnyMoney = new Money(100, "CNY");
    const usdMoney = new Money(50, "USD");

    expect(() => cnyMoney.add(usdMoney)).toThrow(CurrencyMismatchError);
  });

  it("应该正确判断值对象相等性", () => {
    const money1 = new Money(100, "CNY");
    const money2 = new Money(100, "CNY");
    const money3 = new Money(100, "USD");

    expect(money1.equals(money2)).toBe(true);
    expect(money1.equals(money3)).toBe(false);
  });
});
```

## 🔍 设计决策与最佳实践

### 8.1 聚合设计决策

| 场景             | 推荐方案               | 理由             |
| ---------------- | ---------------------- | ---------------- |
| **一对多关系**   | 子实体包含在聚合内     | 维护强一致性边界 |
| **跨聚合引用**   | 使用ID引用，非对象引用 | 保持聚合边界清晰 |
| **复杂业务规则** | 在聚合根中封装         | 确保业务不变性   |
| **性能考虑**     | 设计小聚合，延迟加载   | 避免大事务锁     |

### 8.2 不变性设计

- **值对象**: 始终不可变，创建后不能修改
- **实体**: 通过业务方法修改状态，不暴露setter
- **领域事件**: 创建后完全不可变
- **聚合**: 内部状态通过受控方法修改

### 8.3 事件溯源集成

```typescript
// 事件溯源的聚合根
export abstract class EventSourcedAggregateRoot extends AggregateRoot {
  private _version: number = 0;

  public get version(): number {
    return this._version;
  }

  // 应用事件改变状态
  protected applyEvent(event: DomainEvent): void {
    this._version++;
    // 具体的状态变更逻辑在子类中实现
  }

  // 重建聚合状态
  public loadFromHistory(events: DomainEvent[]): void {
    events.forEach((event) => {
      this.applyEvent(event);
      this._version++;
    });
  }
}
```

## ✅ 总结

本规范确立了领域层设计的核心原则：

1. **模型驱动**: 所有设计围绕领域模型展开
2. **聚合优先**: 通过聚合根维护业务一致性
3. **不可变设计**: 值对象和事件确保状态可预测
4. **显式表达**: 所有业务概念都有对应的代码表达
5. **测试保障**: 通过单元测试验证业务规则正确性

遵循本规范可以构建出表达力强、可维护性高、业务逻辑正确的领域层，为整个系统奠定坚实的基础。

---

_文档版本: 1.0 | 最后更新: 2024-11-XX | 适用项目: DDD 混合架构项目_
