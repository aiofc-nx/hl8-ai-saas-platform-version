import {
  bootstrapFastifyApplication,
  createFastifyApplication,
} from "@hl8/bootstrap";
import { Logger } from "@hl8/logger";
import { AppModule } from "./app.module.js";
import { AppConfig } from "./config/app.config.js";

/**
 * @description 应用启动入口：创建应用、初始化 Swagger 并执行引导流程
 * @returns Promise<void>
 * @throws Error 当启动过程中出现不可恢复异常时抛出
 * @example
 * ```typescript
 * await main();
 * ```
 */
const main = async (): Promise<void> => {
  try {
    console.log("[Main] 开始初始化应用...");
    const { app, config } = await createFastifyApplication({
      module: AppModule,
      appConfigToken: AppConfig,
      loggerToken: Logger,
      loggerChildContext: { module: "Bootstrap" },
    });

    if (!config) {
      throw new Error("[Main] 未能加载应用配置 AppConfig，无法继续启动");
    }

    console.log("[Main] 配置 Swagger API 文档...");

    console.log("[Main] 启动应用...");
    await bootstrapFastifyApplication(app, {
      config,
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
                name: "JWT",
                description: "请输入有效的 JWT Token",
                in: "header",
              },
              "JWT-auth",
            )
            .addTag("健康检查", "系统健康状态与性能指标")
            .addTag("认证", "用户认证与授权接口")
            .addTag("用户管理", "用户 CRUD 操作")
            .addTag("租户管理", "租户配置与管理")
            .addTag("组织管理", "组织架构相关接口"),
        documentOptions: {
          operationIdFactory: (controllerKey: string, methodKey: string) =>
            `${controllerKey}_${methodKey}`,
        },
        setupOptions: {
          customSiteTitle: "HL8 SAAS Platform API 文档",
          customfavIcon: "/favicon.ico",
          customCss: `
            .swagger-ui .topbar { display: none }
            .swagger-ui .info .title { color: #1890ff; }
          `,
          swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
            tryItOutEnabled: true,
          },
        },
        onDocumentCreated: () => {
          console.log("📚 Swagger documentation is available at:");
          console.log(
            `   📖 UI: http://${config.HOST}:${config.PORT}/${config.swagger.swaggerPath}`,
          );
          console.log(
            `   📄 JSON: http://${config.HOST}:${config.PORT}/${config.swagger.swaggerPath}-json`,
          );
        },
      },
    });
    console.log("[Main] 应用启动完成");
  } catch (error) {
    console.error("[Main] 应用启动过程中发生错误:", error);
    throw error;
  }
};

/**
 * @description 执行应用启动逻辑并捕获顶层异常
 * @returns void
 */
main().catch((error) => {
  console.error("应用启动失败:", error);
  if (error.stack) {
    console.error("错误堆栈:", error.stack);
  }
  if (error.cause) {
    console.error("错误原因:", error.cause);
  }
  process.exit(1);
});
