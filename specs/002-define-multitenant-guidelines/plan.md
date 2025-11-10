# Implementation Plan: 多租户与权限设计规范

**Branch**: `002-define-multitenant-guidelines` | **Date**: 2025-11-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-define-multitenant-guidelines/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

为项目沉淀一份覆盖多租户上下文、数据隔离、CASL 权限治理及运维审计要求的统一设计规范，并提供配套评审清单、数据模型指导与快速上手说明，确保各业务域在设计阶段即可复用 `libs/infra/multi-tenancy`、`libs/infra/mikro-orm-nestjs` 等基础设施能力，同时在 DDD + Clean Architecture + CQRS + ES 混合架构下保持分层职责清晰、事件驱动链路一致，满足章程合规。

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x、Markdown 文档  
**Primary Dependencies**: `libs/infra/multi-tenancy`、`libs/infra/mikro-orm-nestjs`、CASL、MikroORM、`@hl8/logger`、`@hl8/config`  
**Storage**: N/A（规范文档，无新增存储）  
**Testing**: N/A（规范文档，不引入新测试代码，但需重申现有测试门槛）  
**Target Platform**: 项目 monorepo 文档与服务端设计流程  
**Project Type**: 企业级 SaaS 平台后端设计规范  
**Performance Goals**: N/A（文档特性，改以流程效率指标衡量）  
**Constraints**: 必须符合章程八项原则、引用既有基础设施模块、遵循 DDD + Clean Architecture + CQRS + ES 混合架构并输出中文文档  
**Scale/Scope**: 覆盖所有域团队设计阶段、适用于≥10个业务域的多租户方案

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- 中文优先（I）: ✅ 规范正文、评审清单、Quickstart 全部使用中文撰写；若需新增代码注释将严格遵循 TSDoc 中文规范。
- 代码即文档（II）: ✅ 规划重点是补齐设计规范与清单，可确保未来公共 API、仓储基类补充注释时同步更新规范，保持文档与实现一致。
- 技术栈约束（III）: ✅ 规范明确要求复用 Node.js + TypeScript + NodeNext + pnpm 的既有模块，禁止引入 CommonJS。
- 测试要求（IV）: ✅ 在规范中重申单元/集成/端到端测试分层与覆盖率目标，并要求在设计评审清单中检查测试计划。
- 配置模块（V）: ✅ 规范将指示所有配置相关设计使用 `@hl8/config` + `class-validator`，不允许原始对象。
- 日志模块（VI）: ✅ 规范中要求权限与多租户日志统一使用 `@hl8/logger`，并定义审计日志字段。
- 异常模块（VII）: ✅ 方案强调越权与上下文缺失等异常必须通过 `libs/infra/exceptions` 抛出标准化错误。
- 缓存模块（VIII）: ✅ 规范会明确缓存隔离策略需依托 `libs/infra/cache`，禁止直接操作底层驱动。

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
docs/
├── memos/
│   ├── nestjs-saas-tenant-boilerplate-multitenancy.md
│   └── hl8-multitenant-permission-plan.md

libs/
└── infra/
    ├── multi-tenancy/
    └── mikro-orm-nestjs/

specs/
└── 002-define-multitenant-guidelines/
    ├── spec.md
    ├── plan.md
    ├── research.md        (待生成)
    ├── data-model.md      (待生成)
    ├── quickstart.md      (待生成)
    └── contracts/         (待生成)
```

> **Unit Test 就近原则**：单元测试文件必须与被测文件同目录保存，命名 `{filename}.spec.ts`。仅契约、集成及端到端测试放置于 `tests/` 目录下。

**Structure Decision**: 继续沿用 `docs/memos` 归档调研文档、在 `specs/002-define-multitenant-guidelines` 下提交规范相关交付产物；如需示例代码或仓储基类扩展，将在对应 `libs/infra/*` 目录就近更新并配套测试。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
