# 请求 ID 生成与传播机制说明

## 背景

- 平台基于 `@nestjs/platform-fastify` 启动 HTTP 服务，所有应用均通过 `createFastifyApplication` 构建实例。
- 需要确保链路追踪、日志、异常响应中的请求标识一致且可控。

## 生成策略

系统默认在构建 Fastify 适配器时注入自定义 `genReqId`，逻辑如下：

```33:56:libs/infra/bootstrap/src/lib/fastify/fastify-adapter.factory.ts
const headerName = requestIdHeader ?? "x-request-id";
const resolvedGenReqId =
  options.genReqId ??
  ((req) =>
    (req.headers?.[headerName] as string | undefined) ?? randomUUID());

return new FastifyAdapter({
  logger: /* 省略无关配置 */,
  genReqId: resolvedGenReqId,
  trustProxy,
  bodyLimit,
});
```

- 优先复用上游反向代理或客户端传入的 `X-Request-Id`。
- 若请求头缺失，则现场生成 `UUID` 并写入 Fastify `request.id`。
- 所有服务默认启用上述工厂方法，除非在 `CreateFastifyApplicationOptions` 中显式传入自定义 `adapter`。

## 传递与消费

### 日志

- `@hl8/logger` 使用 Fastify 内置 Pino，借助 `ContextStorage` 获取 `requestId` 并附加到每条日志。
- 通过 AsyncLocalStorage 保证异步调用链中的请求上下文自动传播。

### 异常响应

- 异常过滤器借助 `resolveRequestId` 提取同一个标识：

```12:31:libs/infra/exceptions/src/lib/utils/request-id.util.ts
const candidate =
  request?.requestId ?? request?.id ?? request?.headers?.["x-request-id"];
if (typeof candidate === "string") {
  return candidate;
}
// 若仍为空则生成新的 UUID
return randomUUID();
```

- 异常响应体中的 `instance` 字段始终与请求 ID 保持一致。

### 业务代码

- 业务模块如需下游事件或任务的统一追踪，可直接读取 `request.id` 或注入日志上下文。
- 例如：`cache-consistency.controller` 使用 `randomUUID()` 生成业务级别的独立标识，不影响全局请求 ID。

## 自定义方式

- **自定义请求头名**：在 `createFastifyApplication` 调用中传入 `adapterOptions.requestIdHeader`。
- **自定义生成器**：在 `adapterOptions` 中提供 `genReqId`，可与 Zipkin、SkyWalking 等链路追踪系统对接。
- **全局一致性**：建议在公共工厂内部修改，避免各应用分散配置。

## 常见问题

- **为何不用 Fastify 默认递增 ID？**  
  递增数字在多实例部署下不具备全局唯一性，也难以与上游代理 ID 对齐。

- **如何在测试中断言？**  
  可断言响应体或日志上下文包含 `requestId` 字段。集成测试示例位于 `apps/fastify-api/test/integration/cache/cache-consistency.controller.spec.ts`。

- **请求头与随机 UUID 会冲突吗？**  
  如果客户端提供 `X-Request-Id`，系统始终保留该值，不会覆盖。
