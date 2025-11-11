# IAM 规范评审模板

## 会议信息

- **会议日期**：YYYY-MM-DD
- **主持人**：
- **参会人员**：架构负责人 / 子域负责人 / 治理团队 / 平台基础设施团队 / 质量团队
- **会议类型**：初审 / 例行复审 / 紧急变更

## 议程

1. 规范背景与变更摘要回顾（架构负责人）
2. 关键章节逐项检查
3. 风险与补偿策略评估
4. 合规性与宪章检查结果
5. 结论与行动项确认

## 章节检查清单

| 序号 | 章节             | 检查要点                           | 证据来源                                        | 检查结论 | 补救/行动 | 备注               |
| ---- | ---------------- | ---------------------------------- | ----------------------------------------------- | -------- | --------- | ------------------ |
| 1    | 背景与目标       | 是否同步最新设计与宪章目标         | docs/designs/iam-specification.md               | 通过     | -         | D1-D6 引用齐全     |
| 2    | 架构原则         | 是否覆盖 CQRS/ES/CASL/基础设施要求 | docs/designs/iam-specification.md               | 通过     | -         | 五条原则已落地     |
| 3    | 多租户上下文责任 | 各层职责是否清晰、无缺漏           | docs/designs/iam-specification.md               | 通过     | -         | 责任表含风险防控   |
| 4    | 阶段计划         | 目标、交付物、质量门槛是否明确     | docs/designs/iam-specification.md               | 通过     | -         | Phase 1-4 指标完备 |
| 5    | 职责矩阵         | RACI 是否匹配最新团队结构          | docs/designs/iam-specification.md               | 通过     | -         | 含安全团队角色     |
| 6    | 合规检查         | 检查项是否完整、证据路径明确       | docs/designs/iam-specification.md               | 通过     | -         | 见 6.1 检查表      |
| 7    | 风险与补偿       | 风险是否更新、补偿措施充分         | docs/designs/iam-specification.md               | 通过     | -         | 风险表含补救流程   |
| 8    | 变更流程         | 流程是否可执行、通知机制完善       | docs/governance/iam-specification-governance.md | 通过     | -         | 回溯流程已列出     |

## Constitution Check

| 宪章条款               | 检查项                                     | 证据来源                          | 记录链接                                      | 检查结果 | 补救行动 | 备注 |
| ---------------------- | ------------------------------------------ | --------------------------------- | --------------------------------------------- | -------- | -------- | ---- |
| I. 中文优先原则        | 文档与注释是否中文                         | docs/designs/iam-specification.md | docs/governance/reports/constitution-check.md | 通过     | -        |      |
| II. 代码即文档原则     | 公共 API 是否同步 TSDoc                    | docs/designs/iam-specification.md | docs/governance/reports/constitution-check.md | 通过     | -        |      |
| III. 技术栈约束原则    | 依赖与框架是否符合约束                     | package.json                      | docs/governance/reports/constitution-check.md | 通过     | -        |      |
| IV. 测试要求原则       | 覆盖率与分层测试计划是否明确               | docs/designs/iam-specification.md | docs/governance/reports/constitution-check.md | 通过     | -        |      |
| V. 配置模块使用规范    | 是否统一使用 `@hl8/config`                 | docs/designs/iam-specification.md | docs/governance/reports/constitution-check.md | 通过     | -        |      |
| VI. 日志模块使用规范   | 是否统一使用 `@hl8/logger`                 | docs/designs/iam-specification.md | docs/governance/reports/constitution-check.md | 通过     | -        |      |
| VII. 异常模块使用规范  | 异常是否通过 `libs/infra/exceptions`       | docs/designs/iam-specification.md | docs/governance/reports/constitution-check.md | 通过     | -        |      |
| VIII. 缓存模块使用规范 | 缓存策略是否由 `libs/infra/cache` 管理     | docs/designs/iam-specification.md | docs/governance/reports/constitution-check.md | 通过     | -        |      |
| 附加约束               | 多租户隔离、DDD + CQRS + ES + EDA 是否落实 | docs/designs/iam-specification.md | docs/governance/reports/constitution-check.md | 通过     | -        |      |

## 风险与行动项

| 风险编号 | 描述                                             | 严重性 | 责任人   | 截止日期   | 状态   | 补救计划                  | 跟进记录                              |
| -------- | ------------------------------------------------ | ------ | -------- | ---------- | ------ | ------------------------- | ------------------------------------- |
| RISK-001 | 治理脚本仅完成初版占位逻辑，需要接入真实校验数据 | 中     | 治理团队 | 2025-11-14 | 已关闭 | 已将脚本接入真实校验与 CI | Constitution Check 报告（2025-11-14） |

## 评审结论

- **结果**：通过 / 有条件通过 / 驳回
- **审批人签字**：
- **跟进行动**：列出需在下一阶段前完成的任务与责任人。

> 本模板可复用于每次规范更新或季度复审，评审记录应存档于 `docs/governance/` 并同步至变更日志。
