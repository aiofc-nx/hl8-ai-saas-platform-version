import { ValidationPipe } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { setupSwagger } from "@hl8/swagger";
import type { FastifyBootstrapConfig } from "./fastify-bootstrap.types.js";
import type {
  BootstrapFastifyApplicationOptions,
  BootstrapSwaggerOptions,
} from "./fastify-bootstrap.types.js";
import { callOrUndefinedIfException } from "../utils/call-or-undefined-if-exception.js";

/**
 * @description 启动 Fastify 应用，统一处理 CORS、验证管道与监听逻辑
 * @typeParam TConfig 应用配置类型
 * @param app NestFastifyApplication 实例
 * @param options 启动参数
 * @returns Promise<void>
 * @throws Error 当 Fastify listen 失败时抛出底层异常
 * @example
 * ```typescript
 * await bootstrapFastifyApplication(app, { config });
 * ```
 */
export async function bootstrapFastifyApplication<
  TConfig extends FastifyBootstrapConfig,
>(
  app: NestFastifyApplication,
  options: BootstrapFastifyApplicationOptions<TConfig>,
): Promise<void> {
  const {
    config,
    corsOptions,
    validationPipeOptions = {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    },
    bannerPrinter = printStartupBanner,
    onAfterListen,
  } = options;

  configureCors(app, corsOptions);
  configureGlobalPipes(app, validationPipeOptions);

  callOrUndefinedIfException(() =>
    configureSwaggerIntegration(app, options.swagger),
  );

  await app.listen(config.PORT, config.HOST);

  callOrUndefinedIfException(() =>
    app.getHttpAdapter().getInstance()?.ready?.(),
  );

  if (onAfterListen) {
    await onAfterListen(app, config);
  }

  bannerPrinter(config);
}

/**
 * @description 根据传入配置启用 CORS，若未提供则回退至允许凭证的通配策略
 * @param app Fastify 适配的 Nest 应用实例
 * @param corsOptions 自定义 CORS 配置
 * @returns void
 */
function configureCors(
  app: NestFastifyApplication,
  corsOptions: Parameters<NestFastifyApplication["enableCors"]>[0],
): void {
  if (corsOptions) {
    app.enableCors(corsOptions);
    return;
  }

  app.enableCors({
    origin: true,
    credentials: true,
  });
}

/**
 * @description 自动集成 Swagger 文档，支持根据配置开关与自定义选项
 * @param app Fastify 适配的 Nest 应用实例
 * @param swaggerOptions Swagger 集成配置
 * @returns void
 */
function configureSwaggerIntegration(
  app: NestFastifyApplication,
  swaggerOptions?: BootstrapSwaggerOptions,
): void {
  if (!swaggerOptions) {
    return;
  }

  const { config, ...options } = swaggerOptions;
  setupSwagger(config, app, options);
}

/**
 * @description 按配置注册全局验证管道，统一启用字段白名单与转换策略
 * @param app Fastify 适配的 Nest 应用实例
 * @param validationPipeOptions ValidationPipe 配置项
 * @returns void
 */
function configureGlobalPipes(
  app: NestFastifyApplication,
  validationPipeOptions: ConstructorParameters<typeof ValidationPipe>[0],
): void {
  app.useGlobalPipes(new ValidationPipe(validationPipeOptions));
}

/**
 * @description 在控制台输出应用启动横幅，提供关键访问信息与环境提示
 * @param config Fastify 启动配置
 * @returns void
 */
function printStartupBanner(config: FastifyBootstrapConfig): void {
  const { PORT: port, HOST: host, NODE_ENV: nodeEnv } = config;
  const displayHost = host === "0.0.0.0" ? "localhost" : host;

  console.log("\n" + "=".repeat(70));

  console.log("🚀 HL8 SAAS 平台应用已成功启动");

  console.log("=".repeat(70));

  console.log(`📍 本地访问:      http://${displayHost}:${port}`);

  console.log(`🌐 网络访问:      http://${host}:${port}`);

  console.log(`📚 API 文档:      http://${displayHost}:${port}/api-docs`);

  console.log(`📄 OpenAPI 文档:  http://${displayHost}:${port}/api-docs-json`);

  console.log("=".repeat(70));

  console.log(`✅ 当前环境:      ${nodeEnv}`);

  console.log("⚡ 技术栈:        Fastify + NestJS");

  console.log("=".repeat(70) + "\n");
}
