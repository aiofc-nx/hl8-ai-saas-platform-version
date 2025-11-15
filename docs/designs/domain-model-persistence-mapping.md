## 聚合根、实体、值对象与数据表映射关系指南

### 1. 背景与目标

- 明确 DDD 领域模型（聚合根、实体、值对象）与关系型数据库表之间的常见映射策略。
- 保持领域层纯净性：映射细节位于基础设施层，但需在设计阶段提前规划。
- 指导团队在使用 MikroORM/Prisma 等 ORM 时遵循统一准则，避免聚合边界被持久化层破坏。

### 2. 领域模型要点回顾

- **聚合根 (Aggregate Root)**：聚合边界的入口，拥有全局唯一标识，负责维护聚合内部一致性。
- **实体 (Entity)**：在聚合内部具有标识和生命周期的对象，其标识由聚合根管理。
- **值对象 (Value Object)**：无独立标识，不变或轻量可替换的数据结构；等值性由状态决定。

### 3. 映射原则总览

1. **领域先行**：优先根据业务定义聚合边界，再设计数据表结构。
2. **聚合根主控**：数据库中的主表应体现聚合根的标识与版本信息。
3. **实体按需建表**：实体是否独立建表取决于查询需求、数据规模及一致性要求。
4. **值对象嵌入**：值对象通常作为字段存储，不单独建表，除非需要复用/查询。
5. **保持纯净**：领域层不依赖具体 ORM 与表结构，由基础设施层处理映射。

### 4. 常见映射策略

#### 4.1 聚合根 → 主表

- **结构**：一聚合根对应一张主表，包含：
  - `id`（聚合根标识）
  - 时间戳：`created_at`、`updated_at`
  - 领域状态字段：如授权状态、聚合级属性
  - 乐观锁字段：`version`
- **示例**：`user_authorizations` 表存储 `UserAuthorization` 聚合根数据。

#### 4.2 聚合内实体 → 子表或嵌入

- **单表嵌入**：
  - 适用：实体结构简单、数量固定或通过 JSON 存储即可满足查询。
  - 表现：在主表中新增 JSON/数组字段，如 `roles JSONB`。
- **子表映射**：
  - 适用：实体具备独立查询需求、数量多或需要索引。
  - 表现：创建子表（如 `user_authorization_roles`），包含外键 `aggregate_id`，以及实体标识。
- **规则**：
  - 实体的标识不暴露给聚合外部，其生命周期由聚合根管理。
  - 子表的外键必须与聚合根 ID 建立绑定，确保聚合一致性。

#### 4.3 值对象 → 字段

- 值对象通过聚合根/实体的字段表现，例如：
  - `tenant_id`、`department_ids` 列。
  - `Money` 值对象拆分为 `amount`、`currency` 两列。
  - `DateRange` 值对象映射为 `start_at`、`end_at`。
- 若值对象存在复用或复杂结构，可使用嵌入式对象（ORM Embeddable）或 JSON 字段，但仍由聚合根控制。

### 5. 示例：用户授权聚合

```
UserAuthorization (聚合根)
 ├─ TenantRole (实体，多条)
 ├─ Permission (值对象，多条)
 └─ AuthorizationStatus (值对象)
```

**数据库设计示例**：

- `user_authorizations`（主表）
  - `id` (PK)
  - `tenant_id`
  - `user_id`
  - `status`
  - `created_at`
  - `updated_at`
  - `version`
- `user_authorization_roles`（子表）
  - `aggregate_id` (FK → user_authorizations.id)
  - `role_name`
  - `assigned_at`
  - `assigned_by`
  - `PRIMARY KEY (aggregate_id, role_name)`
- `user_authorization_permissions`（子表或 JSON 字段）
  - 可选：若权限需要快速查询、新增索引，可建表；否则存入主表 JSON 数组。

### 6. ORM 与实现建议

- 聚合根与实体在 ORM 中使用一对多/多对一关系实现。
- 值对象可使用 Embeddable、Transformers 或自定义类型封装。
- 聚合根的 `version` 字段用于乐观锁（MikroORM 提供 Versioning 支持）。
- 实现需在仓储层封装数据访问，并转换回领域对象。

### 7. 迁移与测试注意事项

- **数据库迁移**：聚合根主表需先建，子表与外键随后建立；注意多租户隔离策略（如复合主键 `tenant_id + id`）。
- **测试**：
  - 单元测试：使用内存仓储/模拟仓储。
  - 集成测试：验证 ORM 映射与数据库结构对应关系。
- **数据一致性**：
  - 聚合更新时需在事务内操作主表与子表，确保一元操作。
  - 子表变更需通过聚合根方法驱动，不直接操作仓储外暴露接口。

### 8. 建模与映射协作流程

1. 领域建模阶段确定聚合结构、实体、值对象。
2. 与基础设施团队讨论查询需求、扩展性，决定实体是否建表。
3. 编写领域层聚合/实体/值对象代码。
4. 在基础设施层实现 ORM 实体、映射、仓储。
5. 编写迁移脚本与集成测试。
6. 更新领域文档和数据库设计文档，保持同步。

### 9. 参考文档

- `docs/designs/platform-domain-baseline.md`
- `docs/designs/platform-domain-design.md`
- `docs/designs/platform-cqrs-es-eda-design.md`
- `docs/designs/iam-guide.md`

---

通过以上映射指南，团队能够在领域建模与数据库设计之间建立清晰的桥梁，既保证 DDD 的聚合边界，又满足业务对可查询性、扩展性和一致性的要求。任何个性化的持久化优化（例如事件溯源存储、CQRS 读模型）应在尊重聚合边界的基础上，由领域与基础设施团队共同评审决定。
