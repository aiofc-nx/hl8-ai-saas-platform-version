# 实施计划：租户管理模块

**分支**：`002-tenant-management` | **日期**：2025-01-27 | **规格文档**：[spec.md](./spec.md)  
**输入**：来自 `/specs/002-tenant-management/spec.md` 的功能规格

**说明**：本模板由 `/speckit.plan` 命令生成，执行流程请参考相关命令文档。

## 摘要

租户管理模块是平台多租户能力的核心基础，为 IAM 系统提供最小可用的租户生命周期管理能力。本模块实现租户的创建、启用、停用、归档等核心操作，并支持租户上下文查询，确保多租户数据隔离和权限管理的基础能力。

**核心需求**：

- 租户创建：支持租户基本信息收集、唯一性校验、上下文初始化
- 租户状态管理：支持"已初始化"、"已激活"、"已暂停"、"已归档"四种状态的转换
- 租户查询：支持单个租户查询、列表查询（分页、过滤）、上下文查询
- 事件发布：租户生命周期事件发布，支持 IAM、计费系统等订阅
- 权限控制：仅超级管理员和平台管理员可执行租户管理操作

**技术方案要点**：

- 遵循 DDD + Clean Architecture + CQRS + Event Sourcing + EDA 混合架构
- 基于平台领域基线和应用层基线实现，复用聚合根基类、审计能力、软删除能力
- 使用事件驱动架构实现与 IAM、计费系统的集成，保证最终一致性
- 通过 CASL 实现权限验证，确保多租户数据隔离

## 技术背景

**语言与版本**：Node.js >= 20 + TypeScript 5.7.3  
**主要依赖**：NestJS 11、Fastify、MikroORM 6.5.9、CASL (@casl/ability 6.5.0)、@nestjs/cqrs 11  
**存储方案**：PostgreSQL（关系型数据库，用于租户聚合和读模型）、MongoDB（可选，用于文档型读模型）  
**测试框架**：Jest 30、ts-jest 29.2.5，单元测试覆盖率目标：核心业务逻辑 80%+，关键路径 90%+  
**目标部署环境**：Linux Server、Docker 容器化部署  
**项目类型**：Monorepo（pnpm workspace），租户管理模块作为业务模块集成到现有应用  
**性能目标**：

- 租户创建操作：2分钟内完成（包括事件发布）
- 租户查询：1000并发时95%请求响应时间 < 1秒
- 租户列表查询：10,000租户时响应时间 < 2秒
- IAM上下文查询：响应时间 < 500毫秒
- 支持至少10,000个活跃租户的存储和查询

**约束条件**：

- 必须遵循平台宪章：中文注释、TSDoc规范、NodeNext模块系统
- 必须使用平台基础设施：@hl8/config、@hl8/logger、@hl8/exceptions、@hl8/cache、@hl8/mikro-orm-nestjs
- 必须实现多租户数据隔离，防止跨租户访问
- 外部依赖失败时采用最终一致性策略，租户操作不因事件发布失败而失败

**规模范围**：

- 支持至少10,000个活跃租户
- 租户状态变更操作成功率 99.9%
- 事件发布成功率 99.9%

## 章程核对

_关卡：必须在 Phase 0 研究前完成核对，并在 Phase 1 设计后复审。_

- ✅ 语言规范：所有文档、注释与输出必须使用中文并符合 TSDoc 要求（对应中文优先原则与代码即文档原则）。
- ✅ 技术栈约束：方案必须基于 Node.js + TypeScript、NodeNext 配置、NestJS + Fastify，并符合数据库、CQRS 与权限模型约束。
- ✅ 基础设施依赖：需明确整合 `@hl8/config`、`@hl8/logger`、`libs/infra/exceptions`、`libs/infra/cache`、`libs/infra/mikro-orm-nestjs`，禁止旁路实现。
- ✅ 测试策略：必须规划单元/集成/端到端测试，阐明覆盖率 80%/90% 与公共 API 覆盖的达标路径。
- ✅ 多租户与架构：需论证 DDD + Clean Architecture + CQRS + Event Sourcing + EDA 的落地方案，以及租户隔离与生命周期管理策略。

## 项目结构

### 文档（本功能）

```text
specs/002-tenant-management/
├── plan.md              # 当前文件（/speckit.plan 生成）
├── research.md          # Phase 0 产出（/speckit.plan 生成）
├── data-model.md        # Phase 1 产出（/speckit.plan 生成）
├── quickstart.md        # Phase 1 产出（/speckit.plan 生成）
├── contracts/           # Phase 1 产出（/speckit.plan 生成）
└── tasks.md             # Phase 2 产出（/speckit.tasks 生成，不由 /speckit.plan 创建）
```

### 源码（仓库根目录）

根据项目实际情况，租户管理模块将作为独立模块开发，位于 `libs/modules/tenant`：

```text
# Monorepo 结构（pnpm workspace）
libs/
├── modules/
│   └── tenant/                     # 租户管理模块（独立模块）
│       ├── src/
│       │   ├── domains/            # 领域层
│       │   │   └── tenant/
│       │   │       ├── aggregates/
│       │   │       │   └── tenant.aggregate.ts
│       │   │       ├── entities/
│       │   │       │   └── tenant-profile.entity.ts
│       │   │       ├── value-objects/
│       │   │       │   ├── tenant-status.vo.ts
│       │   │       │   ├── tenant-contact.vo.ts
│       │   │       │   └── tenant-context.vo.ts
│       │   │       ├── events/
│       │   │       │   ├── tenant-created.event.ts
│       │   │       │   ├── tenant-activated.event.ts
│       │   │       │   ├── tenant-suspended.event.ts
│       │   │       │   ├── tenant-archived.event.ts
│       │   │       │   └── tenant-profile-updated.event.ts
│       │   │       └── repositories/
│       │   │           └── tenant.repository.ts
│       │   ├── application/        # 应用层
│       │   │   ├── commands/
│       │   │   │   ├── create-tenant.command.ts
│       │   │   │   ├── activate-tenant.command.ts
│       │   │   │   ├── deactivate-tenant.command.ts
│       │   │   │   ├── archive-tenant.command.ts
│       │   │   │   └── update-tenant-profile.command.ts
│       │   │   ├── queries/
│       │   │   │   ├── get-tenant-by-id.query.ts
│       │   │   │   ├── list-tenants.query.ts
│       │   │   │   └── get-tenant-context.query.ts
│       │   │   └── sagas/
│       │   │       └── tenant-lifecycle.saga.ts
│       │   ├── infrastructure/     # 基础设施层
│       │   │   ├── repositories/
│       │   │   │   └── tenant.repository.impl.ts
│       │   │   ├── event-store/
│       │   │   │   └── tenant-event-store.ts
│       │   │   ├── projections/
│       │   │   │   └── tenant.projection.ts
│       │   │   └── dto/
│       │   │       └── tenant-read-model.ts
│       │   ├── interfaces/        # 接口层
│       │   │   ├── controllers/
│       │   │   │   ├── tenant-command.controller.ts
│       │   │   │   └── tenant-query.controller.ts
│       │   │   └── dtos/
│       │   │       └── tenant-request.dto.ts
│       │   └── index.ts            # 模块导出入口
│       ├── tests/                  # 测试目录
│       │   ├── unit/               # 单元测试（与源码同目录旁放）
│       │   ├── integration/       # 集成测试
│       │   └── e2e/               # 端到端测试
│       ├── package.json            # 模块包配置
│       ├── tsconfig.json           # TypeScript 配置
│       └── tsconfig.build.json    # 构建配置
│
libs/                                # 共享库
├── core/
│   ├── domain-base/                # 领域基线（已存在）
│   └── application-base/          # 应用层基线（已存在）
├── multi-tenancy/                  # 多租户基础设施（已存在）
├── cache/                          # 缓存模块（已存在）
├── common/
│   ├── config/                     # 配置模块（已存在）
│   ├── logger/                     # 日志模块（已存在）
│   └── exceptions/                 # 异常模块（已存在）
└── mikro-orm-nestjs/              # ORM 模块（已存在）

tests/                               # 测试目录
├── unit/                           # 单元测试（与源码同目录旁放）
│   └── tenant/
│       ├── tenant.aggregate.spec.ts
│       ├── create-tenant.command.spec.ts
│       └── list-tenants.query.spec.ts
├── integration/                    # 集成测试
│   └── tenant/
│       └── tenant-lifecycle.integration.spec.ts
└── e2e/                            # 端到端测试
    └── tenant/
        └── tenant-management.e2e.spec.ts
```

**结构选择说明**：采用 monorepo 结构，租户管理模块作为独立模块位于 `libs/modules/tenant`，遵循 DDD + Clean Architecture 分层结构。领域层、应用层、基础设施层和接口层清晰分离，便于维护和测试。模块通过 `@hl8/tenant` 包名导出，可在其他应用（如 `apps/fastify-api`）中通过依赖注入使用。

## 复杂度跟踪

> **仅当"章程核对"存在需豁免的违规项时填写本节。**

当前无违规项，所有设计均符合平台宪章要求。
