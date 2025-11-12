# 任务清单：平台领域核心能力

**输入**：来自 `/specs/001-domain-base/` 的设计文档  
**前置文件**：plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md

**测试说明**：规格要求核心聚合与值对象的单元测试覆盖率 ≥95%，因此保留对应的测试任务并采用先写测试的流程。

**组织方式**：任务按用户故事分组，确保每个故事可以独立实现与验证。

## 格式规范：`[ID] [P?] [Story] 描述`

- **[P]**：可并行执行（操作不同文件且无依赖）
- **[Story]**：所属用户故事（US1、US2、US3）
- 描述中必须包含精确文件路径

## 路径约定

- 领域核心库：`libs/domain-base/src/**`
- 单元测试：与被测文件同目录或位于 `libs/domain-base/tests/**`
- 领域测试基座：`libs/domain-testing/**`
- 设计与文档：`specs/001-domain-base/**`、`docs/designs/**`

---

## 阶段 1：环境搭建（共享基础设施）

**目的**：确保 `@hl8/domain-base` 遵循领域纯净性约束，消除对基础设施模块的耦合。

- [x] T001 移除领域层不允许的基础设施依赖并校验版本，更新 `libs/domain-base/package.json`
- [x] T002 对齐 TypeScript NodeNext 配置与严格选项，更新 `libs/domain-base/tsconfig.json`
- [x] T003 调整 Jest 设置以支持 NodeNext 与实验性 VM 模块，更新 `libs/domain-base/jest.config.ts`
- [x] T004 初始化纯领域测试基座目录，创建 `libs/domain-testing/package.json` 与 `libs/domain-testing/tsconfig.json`

---

## 阶段 2：基础能力（阻塞项）

**目的**：准备所有用户故事共享的基础结构与导出清单。

**⚠️ 严格要求**：此阶段完成前不得开始任何用户故事任务。

- [x] T005 将 `libs/domain-testing` 納入工作空间并配置构建脚本，更新 `pnpm-workspace.yaml` 与根 `package.json`
- [x] T006 建立公共导出骨架与目录结构，初始化 `libs/domain-base/src/index.ts`

**检查点**：根目录结构、工作空间与导出骨架就绪，可启动用户故事。

---

## 阶段 3：用户故事 1 - 快速建立聚合基线（优先级：P1）🎯 MVP

**目标**：提供统一的聚合根、实体和值对象基类，实现租户隔离、审计记录、软删除与基础守卫能力。

**独立验证方式**：在示例领域模块中引用 `@hl8/domain-base`，通过单元测试确认聚合构造、软删除、租户断言与审计字段自动生效。

### 用户故事 1 的测试

- [x] T007 [P] [US1] 编写聚合根基线行为测试，创建 `libs/domain-base/tests/aggregates/aggregate-root.base.spec.ts`
- [x] T008 [P] [US1] 编写租户标识与审计值对象测试，创建 `libs/domain-base/tests/value-objects/tenant-context.value-object.spec.ts`

### 用户故事 1 的实现

- [x] T009 [US1] 实现聚合标识值对象 `libs/domain-base/src/aggregates/aggregate-id.value-object.ts`
- [x] T010 [US1] 实现多租户上下文值对象 `libs/domain-base/src/value-objects/tenant-id.vo.ts`、`organization-id.vo.ts`、`department-id.vo.ts`、`user-id.vo.ts`
- [x] T011 [US1] 实现审计轨迹值对象 `libs/domain-base/src/auditing/audit-trail.value-object.ts`
- [x] T012 [US1] 实现软删除状态值对象 `libs/domain-base/src/auditing/soft-delete-status.value-object.ts`
- [x] T013 [US1] 实现领域守卫工具集 `libs/domain-base/src/utils/domain-guards.ts`
- [x] T014 [US1] 实现 UUID 生成器封装 `libs/domain-base/src/utils/uuid-generator.ts`
- [x] T015 [US1] 实现实体基类 `libs/domain-base/src/entities/entity.base.ts`
- [x] T016 [US1] 实现聚合根基类（含租户断言、审计、软删除）`libs/domain-base/src/aggregates/aggregate-root.base.ts`
- [x] T017 [US1] 构建聚合测试基座 `libs/domain-testing/src/aggregate-test-harness.ts`
- [x] T018 [US1] 更新公共导出与中文 README，修改 `libs/domain-base/src/index.ts` 与 `libs/domain-base/README.md`

**检查点**：聚合根、实体和值对象可独立使用，测试通过并满足软删除与审计行为。

---

## 阶段 4：用户故事 2 - 保障领域事件一致性（优先级：P2）

**目标**：确保聚合根可收集并发布携带租户上下文与审计信息的领域事件。

**独立验证方式**：通过单元测试验证 `addDomainEvent` 与 `pullDomainEvents` 行为，以及领域事件载荷中的租户与审计字段完整性。

### 用户故事 2 的测试

- [x] T019 [P] [US2] 编写领域事件基类与聚合事件队列测试，创建 `libs/domain-base/tests/events/domain-event.base.spec.ts`

### 用户故事 2 的实现

- [x] T020 [US2] 实现领域事件基类（含上下文与审计）`libs/domain-base/src/events/domain-event.base.ts`
- [x] T021 [US2] 定义领域事件调度契约 `libs/domain-base/src/events/domain-event-dispatcher.interface.ts`
- [x] T022 [US2] 扩展聚合根基类以支持事件队列与 `pullDomainEvents` 行为 `libs/domain-base/src/aggregates/aggregate-root.base.ts`

**检查点**：事件测试通过，聚合根能够生成并导出完整上下文的领域事件。

---

## 阶段 5：用户故事 3 - 规范仓储接口（优先级：P3）

**目标**：提供统一的仓储接口与领域服务契约，确保多租户过滤与软删除语义一致。

**独立验证方式**：使用测试桩实现仓储接口，验证租户上下文与软删除过滤逻辑可被一致地消费。

### 用户故事 3 的测试

- [x] T023 [P] [US3] 编写仓储契约测试并验证租户过滤约束，创建 `libs/domain-base/tests/repositories/repository.interface.spec.ts`

### 用户故事 3 的实现

- [x] T024 [US3] 定义仓储接口与查询条件类型 `libs/domain-base/src/repositories/repository.interface.ts`
- [x] T025 [US3] 定义领域服务接口并声明使用约束 `libs/domain-base/src/services/domain-service.interface.ts`

**检查点**：仓储与领域服务契约可独立复用，测试验证租户与软删除约束无回归。

---

## 阶段 6：打磨与跨切关注点

**目的**：同步文档、契约与质量门槛，保证全局一致性。

- [x] T026 [P] 校验并补充 Scaffolding API 契约示例，更新 `specs/001-domain-base/contracts/domain-base.openapi.yaml`
- [x] T027 汇总多租户守卫与仓储约束写入设计文档 `docs/designs/platform-domain-baseline.md`
- [x] T028 执行覆盖率校验并记录 quickstart 更新，修改 `libs/domain-base/tests/` 与 `specs/001-domain-base/quickstart.md`

---

## 依赖与执行顺序

### 阶段依赖

- **阶段 1 → 阶段 2**：完成纯净性与配置调整后才能建立公共导出骨架。
- **阶段 2 → 阶段 3/4/5**：导出骨架和工作空间准备完毕后，各用户故事方可启动。
- **阶段 6**：依赖所有目标用户故事完成。

### 用户故事依赖

- **用户故事 1（P1）**：依赖阶段 2，完成后形成 MVP。
- **用户故事 2（P2）**：依赖阶段 3 的聚合基线成果。
- **用户故事 3（P3）**：依赖阶段 3 的多租户值对象，用于仓储契约。

### 用户故事内部顺序

- 先编写测试（T007、T008、T019、T023），确认失败后再实现。
- 值对象与守卫（T009–T014）先于聚合根实现（T016）。
- 仓储与领域服务契约（T024、T025）依赖聚合根/值对象已准备。

### 并行机会

- 阶段 1 完成后，T007 与 T008 可并行编写测试；实现阶段中值对象任务（T010–T014）也可部分并行。
- 用户故事 2 与 3 在阶段 3 完成后可分别由不同成员推进。
- 阶段 6 中的文档与覆盖率任务（T026、T027、T028）可由不同角色并行执行。

---

## 实施策略

### MVP 优先

1. 完成阶段 1–2 的纯净性与结构准备。
2. 执行阶段 3（T007–T018），交付聚合与值对象基线。
3. 运行测试确认覆盖率达到 95% 要求后即可演示。

### 渐进式交付

1. 阶段 3 交付聚合基线 → 推进阶段 4 领域事件 → 推进阶段 5 仓储契约。
2. 每完成一阶段立即运行测试并更新 Quickstart，确保可独立发布。

### 多人并行策略

1. 团队共同完成阶段 1–2。
2. 分工建议：
   - 成员 A：负责阶段 3（聚合基线与测试基座）。
   - 成员 B：负责阶段 4（领域事件与队列集成）。
   - 成员 C：负责阶段 5（仓储与领域服务契约）。
3. 阶段 6 由成员共享完成文档与覆盖率收尾。

---

## 备注

- 标记 `[P]` 的任务可由不同成员在互不干扰的文件上并行推进。
- 提交信息需使用英文，且完成一个任务或逻辑单元即提交一次。
- 确保所有公共 API 带有中文 TSDoc 注释，并在完成后运行 ESLint 与测试。

