# Contracts：IAM 基线规范落地

本规范不直接引入新的对外 API，但需确保以下内部契约被遵循并在后续实现阶段落实。

## 1. 文档交付契约

- **名称**：`IamSpecificationPublished`
- **触发条件**：`IAM 规范主体` 进入 Baseline 状态。
- **载体**：`docs/designs/iam-specification.md`（后续将由本规范产出）。
- **字段**：
  - `version`：规范语义化版本。
  - `effectiveAt`：生效日期。
  - `changeSummary`：本次变更摘要。
  - `reviewers`：评审人列表。
  - `links`：关联设计文档、Constitution Check 报告链接。

## 2. 审计事件契约

- **事件名**：`SpecificationUpdatedEvent`
- **发布方**：治理团队/文档维护者。
- **订阅方**：平台治理服务、审计日志系统、通知服务。
- **负载字段**：
  - `specVersion`：规范当前语义化版本。
  - `updatedBy`：触发事件的责任人。
  - `updateReason`：`ConstitutionChange` | `DesignDrift` | `RiskMitigation` | `AuditFinding`。
  - `impactedSubdomains`：受影响子域列表。
  - `requiredActions`：后续需执行的任务（含责任人/截止日期）。
  - `evidenceLinks`：补救报告、评审记录等链接。
  - `emittedAt`：事件触发时间（ISO 8601）。
- **触发条件**：
  1. 规范进入 Baseline 或完成 Amending 流程。
  2. 宪章检查发现缺陷并完成补救。
  3. 风险事件触发并记录补救计划。
- **消费者要求**：
  - 治理服务：生成通知并更新风险看板。
  - 审计日志系统：落库并保留至少 1 年。
  - 通知服务：推送至架构/治理频道，附带 `requiredActions`。

> 事件需通过现有事件总线广播，遵循 EDA 流程，并写入 `AuditService`。

## 3. 测试与治理接口契约

- **CLI**：`pnpm run iam:constitution-check`
  - **功能**：按照规范中列出的检查项执行自动化验证（覆盖 CASL 能力缓存、日志格式、配置校验等）。
  - **输出**：JSON + Markdown 报告，供治理团队审阅。
- **CLI**：`pnpm run iam:milestone-report`
  - **功能**：生成阶段交付进度与质量指标报表，映射至规范中的里程碑表。

## 4. 后续扩展

- 若后续迭代新增 REST/GraphQL 契约以暴露规范元数据，需复用 `MultiTenantController` 并确保返回体包含 `tenantId`、`version`、`milestones` 等字段；本阶段仅记录准则，具体 Schema 将在实现前补充。\*\*\* End Patch
