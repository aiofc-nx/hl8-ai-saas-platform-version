# XS-@hl8/swagger 使用培训教程

## 课程目标

- 理解 `@hl8/swagger` 在平台中的定位与架构边界
- 掌握从零开始接入 Swagger 文档的完整流程
- 学会通过扩展点（Builder、自定义 UI、回调）实现项目级定制
- 构建排错思路，快速定位配置与运行时问题

## 前置要求

- 熟悉 NestJS 基础用法，了解模块化结构与依赖注入
- 已完成 `pnpm install` 并具备运行 monorepo 的基础环境
- 对 `@hl8/bootstrap` 引导流程有基础认识（了解 `createFastifyApplication` 与 `bootstrapFastifyApplication`）

## 课程大纲

1. `@hl8/swagger` 模块概览
2. 环境准备与依赖安装
3. 配置建模：`SwaggerConfig` 与 `SwaggerServer`
4. 引导集成：在 `bootstrap` 层启用 Swagger
5. 应用层定制：标签、鉴权、UI 外观
6. 高级扩展：多环境、多文档、调试技巧
7. 练习与考核

## 1. 模块概览

`@hl8/swagger` 属于基础设施层库，为所有 NestJS 应用提供统一的 Swagger 启动能力。核心能力包括：

- **配置模型**：`SwaggerConfig` 通过 `class-validator` 保证运行时校验，支持布尔转换、嵌套服务器列表等
- **文档构建**：`setupSwagger` 封装 `SwaggerModule.createDocument/setup` 逻辑，并开放扩展点
- **与引导流程集成**：通过 `@hl8/bootstrap` 的 `swagger` 选项，实现“零散代码 → 模板化”

## 2. 环境准备

```bash
pnpm install
pnpm --filter @hl8/swagger build
```

确保 `libs/infra/swagger/dist` 生成，供其他包引用。若使用新仓库或分支，记得在 `pnpm-workspace.yaml` 中包含 `libs/infra/swagger`。

## 3. 配置建模

### 3.1 定义应用级配置

在应用配置类（例如 `AppConfig`）中组合 `SwaggerConfig`，设定默认值：

```typescript
import { SwaggerConfig as BaseSwaggerConfig, SwaggerServer } from "@hl8/swagger";

export class SwaggerConfig extends BaseSwaggerConfig {
  enabled = true;
  swaggerPath = "api-docs";
  title = "HL8 SAAS Platform API";
  description = "平台接口文档";
  version = "1.0.0";
  contactName = "平台团队";
  contactEmail = "support@hl8.com";
  contactUrl = "https://hl8.com";
  servers = [SwaggerConfig.createServer("http://localhost:3000", "Development"), SwaggerConfig.createServer("https://api.hl8.com", "Production")];
}
```

### 3.2 创建服务器助手

为保证通过 `class-validator` 校验，推荐在配置类内部提供 `createServer` 工具方法（示例在实际代码中已实现）。

## 4. 引导集成

`@hl8/bootstrap` 将 `setupSwagger` 集成到 `bootstrapFastifyApplication`，只需在启动参数中传入 `swagger`：

```typescript
await bootstrapFastifyApplication(app, {
  config,
  swagger: {
    config: config.swagger,
  },
});
```

默认情况下，库会：

- 根据配置决定是否启用文档
- 自动添加 Bearer Auth
- 支持自定义全局前缀（`appPrefix`）
- 持久化授权信息，避免刷新后重登

## 5. 应用层定制

### 5.1 定制 DocumentBuilder

使用 `configureBuilder` 注入项目特定信息：

```typescript
swagger: {
  config: config.swagger,
  configureBuilder: (builder) =>
    builder
      .setLicense("MIT", "https://opensource.org/licenses/MIT")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          in: "header",
        },
        "JWT-auth",
      )
      .addTag("认证", "用户认证接口"),
}
```

### 5.2 定制 Swagger UI

通过 `setupOptions` 控制 UI 行为：

```typescript
swagger: {
  // ...
  setupOptions: {
    customSiteTitle: "HL8 API 文档",
    customfavIcon: "/favicon.ico",
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
  },
}
```

### 5.3 文档生成回调

`onDocumentCreated` 可用于记录日志或输出文档访问地址：

```typescript
swagger: {
  // ...
  onDocumentCreated: () => {
    console.log(`Swagger UI 可访问: http://${config.HOST}:${config.PORT}/${config.swagger.swaggerPath}`);
  },
}
```

## 6. 高级扩展

### 6.1 多 Swagger 文档

如需开启多套文档（公开/私有），可在应用层多次调用 `setupSwagger`，或在 `configureBuilder` 内使用不同的 `server` 配置。

### 6.2 访问控制

- 生产环境通过配置禁用：`config.swagger.enabled = false`
- 或结合 Fastify Hook 增加鉴权中间件

### 6.3 常见问题排查

| 问题表现                          | 排查步骤                                                                   |
| --------------------------------- | -------------------------------------------------------------------------- |
| 启动时报 `SwaggerConfig` 校验失败 | 检查是否使用 `SwaggerServer` 实例；确认字符串布尔配置是否能被转换          |
| 访问 `/api-docs` 返回 404         | 确认 `swaggerPath` 与 `appPrefix` 拼接结果；检查应用启动日志是否提示已启用 |
| 自定义 UI 没生效                  | 确认 `customCss`、`customSiteTitle` 是否传递；检查浏览器缓存               |

## 7. 练习与考核

1. 为一个新建的 NestJS 模块接入 `@hl8/swagger`，确保基础文档可访问
2. 增加自定义标签、全局鉴权描述，并让 UI 隐藏顶部导航
3. 通过环境变量控制 `swagger.enabled`，验证不同环境下的行为
4. 扩展 `onDocumentCreated`，在日志中输出 JSON 文档下载地址

通过以上练习，开发者应能自信地在项目中使用 `@hl8/swagger`，并根据业务需求进行扩展。
