# Tasks: 多租户与权限设计规范

**Input**: Design documents from `/specs/002-define-multitenant-guidelines/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: 本功能以文档规范为主，未额外要求自动化测试任务；重点在于可审查的文档交付与评审清单。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 整理现有调研材料与基础组件文档，确保后续规范编写有统一参照

- [ ] T001 汇总 `docs/memos/nestjs-saas-tenant-boilerplate-multitenancy.md` 与 `docs/memos/hl8-multitenant-permission-plan.md` 的关键信息，形成笔记供后续章节引用
- [ ] T002 [P] 复核 `libs/infra/multi-tenancy/README.md` 与 `libs/infra/mikro-orm-nestjs/README.md`，确认最新能力点需在规范中覆盖

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 在设计文件中先行固化整体架构决策，作为各用户故事的前置条件  
**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 更新 `specs/002-define-multitenant-guidelines/plan.md` Summary 与 Technical Context，明确 DDD + Clean Architecture + CQRS + ES 混合架构及约束项
- [ ] T004 [P] 在 `specs/002-define-multitenant-guidelines/research.md` 记录 DDD 协同决策与替代方案评估，供后续引用

**Checkpoint**: Plan 与 Research 已反映最新架构原则，可进入各用户故事实现

---

## Phase 3: User Story 1 - 架构负责人发布统一规范 (Priority: P1) 🎯 MVP

**Goal**: 输出一份覆盖多租户、权限、DDD 混合架构要求的总体规范文档，供组织级发布  
**Independent Test**: 架构负责人独立查看 `specs/002-define-multitenant-guidelines/spec.md`，确认用户故事、功能要求、成功指标与假设均覆盖多租户/权限/DDD 关键点，且引用模块完整

### Implementation for User Story 1

- [ ] T005 [US1] 在 `specs/002-define-multitenant-guidelines/spec.md` 调整用户故事与功能需求小节，体现 `libs/infra/*` 模块、DDD 分层以及多租户权限协同
- [ ] T006 [P] [US1] 补充或修订 `specs/002-define-multitenant-guidelines/spec.md` 的成功指标、澄清记录与关键实体，确保指标可测且新增 `DomainBoundedContext` 指南
- [ ] T007 [US1] 更新 `specs/002-define-multitenant-guidelines/spec.md` 假设依赖，显式要求读者熟悉 DDD + Clean Architecture + CQRS + ES + EDA 架构

**Checkpoint**: Spec 文档完成，单独评审即可验证用户故事 1 的目标

---

## Phase 4: User Story 2 - 领域团队设计新模块 (Priority: P2)

**Goal**: 为领域团队提供可操作的数据模型指导与快速上手步骤，使其能按混合架构落地多租户/权限方案  
**Independent Test**: 领域团队成员仅参考 `data-model.md` 与 `quickstart.md` 即可绘制界限上下文图、列出聚合根职责并规划租户/权限设计

### Implementation for User Story 2

- [ ] T008 [US2] 扩充 `specs/002-define-multitenant-guidelines/data-model.md`，新增 `DomainBoundedContext Guideline` 字段说明与聚合根/事件溯源关联
- [ ] T009 [P] [US2] 更新 `specs/002-define-multitenant-guidelines/quickstart.md`，加入绘制界限上下文、命令/查询链接租户校验与权限策略的步骤

**Checkpoint**: 数据模型与 Quickstart 文档完成，自检可覆盖用户故事 2 的需求

---

## Phase 5: User Story 3 - 安全与合规复核 (Priority: P3)

**Goal**: 为安全与合规团队提供可直接执行的评审清单，覆盖越权审计、租户映射及事件溯源检查  
**Independent Test**: 合规人员按 `contracts/multitenant-permission-review.yaml` 自查可验证租户隔离、CASL 策略、DDD 混合架构落实情况并输出审计结论

### Implementation for User Story 3

- [ ] T010 [US3] 在 `specs/002-define-multitenant-guidelines/contracts/multitenant-permission-review.yaml` 添加 “DDD + Clean Architecture + CQRS + ES 协同” 检查段落及通过标准
- [ ] T011 [P] [US3] 细化同一清单中租户上下文、日志审计与第三方映射条目，确保与 Spec 边界条件、成功指标一致

**Checkpoint**: 检查清单完善，用户故事 3 达到独立审查能力

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 统一审视文档一致性与章程合规性，完成交付前收尾

- [ ] T012 [P] 审阅 `specs/002-define-multitenant-guidelines/` 下全部文件，确保引用一致、中文表达符合章程
- [ ] T013 汇总关键变更与章程对齐结论，记录在评审纪要或项目 Wiki（建议路径：`docs/memos/` 新增条目）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无前置依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Phase 1，完成后才可进入任何用户故事
- **User Stories (Phase 3-5)**: 需在 Phase 2 完成后执行；各故事互不依赖，可按优先级顺序或并行推进
- **Polish (Phase 6)**: 待目标用户故事完成后执行

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 完成后即可开始，无需等待其他故事
- **User Story 2 (P2)**: Foundational 完成后可开始；其结果不依赖 US1，但需引用 US1 定义的规范
- **User Story 3 (P3)**: Foundational 完成后可开始；需读取 US1 的规范内容，但编写检查清单时可独立完成

### Within Each User Story

- User Story 1: 先更新需求与实体（T005、T006），再写假设依赖（T007）
- User Story 2: 先完善数据模型（T008），再更新 Quickstart 指南（T009）
- User Story 3: 先新增 DDD 协同段（T010），再细化日志与映射检查（T011）

### Parallel Opportunities

- Setup 阶段 T002 可与后续任务并行，因其仅为资料复核
- Foundational 阶段 T004 可与后续故事并行准备，但在文档提交前需完成
- User Story 1 的 T006 可与 T005 并行（分别编辑不同章节）
- User Story 2 的 T009 可与 User Story 3 的任务并行执行，由不同成员负责
- Polish 阶段 T012 可在用户故事完成后与 T013 交叉进行

---

## Parallel Example: User Story 2

```bash
# 在不同成员之间并行推进
Task: "T008 [US2] 扩充 data-model.md，新增 DomainBoundedContext 指南"
Task: "T009 [P] [US2] 更新 quickstart.md，加入界限上下文与命令/查询步骤"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1 与 Phase 2，确立整体规范框架  
2. 执行 Phase 3（T005-T007），完成多租户与权限统一规范  
3. 架构负责人评审 `spec.md`，确认用户故事 1 达标后可对外发布初版规范

### Incremental Delivery

1. 完成 Setup + Foundational，确保设计文件一致  
2. 交付 User Story 1 作为 MVP → 发布主规范  
3. 交付 User Story 2 → 提供领域团队指导与 Quickstart  
4. 交付 User Story 3 → 发布安全合规评审清单  
5. 每一阶段均可独立评审并演示价值

### Parallel Team Strategy

1. 团队协作完成 Phase 1-2  
2. 指定人员并行执行：  
   - 人员 A：User Story 1（T005-T007）  
   - 人员 B：User Story 2（T008-T009）  
   - 人员 C：User Story 3（T010-T011）  
3. 最后共同完成 Polish 阶段，合并文档并输出章程对齐结论

---

## Notes

- [P] 任务需确保编辑不同文件或无依赖冲突  
- Story 标签追踪任务与用户故事的映射关系  
- 交付物以中文撰写并遵循章程  
- 每完成一个阶段应及时提交并请求评审  
- 可在任何 Checkpoint 暂停并进行独立审查，确保分阶段交付质量

