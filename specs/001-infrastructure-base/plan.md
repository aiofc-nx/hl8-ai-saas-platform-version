# 实施计划：基础设施基础模块

**分支**：`001-infrastructure-base` | **日期**：2024-12-19 | **规格文档**：[spec.md](./spec.md)  
**输入**：来自 `/specs/001-infrastructure-base/spec.md` 的功能规格

**说明**：本模板由 `/speckit.plan` 命令生成，执行流程请参考相关命令文档。

## 摘要

本模块为平台提供核心基础设施能力，包括：

1. **事件溯源（ES）域**：管理聚合事件存储、重放、并发控制与快照，支持永久保留和可选归档
2. **事件驱动（EDA）域**：统一领域事件发布、外部消息队列桥接、Saga/投影订阅，支持分级降级
3. **权限与缓存域**：提供 CASL 规则加载、缓存、多级失效与预热能力，支持缓存降级
4. **审计与日志域**：持久化命令/查询审计信息，统一日志输出，支持永久保留和可选归档
5. **配置与异常域**：提供配置加载、校验与异常封装，确保类型安全和统一错误处理

所有能力均支持多租户隔离，并提供测试替身支持单元测试。

## 技术背景

**Language/Version**: Node.js 20 + TypeScript 5.4  
**Primary Dependencies**: NestJS、Fastify、MikroORM、CASL (`@casl/ability`)、`@nestjs/cqrs`、`@hl8/config`、`@hl8/logger`  
**Storage**: PostgreSQL（事件存储、审计存储）、Redis（权限缓存）、可选归档存储（待定）  
**测试框架**: Jest、pnpm test  
**目标部署环境**: Linux Server、Kubernetes  
**Project Type**: monorepo 库包（`libs/infrastructure-base`）  
**性能目标**：
- 事件写入成功率 ≥ 99.9%，事件查询响应时间 ≤ 100 毫秒（P95）
- 事件发布成功率 ≥ 99.9%，事件处理延迟 ≤ 500 毫秒（P95）
- 权限查询缓存命中率 ≥ 80%，缓存未命中时的查询响应时间 ≤ 50 毫秒（P95）
- 审计记录写入成功率 ≥ 99.9%，审计记录写入延迟 ≤ 200 毫秒（P95）
- 支持 1000 并发事件写入时系统性能稳定，无明显降级

**约束条件**：
- 必须支持多租户隔离，确保跨租户数据访问的隔离性达到 100%
- 必须支持分级降级：缓存不可用时降级到直接查询；存储不可用时写入本地队列；消息队列不可用时仅记录日志
- 必须支持乐观锁机制检测版本冲突，冲突时自动重试指定次数
- 必须支持事件和审计记录的永久保留和可选归档

**规模范围**：
- 支持多租户 SaaS 环境，需要严格的租户隔离
- 支持高并发访问，需要高性能的缓存机制
- 支持企业级合规要求，需要完整的审计追踪能力

## 章程核对

*关卡：必须在 Phase 0 研究前完成核对，并在 Phase 1 设计后复审。*

- ✅ **语言规范**：所有文档、注释与输出必须使用中文并符合 TSDoc 要求（对应中文优先原则与代码即文档原则）。
- ✅ **技术栈约束**：方案必须基于 Node.js + TypeScript、NodeNext 配置、NestJS + Fastify，并符合数据库、CQRS 与权限模型约束。
- ✅ **基础设施依赖**：需明确整合 `@hl8/config`、`@hl8/logger`、`libs/infra/exceptions`、`libs/infra/cache`、`libs/infra/mikro-orm-nestjs`，禁止旁路实现。
- ✅ **测试策略**：必须规划单元/集成/端到端测试，阐明覆盖率 80%/90% 与公共 API 覆盖的达标路径。
- ✅ **多租户与架构**：需论证 DDD + Clean Architecture + CQRS + Event Sourcing + EDA 的落地方案，以及租户隔离与生命周期管理策略。

## 项目结构

### 文档（本功能）

```text
specs/001-infrastructure-base/
├── plan.md              # 当前文件（/speckit.plan 生成）
├── research.md          # Phase 0 产出（/speckit.plan 生成）
├── data-model.md        # Phase 1 产出（/speckit.plan 生成）
├── quickstart.md        # Phase 1 产出（/speckit.plan 生成）
├── contracts/           # Phase 1 产出（/speckit.plan 生成）
└── tasks.md              # Phase 2 产出（/speckit.tasks 生成，不由 /speckit.plan 创建）
```

### 源码（仓库根目录）

```text
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

libs/infrastructure-base/tests/
├── integration/
│   ├── event-store.integration.spec.ts
│   ├── event-publisher.integration.spec.ts
│   ├── casl-ability.integration.spec.ts
│   └── audit-service.integration.spec.ts
└── unit/
    ├── event-store.spec.ts
    ├── event-publisher.spec.ts
    ├── casl-ability.spec.ts
    └── audit-service.spec.ts
```

**结构选择说明**：采用 monorepo 库包结构，符合项目整体架构。所有模块按照领域划分，提供接口和实现分离。测试文件与被测文件同目录旁放，集成测试集中放置在 `tests/integration/` 目录。

## 复杂度跟踪

> **仅当"章程核对"存在需豁免的违规项时填写本节。**

无违规项，所有章程要求均已满足。
