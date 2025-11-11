# IAM Phase 5 执行计划（User Story 3 – 治理团队执行审计）

## 目标概述

Phase 5 面向治理团队，需在规范中补充合规检查与风险缓解章节，完善评审模板、脚本与契约，使治理人员能够独立完成 Constitution Check、生成报告并触发必要的补救或变更流程。

## 任务拆解

### Task T012：编写“合规检查与风险缓解”章节

- **目标**：在 `docs/designs/iam-specification.md` 补充治理团队执行检查的清晰指引。
- **行动项**：
  1. 列出宪章八项原则与附加约束对应的检查项，以及所需证据路径。
  2. 明确风险预案与补偿策略（如权限缓存滞后、跨租户访问、认证协议延迟等）的执行步骤与责任人。
  3. 引用 `docs/governance/iam-specification-governance.md` 的流程，说明补救触发条件与记录位置。
- **完成标准**：章节结构包含检查表、风险列表和补救步骤，治理团队可直接依据执行。

### Task T013：完善评审模板

- **目标**：在 `docs/governance/iam-specification-review-template.md` 中增强 Constitution Check 表格与记录栏位。
- **行动项**：
  1. 为每条宪章条款添加“证据来源”“记录链接”“结果”输入格。
  2. 增加风险与补救记录区，便于追踪治理行动。
  3. 确保模板字段与 Phase 5 新章节术语一致（如补救流程、事件编号）。
- **完成标准**：模板可直接填写审计记录，治理团队无需额外文档即可完成评审。

### Task T014：新增治理脚本入口

- **目标**：在 `package.json` 添加 `iam:constitution-check` 与 `iam:milestone-report` 脚本，作为治理自动化入口。
- **行动项**：
  1. 添加脚本命令（可指向占位命令或后续将实现的脚本），例如 `pnpm ts-node scripts/iam/constitution-check.ts`。
  2. 在脚本注释或 README 中说明输出格式（JSON 与 Markdown 报告）和存储位置。
  3. 确认脚本命令与治理文档描述一致。
- **完成标准**：`package.json` 包含脚本条目，团队可以运行占位命令，后续实现脚本时无需变更命名。

### Task T015：完善治理契约

- **目标**：补充 `specs/001-define-iam-spec/contracts/README.md` 中的 `SpecificationUpdatedEvent` 载荷规范和触发条件。
- **行动项**：
  1. 列出事件字段（如 `specVersion`、`updatedBy`、`changeType`、`impactedSubdomains`、`requiredActions`）。
  2. 描述触发场景（例：规范评审通过、补救完成、治理团队发起通知）。
  3. 说明消费方（治理服务、审计日志系统、通知服务）及其处理要求。
- **完成标准**：契约文档可作为实现和测试参考，确保治理事件统一。

## 完成判定

- `docs/designs/iam-specification.md` 含完整合规检查与风险缓解章节。
- 评审模板包含审计记录所需字段，且命名与规范一致。
- `package.json` 脚本条目存在并可运行占位命令。
- 契约文档说明事件字段、触发条件与消费方。
- 变更日志更新 Phase 5 完成记录，注明治理团队可以独立运行审计流程。

## 后续衔接

完成 Phase 5 后，将具备执行 Constitution Check 和生成治理报告的全部工具，可进入 Phase 6（Polish），进行收尾和交叉检查。\*\*\* End Patch
