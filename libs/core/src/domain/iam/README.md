# IAM 领域层（Domain Layer）

> **职责**：定义身份与访问管理的核心领域模型，包括聚合、实体、值对象与领域事件。

- 聚焦业务语义，保持与 `specs/001-define-iam-spec/data-model.md` 同步。
- 所有导出需通过 `index.ts` 统一汇总，供应用层与基础设施层复用。
- 注释遵循 TSDoc 规范，确保代码即文档。

