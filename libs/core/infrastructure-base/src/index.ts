/**
 * @fileoverview 基础设施基础模块主入口
 * @description 导出所有公共 API，包括异常、配置、日志、缓存、事件存储、事件发布、权限缓存、审计服务等
 *
 * ## 模块概述
 *
 * 本模块为平台提供核心基础设施能力，包括：
 *
 * 1. **事件溯源（ES）域**：管理聚合事件存储、重放、并发控制与快照，支持永久保留和可选归档
 * 2. **事件驱动（EDA）域**：统一领域事件发布、外部消息队列桥接、Saga/投影订阅，支持分级降级
 * 3. **权限与缓存域**：提供 CASL 规则加载、缓存、多级失效与预热能力，支持缓存降级
 * 4. **审计与日志域**：持久化命令/查询审计信息，统一日志输出，支持永久保留和可选归档
 * 5. **配置与异常域**：提供配置加载、校验与异常封装，确保类型安全和统一错误处理
 *
 * 所有能力均支持多租户隔离，并提供测试替身支持单元测试。
 *
 * ## 使用示例
 *
 * ```typescript
 * import { InfrastructureCoreModule } from '@hl8/infrastructure-base';
 *
 * @Module({
 *   imports: [InfrastructureCoreModule.forRoot()],
 * })
 * export class AppModule {}
 * ```
 */

// 异常导出
export * from "./exceptions/infrastructure-exception.js";
export * from "./exceptions/exception.interface.js";
export * from "./exceptions/exception.service.js";
export * from "./exceptions/exception.module.js";

// 配置导出
export * from "./configuration/infrastructure-config.module.js";
export * from "./configuration/schemas/infrastructure-config.schema.js";
export * from "./configuration/configuration.interface.js";
export * from "./configuration/configuration.service.js";

// 日志导出
export * from "./logging/logger.provider.js";

// 缓存导出
export * from "./cache/cache.module.js";

// 事件存储导出
export * from "./event-sourcing/event-store.interface.js";
export * from "./event-sourcing/event-store.module.js";
export * from "./event-sourcing/mikro-orm-event-store.js";
export * from "./event-sourcing/in-memory-event-store.js";
export * from "./event-sourcing/entities/event.entity.js";
export * from "./event-sourcing/entities/event-snapshot.entity.js";
export * from "./event-sourcing/snapshots/snapshot.service.js";
export * from "./event-sourcing/utils/aggregate-reconstitution.js";

// 事件发布导出
export * from "./eventing/event-publisher.interface.js";
export * from "./eventing/event-publisher.service.js";
export * from "./eventing/event-publisher.module.js";
export * from "./eventing/event-bus.module.js";
export * from "./eventing/message-broker/message-broker.adapter.interface.js";
export * from "./eventing/message-broker/memory-message-broker.adapter.js";
export * from "./eventing/message-broker/kafka.adapter.js";

// 权限缓存导出
export * from "./casl/casl-ability.interface.js";
export * from "./casl/casl-ability.service.js";
export * from "./casl/casl-ability.module.js";
export * from "./casl/ability-cache.service.js";

// 审计服务导出
export * from "./audit/audit.interface.js";
export * from "./audit/audit.service.js";
export * from "./audit/audit.module.js";
export * from "./audit/audit-archive.service.js";
export * from "./audit/entities/audit-log.entity.js";
export * from "./audit/repositories/audit.repository.js";
export * from "./audit/null-audit.service.js";

// 核心模块导出
export * from "./InfrastructureCoreModule.js";
