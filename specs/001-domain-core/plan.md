# 实施计划：平台领域核心能力

**分支**：`001-domain-core` | **日期**：2025-11-11 | **规格文档**：[spec.md](./spec.md)  
**输入**：来自 `/specs/001-domain-core/spec.md` 的功能规格

**说明**：本模板由 `/speckit.plan` 命令生成，执行流程请参考相关命令文档。

## 摘要

本计划针对 `@hl8/domain-core` 平台领域基线，目标是交付统一的聚合根、实体、值对象、领域事件、仓储接口与守卫工具，确保所有业务领域模块能够复用多租户隔离、审计、软删除与事件驱动能力。实现路径包括：

- 依照 `docs/designs/platform-domain-baseline.md` 与 `platform-domain-design.md`，定义可复用的领域基类、值对象与事件契约。
- 为多租户上下文、审计轨迹、软删除状态提供标准值对象与辅助工具，禁止领域层依赖基础设施实现。
- 制定仓储接口、领域服务与守卫工具的统一规范，并同步文档与示例以支撑快速接入。
- 建立质量基线（TSDoc、单元测试、事件契约测试）与脚手架指引，保证后续领域团队按章程要求落地。

## 技术背景

<!--
  必须用项目的真实技术细节替换本节内容。以下结构仅作指引，协助规划迭代。
-->

**语言与版本**：Node.js 20.x + TypeScript 5.9（NodeNext module/ES2022 target，严格模式启用）  
**主要依赖**：`class-validator`、`class-transformer`、`reflect-metadata`（仅依赖于纯领域与标准库能力，禁止引入基础设施模块）  
**存储方案**：N/A（领域层保持纯粹，不直接访问数据库或缓存）  
**测试框架**：Jest 30 + ts-jest，pnpm workspace 流程  
**目标部署环境**：内部 pnpm monorepo，CI/CD 在 Node >=20 的 Linux 容器中执行  
**项目类型**：Monorepo 内共享领域库（供各业务上下文复用）  
**性能目标**：聚合构造、断言与事件收集单次调用耗时 < 5ms；库初始化时间 < 200ms，支持高并发命令处理  
**约束条件**：保持领域层无框架依赖；所有公共 API 必须提供中文 TSDoc、租户断言与审计字段；禁止引入基础设施模块  
**规模范围**：支撑 ≥ 10k 租户、每日 ≥ 1M 领域事件的建模需求

## 章程核对

*关卡：必须在 Phase 0 研究前完成核对，并在 Phase 1 设计后复审。*

- ✅ 语言规范：所有文档、注释与输出必须使用中文并符合 TSDoc 要求（对应中文优先原则与代码即文档原则）。
- ✅ 技术栈约束：方案必须基于 Node.js + TypeScript、NodeNext 配置、NestJS + Fastify，并符合数据库、CQRS 与权限模型约束。
- ✅ 基础设施依赖：需明确领域层保持纯净，不直接依赖 `@hl8/config`、`@hl8/logger`、`libs/infra/exceptions` 等基础设施模块；必要能力通过应用/基础设施层注入或契约协作完成。
- ✅ 测试策略：必须规划单元/集成/端到端测试，阐明覆盖率 80%/90% 与公共 API 覆盖的达标路径。
- ✅ 多租户与架构：需论证 DDD + Clean Architecture + CQRS + Event Sourcing + EDA 的落地方案，以及租户隔离与生命周期管理策略。

## 项目结构

### 文档（本功能）

```text
specs/001-domain-core/
├── plan.md              # 当前文件（/speckit.plan 生成）
├── research.md          # Phase 0 产出（/speckit.plan 生成）
├── data-model.md        # Phase 1 产出（/speckit.plan 生成）
├── quickstart.md        # Phase 1 产出（/speckit.plan 生成）
├── contracts/           # Phase 1 产出（/speckit.plan 生成）
└── tasks.md             # Phase 2 产出（/speckit.tasks 生成，不由 /speckit.plan 创建）
```

### 源码（仓库根目录）

<!--
  必须根据项目实际情况替换下列占位结构，并删除未选用的选项，补充真实路径。
-->

```text
libs/
├── domain-core/
│   ├── src/
│   │   ├── aggregates/
│   │   ├── entities/
│   │   ├── events/
│   │   ├── repositories/
│   │   ├── value-objects/
│   │   ├── auditing/
│   │   ├── services/
│   │   ├── exceptions/
│   │   └── utils/
│   ├── tests/             # 单元测试旁放（*.spec.ts）
│   ├── jest.config.ts
│   ├── tsconfig.json
│   └── package.json
├── domain-testing/        # 计划新增的测试基座（视 Phase 1 决策而定）
└── infra/...              # 既有基础设施模块（保持依赖隔离）

tests/
├── integration/           # 聚合跨模块集成测试（Phase 2 规划）
└── e2e/                   # 平台级端到端测试（Phase 2 规划）
```

**结构选择说明**：采用 monorepo libs 模式，`@hl8/domain-core` 聚焦领域层基线，测试旁放在 `libs/domain-core/src/**` 同级 `*.spec.ts`；跨模块验证将在全局 `tests/` 目录按层次补充。

## 复杂度跟踪

> **仅当“章程核对”存在需豁免的违规项时填写本节。**

| 违规项 | 必要性说明 | 拒绝更简单方案的原因 |
|--------|------------|----------------------|
| （暂无） | - | - |

## Phase 0 - 研究结论

- 基于基线文档确认领域层保持基础设施无感知，统一通过值对象封装多租户上下文与审计信息。  
- 明确领域事件必须携带 `tenantId`、`triggeredBy`、`AuditTrail`、`SoftDeleteStatus`，避免下游缺失隔离和审计上下文。  
- 约定提供 `libs/domain-testing` 测试基座，以满足章程中对核心聚合 ≥95% 覆盖率的要求。

## Phase 1 - 设计与契约

- **数据模型**：在 `data-model.md` 描述聚合根、实体、值对象、事件、仓储接口与守卫工具的字段、行为及状态转换。  
- **API 合同**：在 `contracts/domain-core.openapi.yaml` 定义内部 Scaffolding API（聚合、值对象、事件）与规范查询接口，保障骨架生成一致性。  
- **快速入门**：`quickstart.md` 提供 30 分钟接入流程、脚手架调用示例、测试与文档要求。  
- **Agent 上下文**：已运行 `.specify/scripts/bash/update-agent-context.sh cursor-agent`，同步最新技术背景与约束。

## Phase 2 - 实施准备要点

- 制定 `/speckit.tasks` 所需的开发与测试任务列表，覆盖聚合基类实现、值对象集合、事件基类、仓储接口、守卫工具与测试基座。  
- 规划单元测试（聚合、值对象、领域服务）、事件契约测试与示例模块接入演示，确保章程覆盖率指标。  
- 与基础设施团队对齐 UUID 生成器、异常体系与配置模块的依赖方式，保持跨模块一致。

## 复审结论

- Phase 1 设计产出满足章程语言、技术栈、测试与多租户隔离约束，未发现需豁免的违规项。  
- 可进入 `/speckit.tasks` 阶段，拆解具体实现与测试工作。
