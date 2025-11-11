# IAM 接口层（Interfaces Layer）

> **职责**：承载与外部交互的接口适配层，包括控制器、DTO、守卫与拦截器。

- 聚焦用例编排与输入/输出契约，保持与 `specs/001-define-iam-spec/contracts/` 对齐。
- 仅进行轻量的数据转换与校验，不包含业务决策。
- 所有导出需通过 `index.ts` 统一对外暴露，方便应用直接引用。

