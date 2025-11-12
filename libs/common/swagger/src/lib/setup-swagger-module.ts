import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  SwaggerModule,
  type SwaggerCustomOptions,
  type SwaggerDocumentOptions,
} from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";

import { SwaggerConfig } from "./config/swagger-config.js";

/**
 * @description Swagger 初始化时的自定义可选项
 */
export interface SetupSwaggerOptions {
  /**
   * @description 应用全局前缀，最终文档路径会自动拼接
   */
  appPrefix?: string;
  /**
   * @description 自定义 DocumentBuilder，便于追加标签、鉴权、许可信息等
   */
  configureBuilder?: (builder: DocumentBuilder, config: SwaggerConfig) => void;
  /**
   * @description Swagger 文档生成时的附加选项，例如 operationIdFactory
   */
  documentOptions?: SwaggerDocumentOptions;
  /**
   * @description Swagger UI 页面设置，可覆盖默认持久化认证等行为
   */
  setupOptions?: SwaggerCustomOptions;
  /**
   * @description 文档创建完成后的回调，便于记录日志或追加处理
   */
  onDocumentCreated?: (document: OpenAPIObject) => void;
}

/**
 * @description 按照配置启用 Swagger 文档，并返回生成的 OpenAPI 文档对象
 * @param config Swagger 配置对象
 * @param app Nest 应用实例
 * @param options Swagger 自定义配置选项
 * @returns 如果启用则返回 Swagger 文档，否则返回 undefined
 * @throws 无显式抛出异常
 * @example
 * ```typescript
 * const document = setupSwagger(swaggerConfig, app, {
 *   appPrefix: "api",
 *   configureBuilder: (builder) => builder.addTag("Auth", "认证接口"),
 * });
 * ```
 */
export function setupSwagger(
  config: SwaggerConfig,
  app: INestApplication,
  options?: SetupSwaggerOptions,
): OpenAPIObject | undefined {
  if (!config.enabled) {
    return undefined;
  }

  const builder = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setVersion(config.version)
    .setContact(config.contactName, config.contactUrl, config.contactEmail)
    .addBearerAuth();

  for (const server of config.servers ?? []) {
    builder.addServer(server.url, server.description);
  }

  options?.configureBuilder?.(builder, config);

  const document = SwaggerModule.createDocument(
    app,
    builder.build(),
    options?.documentOptions,
  );

  const swaggerPath = options?.appPrefix
    ? `/${options.appPrefix}/${config.swaggerPath}`.replaceAll("//", "/")
    : config.swaggerPath;

  const setupOptions: SwaggerCustomOptions = options?.setupOptions ?? {
    swaggerOptions: {
      persistAuthorization: true,
    },
  };

  SwaggerModule.setup(swaggerPath, app, document, setupOptions);

  if (options?.onDocumentCreated) {
    options.onDocumentCreated(document);
  }

  return document;
}
