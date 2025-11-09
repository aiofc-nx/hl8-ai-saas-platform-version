# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- 中文优先（I）: 确认所有新增或修改的代码注释、技术文档、日志与错误信息均为中文，且注释遵循 TSDoc 规范。
- 代码即文档（II）: 核对公共 API、类、方法、接口、枚举均具备完整 TSDoc 注释，覆盖业务规则、前置/后置条件与异常说明。
- 技术栈约束（III）: 验证方案是否基于 Node.js + TypeScript，配置 NodeNext 模块系统（`module`/`moduleResolution` 为 `NodeNext`，`target` 为 `ES2022`，`strict` 启用），并通过 pnpm 管理依赖。
- 测试要求（IV）: 规划应满足单元/集成/端到端测试分层策略与覆盖率门槛（核心逻辑 ≥ 80%，关键路径 ≥ 90%，公共 API 必测）。
- 配置模块（V）: 方案必须使用 `@hl8/config` 定义配置类与 `class-validator` 校验规则，禁止直接使用原始配置对象。
- 日志模块（VI）: 日志策略需复用 `@hl8/logger`，不得直接引入其他日志库或 Nest 内置 Logger。
- 异常模块（VII）: 异常处理须统一靠 `libs/infra/exceptions` 定义与抛出，新增业务异常需声明错误码与中文信息。
- 缓存模块（VIII）: 缓存方案必须通过 `libs/infra/cache` 管理命名空间、策略与扩展能力，禁止直接操作底层驱动。

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
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
└── integration/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
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

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

> **Unit Test 就近原则**：单元测试文件必须与被测文件同目录保存，命名 `{filename}.spec.ts`。仅契约、集成及端到端测试放置于 `tests/` 目录下。

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
