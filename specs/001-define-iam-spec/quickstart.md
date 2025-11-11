# Quickstart：IAM 基线规范落地

## 前置条件

1. 已切换到分支 `001-define-iam-spec`，并安装依赖 `pnpm install`。
2. 熟读以下文档：
   - `docs/designs/iam-v2.md`
   - `docs/designs/casl-muti-tenant-auth-cqrs-es-eda.md`
   - `docs/designs/saas-platform-iam-plan.md`
   - `docs/guides/*` 多租户与分层指南
3. 了解宪章条款 I-VIII 及附加约束。

## 步骤概览

1. **同步规范基线**
   - 在 `docs/designs` 新建/更新 `iam-specification.md`（待本计划输出）。
   - 引用上述设计文档要点，形成统一章节结构（背景、原则、阶段计划、职责矩阵、合规检查、风险缓解、变更流程）。
2. **建立责任矩阵**
   - 根据 `spec.md` 中的角色定义（架构负责人、子域负责人、治理团队、平台基础设施团队），制作 RACI 表并附加到规范文档。
3. **对照阶段任务**
   - 参照 `spec.md` 的四个阶段，在 `tasks.md`（Phase 2）准备阶段任务模板。
   - 为每个阶段列出交付物、质量门槛、依赖与风险。
4. **配置 Constitution Check 工具链**
   - 若存在 `pnpm run constitution:check`（示例），更新其脚本使之读取本规范提供的检查项。
   - 输出 Markdown/JSON 报告，归档至 `docs/governance/`.
5. **阶段评审流程**
   - 完成阶段一后召开评审会：验证多租户上下文链路、CLS、命令/查询基类、最小 API。
   - 记录结论与行动项，更新规范版本。

## 常见问题

- **Q：规范更新频率？**  
  A：当宪章或设计文档调整、阶段评审产出重大变更、治理检查发现缺口时即刻更新；常规情况下至少季度复核一次。

- **Q：如何确保团队遵循规范？**  
  A：规范中需明确评审与审批流程；通过 Constitution Check、阶段评审会和审计事件 `SpecificationUpdatedEvent` 绑定。

- **Q：规范与代码如何保持一致？**  
  A：新功能合并前必须在 PR 中引用规范章节；若实现偏离规范需先提交规范变更提案，获批后方可开发。\*\*\* End Patch
