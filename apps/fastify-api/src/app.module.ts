import { PinoLoggingModule } from "@hl8/logger";
import { TypedConfigModule, dotenvLoader, directoryLoader } from "@hl8/config";
import { Module } from "@nestjs/common";

import * as path from "path";
import { AppController } from "./app.controller.js";
import { AppConfig } from "./config/app.config.js";

/**
 * @description HL8 SAAS 平台应用的根模块（精简版）
 * @remarks 当前仅保留配置、日志、多租户拦截器等基础能力。
 * 后续业务模块（租户配置、缓存、用户、认证等）将在功能就绪后逐步接入。
 */
@Module({
  imports: [
    TypedConfigModule.forRoot({
      schema: AppConfig,
      isGlobal: true,
      load: [
        directoryLoader({
          directory: path.join(process.cwd(), "config"),
          include: /\.(json|yml|yaml)$/,
        }),
        dotenvLoader({
          separator: "__",
          envFilePath: ".env",
          ignoreEnvFile: true,
          ignoreEnvVars: false,
          enableExpandVariables: true,
        }),
      ],
    }),
    PinoLoggingModule.forRoot({
      config: {
        level: "info",
        prettyPrint: false,
        timestamp: true,
        enabled: true,
        context: {
          enabled: true,
          includeRequestDetails: true,
          includeUserInfo: false,
        },
        sanitizer: {
          enabled: true,
          sensitiveFields: [
            "password",
            "token",
            "secret",
            "apiKey",
            "api_key",
            "authorization",
            "creditCard",
            "credit_card",
            "ssn",
            "socialSecurityNumber",
          ],
          placeholder: "***",
        },
        performance: {
          enabled: true,
          trackLogWriteTime: true,
        },
        errorHandling: {
          fallbackToConsole: false,
          silentFailures: false,
        },
      },
    }),
    // TODO: 接入租户配置、缓存、用户、认证等业务模块（待实现）
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
