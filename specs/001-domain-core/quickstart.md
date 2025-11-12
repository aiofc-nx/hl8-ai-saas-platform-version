# Quickstart - @hl8/domain-base

## 目标

帮助领域团队在 30 分钟内完成 `@hl8/domain-base` 接入，包括聚合根创建、值对象定义、领域事件推送与测试基座构建，确保租户隔离、审计与软删除能力默认生效。

## 前置条件

- 已在工作站安装 Node.js ≥ 20、pnpm ≥ 10。  
- 已同步平台 monorepo 并切换到目标业务领域分支。  
- CI/CD 环境可在应用层、基础设施层引入 `@hl8/config`、`@hl8/logger`、`libs/infra/exceptions` 等模块，但领域层代码必须保持无直接依赖。  
- 开发者熟悉章程要求的 DDD + CQRS + EDA 基线。

## 步骤一：安装与初始化

1. 在业务包中声明依赖：
   ```bash
   pnpm add @hl8/domain-base @hl8/domain-testing --filter <your-domain-package>
   ```
2. 确认 `tsconfig.json` 继承平台 NodeNext 基线，并开启 `strict`, `noUncheckedIndexedAccess`, `useUnknownInCatchVariables`。
3. 在 `jest.config.ts` 中启用 `NODE_OPTIONS=--experimental-vm-modules`，并将 `@hl8/domain-testing` 注册为测试 utils。

## 步骤二：使用脚手架生成领域骨架

1. 请求内部 Scaffolding API 以创建聚合根：
   ```bash
   curl -X POST https://internal.hl8.dev/api/domain-base/aggregates \
     -H "Content-Type: application/json" \
     -d '{
       "aggregateName": "TenantLifecycle",
       "tenantContext": { "tenantId": true, "organizationId": true },
       "invariants": ["租户状态必须与生命周期阶段一致"],
       "emitEvents": ["TenantActivatedEvent", "TenantSuspendedEvent"]
     }'
   ```
2. 生成值对象与领域事件骨架：
   ```bash
   curl -X POST https://internal.hl8.dev/api/domain-base/value-objects \
     -H "Content-Type: application/json" \
     -d '{
       "valueObjectName": "TenantLifecyclePhase",
       "fields": [{ "name": "value", "type": "string" }],
       "validationRules": ["仅允许 active|suspended|terminated"]
     }'
   ```
3. 根据响应 `files` 列表将生成的代码移入业务包并补充业务逻辑。

## 步骤三：实现领域逻辑

- 在聚合根构造函数中调用 `ensureValidState()`，通过 `DomainGuards` 校验多租户上下文与不变式。  
- 使用 `markDeleted()` 与 `restore()` 控制软删除，确保事件与审计记录同步更新。  
- 在聚合行为方法中调用 `addDomainEvent()` 推送事件；应用层保存聚合后须调用 `pullDomainEvents()`。

## 步骤四：编写测试

1. **单元测试**：使用 `@hl8/domain-testing` 提供的 `AggregateTestHarness` 构建聚合实例，验证不变式、事件发布、软删除幂等性。
2. **契约测试**：将生成的事件载荷与 `contracts/domain-base.openapi.yaml` 对照，确保字段一致。
3. **覆盖率目标**：聚合单元测试覆盖率 ≥ 95%，领域服务 ≥ 90%，公共 API 全量覆盖。使用 `pnpm --filter @hl8/domain-base test:cov` 校验并生成报告。
4. **测试基座**：优先复用 `@hl8/domain-testing` 提供的 `AggregateTestHarness`，减少重复样板。

## 步骤五：文档与评审

- 为所有公共类、方法、值对象编写中文 TSDoc，明确业务语义、前置条件、异常。  
- 在领域设计文档中记录聚合边界、仓储过滤规则与事件流，并引用 `@hl8/domain-base` 使用方式。  
- 通过架构评审验证多租户隔离、审计策略与事件契约，确认无章程违规后方可进入开发阶段。

## 常见问题

- **是否可以绕过脚手架直接编写聚合？** 可以，但必须满足同等的租户断言与审计字段要求，并补充测试与文档。  
- **如何扩展守卫或审计结构？** 先在 `@hl8/domain-base` 内新增值对象或守卫，再在业务模块复用，确保全局一致性。  
- **领域事件需要包含哪些上下文？** 至少包含 `tenantId` 与 `triggeredBy`，若涉及组织/部门需一并提供，避免后续事件消费缺失隔离信息。

