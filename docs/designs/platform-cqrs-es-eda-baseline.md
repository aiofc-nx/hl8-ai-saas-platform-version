## CQRS + ES + EDA 平台基线规范（拆分索引）

### 1. 文档目标
- 说明平台级 CQRS + ES + EDA 能力在拆分为 `@hl8/application-base` 与 `@hl8/infrastructure-base` 后的定位。
- 汇总两个基础包的职责、依赖关系与协同方式，为领域团队提供统一入口。
- 为后续的架构演进与文档维护提供索引指引。

### 2. 能力拆分概览

| 能力域 | 对应基础包 | 职责摘要 | 详细文档 |
| ----- | --------- | -------- | -------- |
| 命令/查询（CQRS）、Saga、权限协同、应用层审计协调 | `@hl8/application-base` | 提供应用层骨架、权限守卫、审计拦截、Saga 编排 | `docs/designs/application-base-baseline.md` |
| 事件溯源、事件驱动、缓存与权限能力、审计存储、日志、配置、异常 | `@hl8/infrastructure-base` | 提供基础设施实现、接口、适配器与运维规范 | `docs/designs/infrastructure-base-baseline.md` |

### 3. 协同关系
- `@hl8/application-base` 通过接口依赖注入方式调用 `@hl8/infrastructure-base` 的服务（事件存储、事件发布、权限缓存、审计记录等）。
- 两个基础包均遵循平台宪章：NodeNext 模块系统、中文 TSDoc、租户/组织/部门上下文必须显式传递。
- 领域模块通过 `PlatformCoreModule`（待拆分为 `ApplicationCoreModule` 与 `InfrastructureCoreModule`）实现能力装配。

### 4. 迁移指南（针对现有模块）
1. 将命令/查询基类、Saga、权限协同等应用层代码迁移至 `libs/application-base/`，参照应用层基线文档。
2. 将事件存储、事件发布器、缓存、审计、日志等基础设施代码迁移至 `libs/infrastructure-base/`。
3. 更新依赖注入关系：应用层模块仅依赖接口，实际实现由基础设施层提供。
4. 在业务模块设计文档中引用新的基线文档，并标注复用范围。

### 5. 版本与治理
- 两个基础包的变更需同步更新本索引，并记录在各自的 `CHANGELOG.md`。
- 架构评审需保证接口契约兼容，禁止双向依赖。
- 本索引文档保持高层次描述，细节以子文档为准。

### 6. 参考文档
- `docs/designs/application-base-baseline.md`
- `docs/designs/infrastructure-base-baseline.md`
- `docs/designs/platform-cqrs-es-eda-design.md`（拆分后的设计索引，计划同步更新）
