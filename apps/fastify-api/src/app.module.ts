import { PinoLoggingModule } from "@hl8/logger";
import { TypedConfigModule, dotenvLoader, directoryLoader } from "@hl8/config";
import { Module, type DynamicModule } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import {
  TenantAwareSubscriber,
  TenantContextModule,
  TenantEnforceInterceptor,
} from "@hl8/multi-tenancy";
import { MikroOrmModule } from "@hl8/mikro-orm-nestjs";
import { lookup } from "node:dns/promises";
import * as path from "path";
import { AppController } from "./app.controller.js";
import { AppConfig } from "./config/app.config.js";
import { TenantEntity } from "./entities/tenant.entity.js";
import { buildMikroOrmOptions } from "./config/mikro-orm.config.js";

/**
 * @description 尝试解析数据库主机名，无法解析时回退到本地地址
 */
const resolveDatabaseHost = async (host: string): Promise<string> => {
  try {
    await lookup(host);
    return host;
  } catch {
    return "127.0.0.1";
  }
};

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
    TenantContextModule.register(),
    MikroOrmModule.forRootAsync({
      contextName: "postgres",
      useFactory: async (config: AppConfig) => {
        const { database } = config;
        const host = await resolveDatabaseHost(database.host ?? "localhost");
        const {
          entities: _entities,
          entitiesTs: _entitiesTs,
          ...options
        } = buildMikroOrmOptions(database);
        return {
          ...options,
          host,
          entities: [TenantEntity],
        };
      },
      inject: [AppConfig],
    }) as unknown as DynamicModule,
    MikroOrmModule.forFeature([TenantEntity], "postgres"),
    // TODO: 接入租户配置、缓存、用户、认证等业务模块（待实现）
  ],
  controllers: [AppController],
  providers: [
    /**
     * @description 多租户强制拦截器 - 单例注册，供全局拦截链与其他模块复用
     */
    TenantEnforceInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: TenantEnforceInterceptor,
    },
    /**
     * @description 多租户感知的持久层订阅器，确保实体持久化过程中附带租户上下文
     */
    TenantAwareSubscriber,
  ],
})
export class AppModule {}
