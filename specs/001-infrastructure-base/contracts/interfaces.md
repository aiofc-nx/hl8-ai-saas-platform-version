# API 合约：基础设施基础模块

**日期**：2024-12-19  
**关联计划**：[plan.md](./../plan.md)

## 接口定义

### 1. 事件存储接口（EventStore）

**描述**：事件存储接口，用于存储和检索聚合事件。

**接口定义**：

```typescript
/**
 * 存储的事件
 */
export interface StoredEvent {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly tenantId: string;
  readonly version: number;
  readonly payload: unknown;
  readonly occurredAt: Date;
  readonly metadata: Record<string, unknown>;
}

/**
 * 事件存储接口
 */
export interface EventStore {
  /**
   * 追加事件到存储
   * @param eventStream 事件流
   * @returns 未提交的事件列表
   * @throws {EventStoreError} 当事件存储失败时
   */
  append(eventStream: StoredEvent[]): Promise<StoredEvent[]>;

  /**
   * 加载聚合的所有事件
   * @param aggregateId 聚合标识
   * @param tenantId 租户标识
   * @returns 事件列表
   * @throws {EventStoreError} 当事件加载失败时
   */
  load(aggregateId: string, tenantId: string): Promise<StoredEvent[]>;

  /**
   * 从指定版本开始加载事件流
   * @param version 起始版本号
   * @param tenantId 租户标识
   * @returns 事件流（异步迭代器）
   * @throws {EventStoreError} 当事件加载失败时
   */
  loadSince(version: number, tenantId: string): AsyncIterable<StoredEvent>;
}
```

**错误定义**：

```typescript
/**
 * 事件存储错误
 */
export class EventStoreError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### 2. 事件发布接口（EventPublisher）

**描述**：事件发布接口，用于发布领域事件到内部事件总线和外部消息队列。

**接口定义**：

```typescript
/**
 * 事件发布接口
 */
export interface EventPublisher {
  /**
   * 发布事件到内部事件总线和外部消息队列
   * @param events 事件列表
   * @returns Promise<void>
   * @throws {EventPublisherError} 当事件发布失败时
   */
  publish(events: StoredEvent[]): Promise<void>;
}
```

**错误定义**：

```typescript
/**
 * 事件发布错误
 */
export class EventPublisherError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### 3. 消息队列适配器接口（MessageBrokerAdapter）

**描述**：消息队列适配器接口，用于将事件转发到外部消息队列。

**接口定义**：

```typescript
/**
 * 消息队列适配器接口
 */
export interface MessageBrokerAdapter {
  /**
   * 转发事件到外部消息队列
   * @param event 事件
   * @returns Promise<void>
   * @throws {MessageBrokerError} 当消息队列不可用时，仅记录日志而不抛出异常
   */
  forward(event: StoredEvent): Promise<void>;
}
```

**错误定义**：

```typescript
/**
 * 消息队列错误
 */
export class MessageBrokerError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### 4. 权限能力服务接口（CaslAbilityService）

**描述**：权限能力服务接口，用于构建和缓存用户权限规则。

**接口定义**：

```typescript
/**
 * 安全上下文
 */
export interface SecurityContext {
  readonly userId: string;
  readonly tenantId: string;
  readonly organizationId?: string;
}

/**
 * 权限能力服务接口
 */
export interface CaslAbilityService {
  /**
   * 解析用户权限能力
   * @param context 安全上下文
   * @returns 权限能力
   * @throws {CaslAbilityError} 当权限解析失败时
   */
  resolveAbility(context: SecurityContext): Promise<AppAbility>;
}
```

**错误定义**：

```typescript
/**
 * 权限能力错误
 */
export class CaslAbilityError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### 5. 权限缓存服务接口（AbilityCacheService）

**描述**：权限缓存服务接口，用于缓存和失效权限规则。

**接口定义**：

```typescript
/**
 * 权限缓存服务接口
 */
export interface AbilityCacheService {
  /**
   * 构建缓存键
   * @param context 安全上下文
   * @returns 缓存键
   */
  buildKey(context: SecurityContext): string;

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 权限能力或 null
   * @throws {AbilityCacheError} 当缓存服务不可用时，降级到直接查询
   */
  get(key: string): Promise<AppAbility | null>;

  /**
   * 设置缓存
   * @param key 缓存键
   * @param ability 权限能力
   * @returns Promise<void>
   * @throws {AbilityCacheError} 当缓存服务不可用时，仅记录日志而不抛出异常
   */
  set(key: string, ability: AppAbility): Promise<void>;

  /**
   * 失效缓存
   * @param context 安全上下文
   * @param level 失效级别（user、tenant、global）
   * @returns Promise<void>
   * @throws {AbilityCacheError} 当缓存服务不可用时，仅记录日志而不抛出异常
   */
  invalidate(context: SecurityContext, level: 'user' | 'tenant' | 'global'): Promise<void>;
}
```

**错误定义**：

```typescript
/**
 * 权限缓存错误
 */
export class AbilityCacheError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### 6. 审计服务接口（AuditService）

**描述**：审计服务接口，用于记录和查询审计信息。

**接口定义**：

```typescript
/**
 * 审计记录
 */
export interface AuditRecord {
  readonly auditId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly action: string;
  readonly payload: unknown;
  readonly occurredAt: Date;
  readonly metadata?: Record<string, unknown>;
}

/**
 * 审计查询条件
 */
export interface AuditQuery {
  readonly tenantId: string;
  readonly userId?: string;
  readonly action?: string;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * 审计服务接口
 */
export interface AuditService {
  /**
   * 追加审计记录
   * @param record 审计记录
   * @returns Promise<void>
   * @throws {AuditServiceError} 当审计记录写入失败时，写入重试队列
   */
  append(record: AuditRecord): Promise<void>;

  /**
   * 查询审计记录
   * @param query 查询条件
   * @returns 审计记录列表
   * @throws {AuditServiceError} 当审计记录查询失败时
   */
  query(query: AuditQuery): Promise<AuditRecord[]>;
}
```

**错误定义**：

```typescript
/**
 * 审计服务错误
 */
export class AuditServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### 7. 配置服务接口（ConfigurationService）

**描述**：配置服务接口，用于加载和校验配置信息。

**接口定义**：

```typescript
/**
 * 配置服务接口
 */
export interface ConfigurationService {
  /**
   * 获取配置值
   * @param key 配置键
   * @param defaultValue 默认值
   * @returns 配置值
   * @throws {ConfigurationError} 当配置不存在且没有默认值时
   */
  get<T>(key: string, defaultValue?: T): T;

  /**
   * 检查配置是否存在
   * @param key 配置键
   * @returns 是否存在
   */
  has(key: string): boolean;

  /**
   * 加载配置
   * @returns Promise<void>
   * @throws {ConfigurationError} 当配置加载失败时，阻止系统启动
   */
  load(): Promise<void>;

  /**
   * 校验配置
   * @returns Promise<void>
   * @throws {ConfigurationError} 当配置校验失败时，阻止系统启动
   */
  validate(): Promise<void>;
}
```

**错误定义**：

```typescript
/**
 * 配置错误
 */
export class ConfigurationError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### 8. 异常服务接口（ExceptionService）

**描述**：异常服务接口，用于统一的异常处理和日志记录。

**接口定义**：

```typescript
/**
 * 异常信息
 */
export interface ExceptionInfo {
  readonly errorCode: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly stack?: string;
}

/**
 * 异常服务接口
 */
export interface ExceptionService {
  /**
   * 创建异常
   * @param errorCode 错误码
   * @param message 错误信息（中文）
   * @param context 错误上下文
   * @returns 异常信息
   */
  create(errorCode: string, message: string, context?: Record<string, unknown>): ExceptionInfo;

  /**
   * 记录异常
   * @param exception 异常信息
   * @returns Promise<void>
   */
  log(exception: ExceptionInfo): Promise<void>;
}
```

## 模块接口（InfrastructureCoreModule）

**描述**：基础设施核心模块，整合所有基础设施服务。

**接口定义**：

```typescript
/**
 * 基础设施核心模块
 */
@Module({
  imports: [
    EventStoreModule,
    EventPublisherModule,
    CaslAbilityModule,
    AuditServiceModule,
    ConfigurationModule,
    ExceptionServiceModule,
  ],
  exports: [
    EventStore,
    EventPublisher,
    CaslAbilityService,
    AuditService,
    ConfigurationService,
    ExceptionService,
  ],
})
export class InfrastructureCoreModule {}
```

## 使用示例

### 1. 事件存储使用示例

```typescript
import { EventStore } from '@hl8/infrastructure-base';

// 注入事件存储
constructor(private readonly eventStore: EventStore) {}

// 追加事件
const events = await this.eventStore.append([
  {
    eventId: 'event-1',
    aggregateId: 'aggregate-1',
    tenantId: 'tenant-1',
    version: 1,
    payload: { /* 事件内容 */ },
    occurredAt: new Date(),
    metadata: {},
  },
]);

// 加载事件
const loadedEvents = await this.eventStore.load('aggregate-1', 'tenant-1');

// 从指定版本加载事件
for await (const event of this.eventStore.loadSince(1, 'tenant-1')) {
  // 处理事件
}
```

### 2. 事件发布使用示例

```typescript
import { EventPublisher } from '@hl8/infrastructure-base';

// 注入事件发布器
constructor(private readonly eventPublisher: EventPublisher) {}

// 发布事件
await this.eventPublisher.publish(events);
```

### 3. 权限能力使用示例

```typescript
import { CaslAbilityService } from '@hl8/infrastructure-base';

// 注入权限能力服务
constructor(private readonly caslAbilityService: CaslAbilityService) {}

// 解析用户权限
const ability = await this.caslAbilityService.resolveAbility({
  userId: 'user-1',
  tenantId: 'tenant-1',
  organizationId: 'org-1',
});
```

### 4. 审计服务使用示例

```typescript
import { AuditService } from '@hl8/infrastructure-base';

// 注入审计服务
constructor(private readonly auditService: AuditService) {}

// 追加审计记录
await this.auditService.append({
  auditId: 'audit-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  action: 'create',
  payload: { /* 操作内容 */ },
  occurredAt: new Date(),
  metadata: {},
});

// 查询审计记录
const records = await this.auditService.query({
  tenantId: 'tenant-1',
  userId: 'user-1',
  action: 'create',
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-12-31'),
  limit: 100,
  offset: 0,
});
```

### 5. 配置服务使用示例

```typescript
import { ConfigurationService } from '@hl8/infrastructure-base';

// 注入配置服务
constructor(private readonly configurationService: ConfigurationService) {}

// 获取配置值
const value = this.configurationService.get<string>('key', 'default-value');

// 检查配置是否存在
if (this.configurationService.has('key')) {
  // 使用配置
}
```

### 6. 异常服务使用示例

```typescript
import { ExceptionService } from '@hl8/infrastructure-base';

// 注入异常服务
constructor(private readonly exceptionService: ExceptionService) {}

// 创建异常
const exception = this.exceptionService.create(
  'ERROR_CODE',
  '错误信息（中文）',
  { /* 错误上下文 */ }
);

// 记录异常
await this.exceptionService.log(exception);
```

## 错误码定义

### 事件存储错误码

- `EVENT_STORE_APPEND_FAILED`：事件追加失败
- `EVENT_STORE_LOAD_FAILED`：事件加载失败
- `EVENT_STORE_VERSION_CONFLICT`：事件版本冲突
- `EVENT_STORE_TENANT_ISOLATION_VIOLATION`：租户隔离违规

### 事件发布错误码

- `EVENT_PUBLISHER_PUBLISH_FAILED`：事件发布失败
- `EVENT_PUBLISHER_MESSAGE_BROKER_UNAVAILABLE`：消息队列不可用

### 权限能力错误码

- `CASL_ABILITY_RESOLVE_FAILED`：权限解析失败
- `CASL_ABILITY_CACHE_UNAVAILABLE`：权限缓存不可用

### 审计服务错误码

- `AUDIT_SERVICE_APPEND_FAILED`：审计记录追加失败
- `AUDIT_SERVICE_QUERY_FAILED`：审计记录查询失败
- `AUDIT_SERVICE_TENANT_ISOLATION_VIOLATION`：租户隔离违规

### 配置服务错误码

- `CONFIGURATION_LOAD_FAILED`：配置加载失败
- `CONFIGURATION_VALIDATE_FAILED`：配置校验失败
- `CONFIGURATION_NOT_FOUND`：配置不存在

## 版本控制

所有接口变更必须在 `CHANGELOG.md` 中记录，并发布迁移指南。

## 兼容性

所有接口必须保持向后兼容，重大变更必须通过版本号区分。

