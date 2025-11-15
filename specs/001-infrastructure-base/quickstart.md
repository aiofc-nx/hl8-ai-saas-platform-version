# 快速开始：基础设施基础模块

**日期**：2024-12-19  
**关联计划**：[plan.md](./plan.md)

## 概述

基础设施基础模块为平台提供核心基础设施能力，包括事件溯源、事件驱动、权限缓存、审计、配置、日志等。本文档提供快速开始指南，帮助开发者快速集成和使用该模块。

## 安装

### 1. 安装依赖

```bash
pnpm add @hl8/infrastructure-base
```

### 2. 安装可选依赖

```bash
# 消息队列适配器（可选）
pnpm add @hl8/infrastructure-base-kafka
pnpm add @hl8/infrastructure-base-rabbitmq

# 缓存驱动（可选）
pnpm add @hl8/infrastructure-base-redis
pnpm add @hl8/infrastructure-base-memory
```

## 配置

### 1. 基础配置

在 `app.module.ts` 中导入 `InfrastructureCoreModule`：

```typescript
import { InfrastructureCoreModule } from "@hl8/infrastructure-base";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    InfrastructureCoreModule.forRoot({
      isGlobal: true,
      // 配置模块选项
      config: {
        isGlobal: true,
        config: {
          eventStore: {
            connectionString: process.env.EVENT_STORE_CONNECTION_STRING || "postgresql://localhost:5432/eventstore",
            optimisticLockRetryCount: 3,
            optimisticLockRetryDelay: 100,
          },
          eventPublisher: {
            messageBrokerType: "kafka",
            messageBrokerConnectionString: process.env.KAFKA_CONNECTION_STRING || "kafka://localhost:9092",
            enableMessageBrokerDegradation: true,
          },
          abilityCache: {
            cacheConnectionString: process.env.REDIS_CONNECTION_STRING || "redis://localhost:6379",
            ttlSeconds: 3600,
            enableCacheDegradation: true,
          },
          auditService: {
            connectionString: process.env.AUDIT_CONNECTION_STRING || "postgresql://localhost:5432/audit",
            enableArchiving: false,
          },
        },
      },
      // 事件存储模块选项（可选）
      eventStore: {
        isGlobal: false,
        contextName: "eventstore", // 用于多数据源场景
      },
      // 事件发布模块选项（可选）
      eventPublisher: {
        isGlobal: false,
      },
      // 权限缓存模块选项（可选）
      abilityCache: {
        isGlobal: false,
      },
      // 审计服务模块选项（可选）
      auditService: {
        isGlobal: false,
        contextName: "audit", // 用于多数据源场景
      },
      // 异常服务模块选项（可选，默认启用）
      exceptionService: {
        isGlobal: false,
      },
    }),
  ],
})
export class AppModule {}
```

### 2. 环境变量配置

在 `.env` 文件中配置环境变量：

```env
# 事件存储数据库配置
EVENT_STORE__CONNECTION_STRING=postgresql://localhost:5432/eventstore

# 审计服务数据库配置
AUDIT__CONNECTION_STRING=postgresql://localhost:5432/audit

# Redis 配置
REDIS__CONNECTION_STRING=redis://localhost:6379

# Kafka 配置
KAFKA__CONNECTION_STRING=kafka://localhost:9092

# 环境配置
NODE_ENV=development
```

**注意**：环境变量使用双下划线 `__` 作为嵌套属性的分隔符。例如，`EVENT_STORE__CONNECTION_STRING` 对应配置对象中的 `eventStore.connectionString`。

## 使用

### 1. 事件存储使用

```typescript
import { EventStore, StoredEvent } from "@hl8/infrastructure-base";
import { Injectable, Inject } from "@nestjs/common";
import { randomUUID } from "crypto";

@Injectable()
export class UserService {
  constructor(
    @Inject("EventStore")
    private readonly eventStore: EventStore,
  ) {}

  async createUser(userId: string, tenantId: string, userData: unknown) {
    // 创建事件
    const events: StoredEvent[] = [
      {
        eventId: randomUUID(),
        aggregateId: userId,
        tenantId,
        version: 1,
        payload: {
          type: "UserCreated",
          data: userData,
        },
        occurredAt: new Date(),
        metadata: {},
      },
    ];

    // 追加事件
    const uncommittedEvents = await this.eventStore.append(events);

    // 返回未提交事件（供应用层发布）
    return uncommittedEvents;
  }

  async loadUserEvents(userId: string, tenantId: string) {
    // 加载事件流
    const events = await this.eventStore.load(userId, tenantId);

    // 处理事件
    return events;
  }

  async loadUserEventsSince(userId: string, tenantId: string, version: number) {
    // 从指定版本开始加载事件流
    const events: StoredEvent[] = [];
    for await (const event of this.eventStore.loadSince(userId, tenantId, version)) {
      events.push(event);
    }
    return events;
  }
}
```

### 2. 事件发布使用

```typescript
import { EventPublisher, StoredEvent } from "@hl8/infrastructure-base";
import { Injectable, Inject } from "@nestjs/common";

@Injectable()
export class UserEventHandler {
  constructor(
    @Inject("EventPublisher")
    private readonly eventPublisher: EventPublisher,
  ) {}

  async handleUserCreated(events: StoredEvent[]) {
    // 发布事件到内部事件总线和外部消息队列
    await this.eventPublisher.publish(events);
  }
}
```

### 3. 权限能力使用

```typescript
import { CaslAbilityService, SecurityContext } from "@hl8/infrastructure-base";
import { Injectable, Inject } from "@nestjs/common";

@Injectable()
export class PermissionService {
  constructor(
    @Inject("CaslAbilityService")
    private readonly caslAbilityService: CaslAbilityService,
  ) {}

  async checkPermission(userId: string, tenantId: string, action: string, resource: string) {
    // 构建安全上下文
    const context: SecurityContext = {
      userId,
      tenantId,
      organizationId: undefined, // 可选
    };

    // 解析用户权限
    const ability = await this.caslAbilityService.resolveAbility(context);

    // 检查权限
    return ability.can(action, resource);
  }
}
```

### 4. 审计服务使用

```typescript
import { AuditService, AuditRecord, AuditQuery } from "@hl8/infrastructure-base";
import { Injectable, Inject } from "@nestjs/common";
import { randomUUID } from "crypto";

@Injectable()
export class AuditLogService {
  constructor(
    @Inject("AuditService")
    private readonly auditService: AuditService,
  ) {}

  async logAction(tenantId: string, userId: string, action: string, payload: unknown) {
    // 构建审计记录
    const record: AuditRecord = {
      auditId: randomUUID(),
      tenantId,
      userId,
      action,
      payload,
      occurredAt: new Date(),
      metadata: {},
    };

    // 追加审计记录
    await this.auditService.append(record);
  }

  async queryAuditRecords(tenantId: string, userId?: string) {
    // 构建查询条件
    const query: AuditQuery = {
      tenantId,
      userId,
      limit: 100,
      offset: 0,
    };

    // 查询审计记录
    const records = await this.auditService.query(query);

    return records;
  }
}
```

### 5. 配置服务使用

```typescript
import { ConfigurationService } from "@hl8/infrastructure-base";
import { Injectable, Inject } from "@nestjs/common";

@Injectable()
export class ConfigService {
  constructor(
    @Inject("ConfigurationService")
    private readonly configurationService: ConfigurationService,
  ) {}

  getEventStoreConnectionString() {
    // 获取配置值
    return this.configurationService.get<string>("eventStore.connectionString", "postgresql://localhost:5432/eventstore");
  }

  hasEventStore() {
    // 检查配置是否存在
    return this.configurationService.has("eventStore");
  }
}
```

### 6. 异常服务使用

```typescript
import { ExceptionService, ExceptionInfo } from "@hl8/infrastructure-base";
import { Injectable, Inject } from "@nestjs/common";

@Injectable()
export class ErrorService {
  constructor(
    @Inject("ExceptionService")
    private readonly exceptionService: ExceptionService,
  ) {}

  async handleError(error: Error) {
    // 创建异常信息
    const exception: ExceptionInfo = {
      errorCode: "ERROR_CODE",
      message: "错误信息（中文）",
      context: {
        error: error.message,
        stack: error.stack,
      },
      timestamp: new Date(),
    };

    // 记录异常
    await this.exceptionService.log(exception);

    // 返回异常信息
    return exception;
  }
}
```

## 测试

### 1. 单元测试

```typescript
import { Test } from "@nestjs/testing";
import { EventStore, InMemoryEventStore } from "@hl8/infrastructure-base";
import { UserService } from "./user.service";

describe("UserService", () => {
  let userService: UserService;
  let eventStore: EventStore;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: "EventStore",
          useClass: InMemoryEventStore, // 使用内存事件存储（测试替身）
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    eventStore = module.get<EventStore>("EventStore");
  });

  it("should create user", async () => {
    const events = await userService.createUser("user-1", "tenant-1", {
      name: "John Doe",
    });

    expect(events).toHaveLength(1);
    expect((events[0].payload as { type: string }).type).toBe("UserCreated");
  });
});
```

### 2. 集成测试

```typescript
import { Test } from "@nestjs/testing";
import { InfrastructureCoreModule, EventStore } from "@hl8/infrastructure-base";
import { UserService } from "./user.service";

describe("UserService Integration", () => {
  let userService: UserService;
  let eventStore: EventStore;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        InfrastructureCoreModule.forRoot({
          isGlobal: false,
          // 使用测试配置
          config: {
            isGlobal: false,
            config: {
              eventStore: {
                connectionString: process.env.TEST_EVENT_STORE_CONNECTION_STRING || "postgresql://localhost:5432/test_eventstore",
              },
            },
          },
          eventStore: {
            isGlobal: false,
            contextName: "test_eventstore",
          },
        }),
      ],
      providers: [UserService],
    }).compile();

    userService = module.get<UserService>(UserService);
    eventStore = module.get<EventStore>("EventStore");
  });

  it("should create user and load events", async () => {
    const events = await userService.createUser("user-1", "tenant-1", {
      name: "John Doe",
    });

    const loadedEvents = await eventStore.load("user-1", "tenant-1");

    expect(loadedEvents).toHaveLength(1);
    expect((loadedEvents[0].payload as { type: string }).type).toBe("UserCreated");
  });
});
```

## 数据库迁移

### 1. 创建迁移

```bash
pnpm mikro-orm migration:create --name=CreateInfrastructureBaseTables
```

### 2. 运行迁移

```bash
pnpm mikro-orm migration:up
```

### 3. 回滚迁移

```bash
pnpm mikro-orm migration:down
```

## 监控

### 1. 性能监控

```typescript
import { EventStore } from "@hl8/infrastructure-base";
import { Injectable } from "@nestjs/common";

@Injectable()
export class MonitoringService {
  constructor(private readonly eventStore: EventStore) {}

  async monitorEventStore() {
    // 监控事件存储性能
    const startTime = Date.now();
    await this.eventStore.append(events);
    const endTime = Date.now();

    // 记录性能指标
    console.log(`Event store append time: ${endTime - startTime}ms`);
  }
}
```

### 2. 健康检查

```typescript
import { HealthCheckService, HealthCheck } from "@nestjs/terminus";
import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get("health")
  @HealthCheck()
  check() {
    return this.health.check([() => this.eventStore.healthCheck(), () => this.auditService.healthCheck(), () => this.caslAbilityService.healthCheck()]);
  }
}
```

## 故障排除

### 1. 事件存储故障

**问题**：事件存储服务不可用

**解决方案**：

- 检查数据库连接配置
- 检查数据库服务状态
- 检查网络连接
- 查看日志文件

### 2. 权限缓存故障

**问题**：权限缓存服务不可用

**解决方案**：

- 检查 Redis 连接配置
- 检查 Redis 服务状态
- 系统会自动降级到直接查询，不影响功能

### 3. 消息队列故障

**问题**：消息队列服务不可用

**解决方案**：

- 检查 Kafka 连接配置
- 检查 Kafka 服务状态
- 系统会自动降级处理，仅记录日志而不阻塞主流程

## 最佳实践

### 1. 事件存储

- 使用事件快照机制减少事件重放次数
- 使用乐观锁机制检测版本冲突
- 使用事务确保事件写入的原子性

### 2. 事件发布

- 使用异步发布提高性能
- 使用重试机制处理发布失败
- 使用监控机制跟踪发布状态

### 3. 权限缓存

- 使用多级失效策略平衡性能和准确性
- 使用缓存预热机制减少缓存失效影响
- 使用监控机制跟踪缓存命中率

### 4. 审计服务

- 使用异步写入提高性能
- 使用重试机制处理写入失败
- 使用归档机制降低存储成本

### 5. 配置服务

- 使用环境变量管理配置
- 使用配置校验确保配置正确性
- 使用配置缓存提高性能

## 参考资料

- [规范文档](./spec.md)
- [实施计划](./plan.md)
- [数据模型](./data-model.md)
- [API 合约](./contracts/interfaces.md)
- [技术研究](./research.md)
