# 实施计划：[FEATURE]

**分支**：`[###-feature-name]` | **日期**：[DATE] | **规格文档**：[link]  
**输入**：来自 `/specs/[###-feature-name]/spec.md` 的功能规格

**说明**：本模板由 `/speckit.plan` 命令生成，执行流程请参考相关命令文档。

## 摘要

[引用规格文档中的核心需求与研究阶段形成的技术方案要点]

## 技术背景

<!--
  必须用项目的真实技术细节替换本节内容。以下结构仅作指引，协助规划迭代。
-->

**语言与版本**：[示例：Node.js 20 + TypeScript 5.4；如待确认请标注 NEEDS CLARIFICATION]  
**主要依赖**：[示例：NestJS、Fastify、MikroORM、CASL；如待确认请标注 NEEDS CLARIFICATION]  
**存储方案**：[若适用请说明 PostgreSQL、MongoDB 等；若不适用填 N/A]  
**测试框架**：[示例：Jest、pnpm test；如待确认请标注 NEEDS CLARIFICATION]  
**目标部署环境**：[示例：Linux Server、Kubernetes；如待确认请标注 NEEDS CLARIFICATION]  
**项目类型**：[单体/前后端分离/多端，决定源码结构]  
**性能目标**：[领域指标，如 1000 req/s、p95 < 200ms；或 NEEDS CLARIFICATION]  
**约束条件**：[领域约束，如 <100MB 内存、必须离线可用；或 NEEDS CLARIFICATION]  
**规模范围**：[领域规模，如 10k 租户、每日 1M 事件；或 NEEDS CLARIFICATION]

## 章程核对

*关卡：必须在 Phase 0 研究前完成核对，并在 Phase 1 设计后复审。*

- ✅ 语言规范：所有文档、注释与输出必须使用中文并符合 TSDoc 要求（对应中文优先原则与代码即文档原则）。
- ✅ 技术栈约束：方案必须基于 Node.js + TypeScript、NodeNext 配置、NestJS + Fastify，并符合数据库、CQRS 与权限模型约束。
- ✅ 基础设施依赖：需明确整合 `@hl8/config`、`@hl8/logger`、`libs/infra/exceptions`、`libs/infra/cache`、`libs/infra/mikro-orm-nestjs`，禁止旁路实现。
- ✅ 测试策略：必须规划单元/集成/端到端测试，阐明覆盖率 80%/90% 与公共 API 覆盖的达标路径。
- ✅ 多租户与架构：需论证 DDD + Clean Architecture + CQRS + Event Sourcing + EDA 的落地方案，以及租户隔离与生命周期管理策略。

## 项目结构

### 文档（本功能）

```text
specs/[###-feature]/
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
# 【如未使用请删除】方案一：单体项目（默认）
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# 【如未使用请删除】方案二：前后端分离
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# 【如未使用请删除】方案三：移动端 + API
api/
└── [同后端结构]

ios/ 或 android/
└── [平台特定模块、界面流程、平台测试]
```

**结构选择说明**：[记录所选结构及其与上述目录的对应关系]

## 复杂度跟踪

> **仅当“章程核对”存在需豁免的违规项时填写本节。**

| 违规项 | 必要性说明 | 拒绝更简单方案的原因 |
|--------|------------|----------------------|
| [示例：新增第 4 个项目] | [当前业务驱动] | [为何 3 个项目不足] |
| [示例：引入 Repository 模式] | [具体问题] | [为何直接数据库访问不可行] |
