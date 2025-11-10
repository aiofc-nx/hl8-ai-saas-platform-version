# 快速上手：多租户与权限设计规范

## 1. 准备阶段
1. 阅读 `docs/memos/hl8-multitenant-permission-plan.md`，熟悉平台既有架构与基础设施模块。
2. 在业务仓库中引入 `libs/infra/multi-tenancy` 与 `libs/infra/mikro-orm-nestjs`，确保依赖与 ESLint/TSConfig 已正确指向根配置。

## 2. 设计草案编写
1. 按照 `spec.md` 中的 `TenantExecutionContext 指南` 描述，罗列 HTTP、消息、任务三类入口的租户解析流程。
2. 绘制 DDD 界限上下文图，列出聚合根、领域服务、命令/查询处理器，并记录其与租户上下文、权限策略的协作关系。
3. 依据 `TenantIsolation Control Matrix` 建立应用层、数据库、缓存、事件四级隔离清单，并标注责任人。
4. 参照 `RoleCapabilityRegistry` 模型设计角色-能力元数据表，约定发布与回滚流程。

## 3. 评审准备
1. 填写 `contracts/multitenant-permission-review.yaml` 中的自查项，附上证据链接。
2. 确认 DDD 分层设计满足命令/查询职责单一、领域事件溯源与读写模型解耦要求，并补充示例。
3. 输出日志与监控计划：明确越权告警、共享资源审计、第三方映射日志的结构化字段。
4. 为关键仓储/守卫/领域服务/命令处理器规划测试套件，确保覆盖率目标与负面场景。

## 4. 提交流程
1. 在设计评审会议前至少一天，将规范自查结果与附件上传至团队文档库。
2. 评审通过后，将 `RoleCapabilityRegistry` 初始版本登记至配置中心，并安排接入安全团队的周度审计。
3. 若后续规范更新，需同步维护 `specs/002-define-multitenant-guidelines` 下的交付物并通知所有域团队。

