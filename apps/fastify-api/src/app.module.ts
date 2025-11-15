import { PinoLoggingModule } from "@hl8/logger";
import { TypedConfigModule, dotenvLoader, directoryLoader } from "@hl8/config";
import { Module } from "@nestjs/common";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { SeedManager } from "@mikro-orm/seeder";
import { MikroOrmModule } from "@hl8/mikro-orm-nestjs";
import type { MikroOrmModuleOptions } from "@hl8/mikro-orm-nestjs";

import * as fs from "node:fs";
import * as path from "path";
import { AppController } from "./app.controller.js";
import {
  AppConfig,
  DatabaseEntitiesConfig,
  DatabaseMigrationsConfig,
  DatabaseSeederConfig,
} from "./config/app.config.js";

/**
 * @description 构建 MikroORM 配置选项
 * @param config - 应用配置对象
 * @returns MikroORM 模块配置选项
 * @throws Error 当数据库配置缺失时抛出
 */
function buildMikroOrmOptions(
  config: AppConfig,
): MikroOrmModuleOptions<PostgreSqlDriver> {
  const dbConfig = config.database;

  if (!dbConfig) {
    throw new Error(
      "数据库配置缺失，请在配置文件或环境变量中提供 database 配置",
    );
  }

  // 由于 class-transformer 在处理嵌套对象时可能未正确填充值，
  // 需要直接从配置文件读取作为后备方案
  const getValueFromConfig = <T>(key: string): T | undefined => {
    // 方法1: 尝试从转换后的对象获取
    const dbConfigObj = dbConfig as Record<string, unknown>;
    if (dbConfigObj[key] !== undefined && dbConfigObj[key] !== null) {
      return dbConfigObj[key] as T;
    }

    // 方法2: 直接从配置文件读取（作为后备方案，解决 class-transformer 嵌套对象填充问题）
    try {
      const configPath = path.join(process.cwd(), "config", "default.json");
      if (fs.existsSync(configPath)) {
        const rawConfig = JSON.parse(
          fs.readFileSync(configPath, "utf-8"),
        ) as Record<string, unknown>;
        const value = (rawConfig.database as Record<string, unknown>)?.[key];
        if (value !== undefined && value !== null) {
          return value as T;
        }
      }
    } catch {
      // 忽略读取失败，继续使用其他方法
    }

    return undefined;
  };

  const dbName = getValueFromConfig<string>("dbName");
  if (!dbName) {
    throw new Error(
      "数据库名称 (dbName) 缺失，请在配置文件或环境变量中提供 database.dbName",
    );
  }

  return {
    driver: PostgreSqlDriver,
    host: getValueFromConfig<string>("host") ?? "localhost",
    port: getValueFromConfig<number>("port") ?? 5432,
    user: getValueFromConfig<string>("user"),
    password: getValueFromConfig<string>("password"),
    dbName,
    schema: getValueFromConfig<string>("schema") ?? "public",
    debug: getValueFromConfig<boolean>("debug") ?? false,
    registerRequestContext:
      getValueFromConfig<boolean>("registerRequestContext") ?? true,
    autoLoadEntities: getValueFromConfig<boolean>("autoLoadEntities") ?? true,
    entities: getValueFromConfig<DatabaseEntitiesConfig>("entities")?.glob
      ? [getValueFromConfig<DatabaseEntitiesConfig>("entities")!.glob!]
      : ["./dist/entities/**/*.js"],
    entitiesTs: getValueFromConfig<DatabaseEntitiesConfig>("entities")?.tsGlob
      ? [getValueFromConfig<DatabaseEntitiesConfig>("entities")!.tsGlob!]
      : ["./src/entities/**/*.ts"],
    migrations: {
      tableName:
        getValueFromConfig<DatabaseMigrationsConfig>("migrations")?.tableName ??
        "mikro_orm_migrations",
      path:
        getValueFromConfig<DatabaseMigrationsConfig>("migrations")?.path ??
        "./dist/database/migrations",
      pathTs:
        getValueFromConfig<DatabaseMigrationsConfig>("migrations")?.pathTs ??
        "./src/database/migrations",
      glob:
        getValueFromConfig<DatabaseMigrationsConfig>("migrations")?.glob ??
        "!(*.d).{js,ts}",
    },
    seeder: {
      path:
        getValueFromConfig<DatabaseSeederConfig>("seeder")?.path ??
        "./dist/database/seeders",
      pathTs:
        getValueFromConfig<DatabaseSeederConfig>("seeder")?.pathTs ??
        "./src/database/seeders",
      glob:
        getValueFromConfig<DatabaseSeederConfig>("seeder")?.glob ??
        "!(*.d).{js,ts}",
      defaultSeeder:
        getValueFromConfig<DatabaseSeederConfig>("seeder")?.defaultSeeder ??
        "DatabaseSeeder",
      emit:
        (getValueFromConfig<DatabaseSeederConfig>("seeder")?.emit as
          | "ts"
          | "js") ?? "ts",
      fileName: getValueFromConfig<DatabaseSeederConfig>("seeder")
        ?.fileNamePattern
        ? (className: string) =>
            getValueFromConfig<DatabaseSeederConfig>(
              "seeder",
            )!.fileNamePattern!.replace(
              "[name]",
              String(className).toLowerCase(),
            )
        : (className: string) => `${String(className).toLowerCase()}.seeder`,
    },
    extensions: [Migrator, SeedManager],
  };
}

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
    // MikroORM 数据库模块
    MikroOrmModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => buildMikroOrmOptions(config),
    }),
    // MikroORM 请求上下文中间件
    MikroOrmModule.forMiddleware({
      forRoutesPath: "(.*)",
    }),
    // TODO: 接入租户配置、缓存、用户、认证等业务模块（待实现）
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
