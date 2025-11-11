# Tasks: IAM 基线规范落地

**Input**: Design documents from `/specs/001-define-iam-spec/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story以保证各故事可独立实现与验证。

## Phase 1: Setup (共享基础)

**Purpose**: 搭建规范交付所需的文档骨架与治理支撑。

- [ ] T001 在 docs/designs/iam-specification.md 创建包含“背景、原则、阶段计划、职责矩阵、合规检查、风险、变更流程”章节的中文大纲。
- [ ] T002 建立 docs/governance/iam-specification-change-log.md 初始版本条目，记录版本号、日期与负责人。
- [ ] T003 [P] 起草 docs/governance/iam-specification-review-template.md 模板，列出评审会议议程与确认项。

---

## Phase 2: Foundational (阻塞前置)

**Purpose**: 汇整统一规范所需的引用与治理要求，确保后续用户故事具备同一基线。

- [ ] T004 汇编 docs/designs/iam-specification.md#参考资料 表格，逐项列出 iam-v2、casl 方案、iam-plan 关键章节链接与摘要。
- [ ] T005 [P] 在 docs/governance/iam-specification-governance.md 定义规范审批流程、版本晋级条件与通知机制。

---

## Phase 3: User Story 1 - 架构负责人统一规范 (Priority: P1) 🎯 MVP

**Goal**: 输出整合宪章与设计文档的统一规范主体，明确架构原则与多租户责任。

**Independent Test**: 仅凭 docs/designs/iam-specification.md，即可在评审会上完成核心原则对照并获得确认。

### Implementation

- [ ] T006 [US1] 在 docs/designs/iam-specification.md 撰写“背景与目标”章节，汇总宪章与现有设计的定位。
- [ ] T007 [P] [US1] 填写“架构原则”章节，覆盖 CQRS、ES、CASL、CLS、多租户上下文传递要求。
- [ ] T008 [US1] 整理“多租户上下文责任”小节，描述接口层、应用层、领域层、基础设施层的校验职责。

---

## Phase 4: User Story 2 - 子域负责人规划交付 (Priority: P2)

**Goal**: 通过规范明确阶段目标、职责矩阵与子域交付清单，支持各团队制定计划。

**Independent Test**: 根据规范即可拆解阶段任务并制定各子域的详细计划，无需额外口头同步。

### Implementation

- [ ] T009 [US2] 在 docs/designs/iam-specification.md 完成“里程碑计划”表，列出四阶段目标、交付物、质量门槛与时间建议。
- [ ] T010 [P] [US2] 编制“职责矩阵”章节，按架构负责人、子域负责人、治理团队、平台基础设施团队标注 RACI。
- [ ] T011 [US2] 更新 specs/001-define-iam-spec/data-model.md 中的子域交付清单，补充依赖关系与质量门槛字段。

---

## Phase 5: User Story 3 - 治理团队执行审计 (Priority: P3)

**Goal**: 提供治理团队执行 Constitution Check 与风险管控所需的工具与流程。

**Independent Test**: 治理团队依据规范生成 Constitution Check 报告并启动必要的补救或变更流程。

### Implementation

- [ ] T012 [US3] 在 docs/designs/iam-specification.md 编写“合规检查与风险缓解”章节，涵盖检查项、风险预案与补偿流程。
- [ ] T013 [P] [US3] 充实 docs/governance/iam-specification-review-template.md，新增 Constitution Check 检查表与记录栏位。
- [ ] T014 [US3] 在 package.json 添加 `iam:constitution-check` 与 `iam:milestone-report` 脚本，并指向治理脚本入口。
- [ ] T015 [P] [US3] 完善 specs/001-define-iam-spec/contracts/README.md，补充 `SpecificationUpdatedEvent` 载荷字段与触发条件。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 收尾文档与治理资产，确保一致性与可追溯性。

- [ ] T016 更新 docs/governance/iam-specification-change-log.md，记录基线发布版本与审批人签字。
- [ ] T017 [P] 根据 specs/001-define-iam-spec/quickstart.md 执行验证流程，并在 docs/governance/iam-specification-governance.md 记录结果。
- [ ] T018 在 docs/governance/iam-specification-governance.md 汇总阶段评审结论与后续行动项。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → 无前置，可立即开始。
- **Phase 2 Foundational** → 依赖 Phase 1，完成后才能进入任一用户故事。
- **Phase 3-5 用户故事** → 均依赖 Phase 2，可按优先级（P1→P2→P3）或并行执行。
- **Phase 6 Polish** → 待所有目标用户故事完成后执行。

### User Story Dependencies

- **US1** 无其他故事依赖，完成后可作为规范初版基线。
- **US2** 依赖 US1 提供的统一规范框架与章节结构。
- **US3** 依赖 US1/US2 的章节完备度，以对齐合规检测内容。

### Parallel Opportunities

- Setup 阶段 T003 可与 T001、T002 并行。
- Foundational 阶段 T005 可与 T004 并行。
- US1 中 T007 可与 T006/T008 并行；US2 中 T010 可与 T009/T011 并行；US3 中 T013、T015 可并行推进。
- Polish 阶段 T017 可与 T016、T018 同步执行。

---

## Implementation Strategy

### MVP First（交付 User Story 1）

1. 完成 Phase 1-2 建立基础。
2. 推进 Phase 3（US1）并通过评审验证核心规范。
3. 发布初版规范供团队启动开发。

### Incremental Delivery

1. 在 MVP 基础上补充 Phase 4（US2）以支持子域计划。
2. 继续完成 Phase 5（US3）提供治理工具链。
3. 最后执行 Phase 6 统一记录与收尾。

### Parallel Team Strategy

1. 团队先协作完成 Phase 1-2。
2. 架构负责人主导 US1，子域负责人并行推进 US2，治理团队关注 US3。
3. 全部故事完成后共同处理 Phase 6，形成最终基线。\*\*\* End Patch
