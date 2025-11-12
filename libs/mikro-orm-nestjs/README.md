# @hl8/mikro-orm-nestjs

> 基于官方 `@mikro-orm/nestjs` 的本地化改造版，用于在本项目中平替原包，统一多数据源、上下文隔离与仓储注入能力。

## 功能概览

- **多上下文支持**：通过 `contextName` 为每个数据源生成独立的 ORM/EntityManager Provider，保障多租户与多数据库场景。
- **自动仓储注册**：`forFeature` 根据实体元数据自动注入仓储，兼容自定义仓储工厂。
- **请求上下文中间件**：内置 `MikroOrmMiddleware` 与 `MultipleMikroOrmMiddleware`，确保每个请求获取独立的 EntityManager fork。
- **动态配置解析**：支持同步、异步配置与工厂类，自动推断驱动并延迟加载可选依赖。
- **平台日志接入**：内建 `@hl8/logger`，统一 ORM 调试输出与异常追踪。

## 安装与构建

```bash
pnpm --filter @hl8/mikro-orm-nestjs install
pnpm --filter @hl8/mikro-orm-nestjs build
```

> 本包为工作区模块，默认随 monorepo 一同构建，如需单独调试，请进入 `libs/infra/mikro-orm-nestjs` 目录后执行。

## 快速开始

```ts
// app.module.ts
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      contextName: "postgres",
      useFactory: (config: AppConfig) => buildPostgresOptions(config.database),
      inject: [AppConfig],
    }),
    MikroOrmModule.forFeature([TenantEntity], "postgres"),
    MikroOrmModule.forMiddleware({ forRoutesPath: "/api" }),
  ],
})
export class AppModule {}
```

1. **forRoot/forRootAsync**：注册 ORM 实例，可同时传入数组以初始化多套上下文。
2. **forFeature**：在指定上下文下注入实体仓储，并维护实体元数据缓存。
3. **forMiddleware**：自动挂载请求级上下文中间件，默认匹配全部路由。

## 多上下文最佳实践

- 为每个数据源声明唯一 `contextName`（如 `postgres`, `mongo`），避免冲突。
- 通过 `InjectRepository(Entity, "context")` 或 `@InjectEntityManager("context")` 精确解析实例。
- 当需要在同一请求内访问多个数据库时，引入 `MikroOrmMiddlewareModule.forRoot()` 以保证全部上下文均被 RequestScope 覆盖。

## 中间件工作机制

- `MikroOrmMiddleware`：在单上下文场景中，按需解析当前上下文 Provider 并创建请求级 EntityManager。自 2025-11 起，改为惰性从 `ModuleRef` 中解析，以兼容命名上下文。
- `MultipleMikroOrmMiddleware`：聚合 `CONTEXT_NAMES` 中登记的全部 ORM 实例，统一创建多上下文 RequestContext。适用于读写分离或多数据库请求关联。

> 注意：若在 `forRoot` 时将 `registerRequestContext` 设置为 `false`，需手动注册对应中间件，否则请求内的 EntityManager 将共享全局状态。

## 配置建议

- 所有配置均应通过 `@hl8/config` 载入，并结合 `class-validator` 声明校验规则。
- PostgreSQL、MongoDB 等驱动在首次使用时会自动按需加载；保持 `package.json` 中的 peerDependency 与工作区版本一致。
- 若需启用自动实体加载，可在配置中设置 `autoLoadEntities: true`；框架会合并实体元数据并移除该标志位。

## 测试策略

- 单元测试：使用 `MikroOrmModule.forRoot({ registerRequestContext: false })` 配合内存数据库或 `mock` 实现。
- 集成测试：建议通过 `@hl8/bootstrap` 创建 Nest 应用，注入实际数据源，并调用 `MikroOrmModule.clearStorage()` 清理实体缓存。
- 端到端测试：结合 `TestAppFactory` 拉起完整服务，使用专用测试数据库确保隔离。

## 常见问题

| 场景                                          | 说明                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 构造函数注入报 `UnknownDependenciesException` | 确认模块通过 `contextName` 注册后，从注入方使用对应 token（如 `@InjectEntityManager("postgres")`）。 |
| 请求上下文未生效                              | 检查是否禁用了 `registerRequestContext`，或自定义中间件注册顺序导致未执行。                          |
| 多模块重复注册                                | `CONTEXT_NAMES` 会阻止相同 `contextName` 重复注册，出现错误时请排查模块导入链。                      |

## 维护说明

- 变更核心 Provider 或中间件实现时，请同步更新此文档与相关 TSDoc。
- 遵循仓库宪法：注释、异常信息及文档保持中文；公共导出需补全 TSDoc。
- 发布前执行 `pnpm run lint && pnpm run test`，确保类型、格式与测试均通过。

如需更多示例，可查看 `apps/fastify-api` 中的接入代码，或补充 Issue 说明业务场景。欢迎提交 PR 共建。新人在开发前请阅读 `libs/infra/mikro-orm-nestjs/src` 下的实现与单测，掌握 Provider 注册流程。
