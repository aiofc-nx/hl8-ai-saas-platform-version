# @hl8/mikro-orm-nestjs 使用教程（以 apps/fastify-api 为例）

## 教程目标

- 了解 `@hl8/mikro-orm-nestjs` 的核心能力与适用场景。
- 学会在新服务中快速集成 MikroORM，并完成多租户上下文配置。
- 掌握与平台配置、日志、异常体系的联动方式。

## 前置准备

- Node.js >= 20，pnpm >= 8。
- PostgreSQL 实例（教程使用 `hl8-platform` 数据库，可在本地 docker 启动）。
- 熟悉 NestJS 模块机制与 HL8 仓库宪法（中文注释、TSDoc 要求等）。

## Step 1：安装依赖

工作区已经包含 `@hl8/mikro-orm-nestjs`。如果在独立项目中使用，可按需安装：

```bash
pnpm add @hl8/mikro-orm-nestjs @mikro-orm/core @mikro-orm/postgresql
```

本仓库内无需重复安装，但确保同步执行：

```bash
pnpm install
pnpm --filter @hl8/mikro-orm-nestjs build
```

## Step 2：定义配置与实体

1. **配置类**  
   `apps/fastify-api/src/config/mikro-orm.config.ts` 使用 `BaseMikroOrmConfig` 构建 PostgreSQL 配置，结合 `class-validator` 约束字段：

```20:52:apps/fastify-api/src/config/mikro-orm.config.ts
export const buildMikroOrmOptions = (database: AppConfig["database"]) => {
  const config = new PostgresMikroOrmConfig();
  config.host = database.host ?? "127.0.0.1";
  config.port = database.port;
  config.dbName = database.name;
  config.username = database.username;
  config.password = database.password;
  config.schema = database.schema ?? "public";
  config.debug = database.debug ?? false;
  config.poolMin = database.pool?.min ?? 2;
  config.poolMax = database.pool?.max ?? 10;
  return config.toModuleOptions();
};
```

2. **实体定义**  
   `TenantEntity` 提供示例租户表，并在注释中说明业务语义：

```1:36:apps/fastify-api/src/entities/tenant.entity.ts
@Entity({
  tableName: "tenants",
  comment: "租户主数据表",
})
export class TenantEntity {
  @PrimaryKey({
    type: "uuid",
    columnType: "uuid",
    defaultRaw: "gen_random_uuid()",
    comment: "租户主键（UUID）",
  })
  id!: string;
  // ... existing code ...
}
```

## Step 3：在根模块集成

`AppModule` 通过 `MikroOrmModule.forRootAsync` 和 `forFeature` 注册上下文与实体仓储，同时挂载租户拦截器：

```91:127:apps/fastify-api/src/app.module.ts
@Module({
  imports: [
    TypedConfigModule.forRoot({
      schema: AppConfig,
      isGlobal: true,
      load: [
        directoryLoader({ directory: path.join(process.cwd(), "config"), include: /\.(json|yml|yaml)$/ }),
        dotenvLoader({ separator: "__", envFilePath: ".env", ignoreEnvFile: true, ignoreEnvVars: false, enableExpandVariables: true }),
      ],
    }),
    PinoLoggingModule.forRoot({ config: { level: "info", enabled: true } }),
    TenantContextModule.register(),
    MikroOrmModule.forRootAsync({
      contextName: "postgres",
      useFactory: async (config: AppConfig) => {
        const host = await resolveDatabaseHost(config.database.host ?? "localhost");
        const { entities: _entities, entitiesTs: _entitiesTs, ...options } = buildMikroOrmOptions(config.database);
        return { ...options, host, entities: [TenantEntity] };
      },
      inject: [AppConfig],
    }) as unknown as DynamicModule,
    MikroOrmModule.forFeature([TenantEntity], "postgres"),
  ],
  controllers: [AppController],
  providers: [
    TenantEnforceInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: TenantEnforceInterceptor },
    TenantAwareSubscriber,
  ],
})
export class AppModule {}
```

关键要点：

- `contextName: "postgres"` 与配置类保持一致，保证 Token 唯一。
- `MikroOrmModule.forFeature` 注册实体仓储，供业务服务注入。
- 通过 `resolveDatabaseHost` 辅助函数处理容器环境下 DNS 问题。

## Step 4：启用请求上下文中间件

`@hl8/mikro-orm-nestjs` 默认在 `MikroOrmCoreModule` 中注册 `MikroOrmMiddleware`。如需多上下文场景，可额外引入 `MikroOrmModule.forMiddleware()`：

```ts
MikroOrmModule.forMiddleware({ forRoutesPath: "/api" });
```

在本示例中，默认设置即可覆盖所有路由，每个请求都会创建独立的 `EntityManager`。

## Step 5：运行与验证

1. 启动数据库（示例使用 Docker）：

```bash
docker run --name hl8-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hl8-platform -p 5432:5432 postgres:15
```

2. 启动应用：

```bash
pnpm --filter apps/fastify-api run start
```

3. 打开 Swagger：`http://127.0.0.1:3000/api-docs`，验证租户接口是否可以正常访问（需在请求头 `x-tenant-id` 中传入租户 ID）。

### 5.1 生成实体表/执行迁移

- `MikroOrmModule.forFeature` 只负责在 Nest 容器中注册实体/仓储，不会自动创建数据库表。
- 初次建表或同步最新实体结构时，需要借助 MikroORM CLI 或迁移：

```bash
# 第一次创建数据库对象（脚本会自动先执行 `nest build`，确保 `dist` 中存在已编译实体）
pnpm --filter apps/fastify-api run db:schema:create:run

# 或者使用迁移流程
pnpm --filter apps/fastify-api run db:migration:create
pnpm --filter apps/fastify-api run db:migration:up
```

- 建议在 CI/CD 或部署脚本中统一执行 `migration:up`，保持 schema 版本一致。
- 仅在开发验证时，可临时启用 `ensureDatabase: true` 等选项自动创建数据库，但生产环境仍推荐使用迁移。

## Step 6：编写业务仓储与服务

注入 `TenantEntity` 仓储：

```ts
import { InjectRepository } from "@hl8/mikro-orm-nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(TenantEntity, "postgres")
    private readonly tenantRepository: EntityRepository<TenantEntity>,
  ) {}

  async findAll(): Promise<TenantEntity[]> {
    return this.tenantRepository.findAll();
  }
}
```

确保服务方法遵循 CLS 租户上下文约束，如需跨租户操作，通过 `TenantContextExecutor` 显式切换。

## 常见问题排查

| 问题                           | 解决方案                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `UnknownDependenciesException` | 检查 `contextName` 是否与配置类一致，确保模块已经引入 `MikroOrmModule.forRootAsync`。             |
| 请求上下文未生效               | 确认没有将 `registerRequestContext` 设置为 `false`；或手动注册 `MikroOrmModule.forMiddleware()`。 |
| 数据库连接超时                 | 调整配置类中的 `poolMin`/`poolMax`，确认数据库实例可达。                                          |

## 练习建议

- **任务一**：新增 `TenantSettingsEntity`，并将其通过 `forFeature` 注册与 CRUD 接口开发完成。
- **任务二**：在 `TenantService` 中使用 `TenantContextExecutor` 构建后台任务，模拟跨租户批处理。
- **任务三**：编写单元测试，利用 `MikroOrmModule.forRoot({ registerRequestContext: false })` 搭建轻量内存环境。

## 结语

通过以上步骤，可以快速掌握 `@hl8/mikro-orm-nestjs` 的使用方法。在后续项目中，请始终结合配置模块、日志模块和多租户模块，确保业务实现符合平台标准。遇到问题优先查阅 `libs/infra/mikro-orm-nestjs/README.md` 与该教程，同时欢迎向团队提交改进建议。\*\*\* End Patch
