# @hl8/swagger

面向 NestJS 应用的 Swagger 基础设施库，提供完整的配置模型、文档初始化函数与扩展点，帮助团队在保持统一标准的前提下快速启用 API 文档。

## 功能特性

- `SwaggerConfig`：基于 `class-validator` 的配置模型，保障运行时校验与类型安全
- `SwaggerServer`：服务节点配置，支持多环境文档入口定义
- `setupSwagger`：封装 `SwaggerModule` 初始化流程，可插入自定义构建逻辑
- `SetupSwaggerOptions`：开放式扩展点，覆盖文档前缀、Builder 定制、Swagger UI 配置等

## 安装

```bash
pnpm add @hl8/swagger
```

> 注：在 monorepo 中该包通常以 `workspace:*` 形式被引用，确保与基础设施版本一致。

## 快速开始

```typescript
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { setupSwagger, SwaggerConfig, SetupSwaggerOptions } from "@hl8/swagger";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = new SwaggerConfig();
  config.enabled = true;
  config.title = "Demo API";
  config.description = "示例服务接口文档";
  config.version = "1.0.0";
  config.contactName = "Demo Team";
  config.contactEmail = "demo@example.com";
  config.contactUrl = "https://example.com";
  config.swaggerPath = "api-docs";

  setupSwagger(config, app);
  await app.listen(3000);
}

bootstrap();
```

## 与 `@hl8/bootstrap` 集成

在基础设施层，该库已与 `bootstrapFastifyApplication` 对接，可通过 `swagger` 选项输入配置。

```typescript
await bootstrapFastifyApplication(app, {
  config,
  swagger: {
    config: config.swagger,
    configureBuilder: (builder) => builder.addTag("健康检查", "系统健康监控").addBearerAuth(),
    documentOptions: {
      operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
    },
    setupOptions: {
      swaggerOptions: {
        persistAuthorization: true,
      },
    },
  },
});
```

## API 说明

### `SwaggerConfig`

- 通过 `class-validator` 装饰器约束字段类型
- 支持 `enabled` 字段的字符串、数字布尔化转换
- `servers` 字段可配置多个 `SwaggerServer` 实例供 UI 展示

```typescript
const server = new SwaggerServer();
server.url = "https://api.example.com";
server.description = "Production";

config.servers = [server];
```

### `setupSwagger(config, app, options)`

- `config`：`SwaggerConfig` 实例
- `app`：`INestApplication`
- `options`：`SetupSwaggerOptions`
  - `appPrefix`：应用全局前缀，自动拼接文档路径
  - `configureBuilder`：接入自定义 `DocumentBuilder` 修改
  - `documentOptions`：传递给 `SwaggerModule.createDocument` 的附加参数
  - `setupOptions`：传递给 `SwaggerModule.setup` 的 UI 配置
  - `onDocumentCreated`：文档生成后的回调，可用于日志记录

## 最佳实践

- 配置模型建议由应用层组合、设定默认值，再传入基础设施层执行
- 当多个应用需要相同的 Swagger 定制时，可在 `libs/infra/swagger` 内新增封装函数或预设
- `setupSwagger` 默认开启 Bearer Auth，若需禁用可通过 `configureBuilder` 移除
- 针对生产环境限制文档访问，建议结合 `config.enabled` 与应用环境变量控制

## 版本与兼容性

- Node.js ≥ 20
- NestJS ≥ 11
- 依赖 `@nestjs/swagger`、`class-validator`、`class-transformer`

## 贡献指南

- 所有公共 API 必须添加中文 TSDoc 注释，并与实现保持同步
- 如需新增配置字段，务必补充验证规则与示例
- 更新完成后请执行 `pnpm --filter @hl8/swagger lint` 与 `pnpm --filter @hl8/swagger test`
