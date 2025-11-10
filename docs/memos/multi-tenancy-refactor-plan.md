# 多租户基础设施重构备忘录

## 📌 背景

近期更新了 `docs/guides` 系列规范（应用层 / 领域层 / 基础设施层 / 接口层），明确：

- **ID 统一规范**：所有领域实体与聚合根 ID 使用 UUID v4；
- **聚合根审计**：强制维护 `createdAt`、`updatedAt`、`deletedAt`，支持软删除审计事件；
- **多层数据隔离**：租户 → 组织 → 部门三级边界需在应用层与仓储层同时落实。

现有 `libs/infra/multi-tenancy` 模块已经提供多租户上下文、CLS、仓储基类等实现，需要与上述规范对齐，并在未来重构中统筹更新。

## ✅ 现有实现与规范对照

| 能力 | 现状 | 规范要求 | 结论 |
| --- | --- | --- | --- |
| 租户上下文管理 | CLS + `TenantContextExecutor` 自动注入 | 与指南一致 | 保留 |
| 仓储过滤 | `BaseTenantRepository` 自动追加 `tenantId` | 匹配租户级隔离 | 保留，但需扩展组织/部门校验 |
| 持久化订阅 | `TenantAwareSubscriber` 写入/校验 `tenantId` | 防止串租 | 保留 |
| ID 生成 | 领域层值对象负责 UUID v4，数据库使用 `uuid` | 与规范一致 | 保留 |
| 审计字段 | 数据库实体含 `createdAt`/`updatedAt`/`deletedAt?` | 聚合需同步触发 `touch()`/`softDelete()` | 重构中校验映射器 |
| 日志接口 | 使用 `Logger` (`@hl8/logger`) | 指南推荐 `AppLoggerService`/`InjectLogger` | 后续统一注入方式 |
| 多级隔离 | 仅租户级 | 指南要求租户+组织+部门 | 需在仓储自定义方法中附加更多约束 |

## 🛠️ 下一步重构行动

1. **仓储扩展多级过滤**
   - 在继承 `BaseTenantRepository` 的业务仓储中，添加 `organizationId`、`departmentId` 约束；
   - 为常见查询提供模板方法（例如 `findByOrganization(tenantId, organizationId)`）。

2. **日志注入统一化**
   - 将 `Logger` 替换为指南推荐的 `AppLoggerService` 或 `InjectLogger`；
   - 更新 README，示例中说明使用方式。

3. **审计字段同步**
   - 确保实体映射器会把聚合的 `createdAt`、`updatedAt`、`deletedAt` 写回数据库；
   - 对软删除事件（`TenantArchivedEvent` 等）追加基础设施侧的示例。

4. **文档对齐策略**
   - 在指南中引用 `libs/infra/multi-tenancy` 的核心能力，让制度与代码互相佐证；
   - README 标注“与指南对照”的章节，方便后续检查。

## 🔄 路线建议

1. **短期**：保留 `libs/infra/multi-tenancy` 现有实现，按上述行动项逐项补齐；
2. **中期**：重构完成后，复查 `docs/guides` 与 README 的内容，避免重复或冲突；
3. **长期**：考虑提供装饰器、脚手架等工具，简化多租户配置与测试。

---

*文档更新时间：2025-11-10*  
*维护人：GPT-5 Codex（自动生成，可在重构执行前按需补充）*

