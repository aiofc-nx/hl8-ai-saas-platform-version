import type { Options } from "@mikro-orm/core";
import { Migrator } from "@mikro-orm/migrations";
import { SeedManager } from "@mikro-orm/seeder";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import type { DatabaseConfig } from "./app.config.js";

/**
 * @description 构建 MikroORM 配置，兼容编译后与 TypeScript 模式
 * @param database - 数据库配置对象
 * @param overrides - 额外覆盖项
 * @returns MikroORM Options
 */
export const buildMikroOrmOptions = (
  database: DatabaseConfig,
  overrides: Partial<Options<PostgreSqlDriver>> = {},
): Options<PostgreSqlDriver> => {
  const base: Options<PostgreSqlDriver> = {
    driver: PostgreSqlDriver,
    host: database.host,
    port: database.port,
    user: database.user,
    password: database.password,
    dbName: database.dbName,
    schema: database.schema,
    debug: database.debug ?? process.env.NODE_ENV !== "production",
    entities: [database.entities.glob],
    entitiesTs: [database.entities.tsGlob],
    migrations: {
      tableName: database.migrations.tableName,
      path: database.migrations.path,
      pathTs: database.migrations.pathTs,
      glob: database.migrations.glob,
    },
    seeder: {
      path: database.seeder.path,
      pathTs: database.seeder.pathTs,
      glob: database.seeder.glob,
      defaultSeeder: database.seeder.defaultSeeder,
      emit: database.seeder.emit,
      fileName: (className: string) =>
        database.seeder.fileNamePattern.replace(
          "[name]",
          className.toLowerCase(),
        ),
    },
    extensions: [Migrator, SeedManager],
  };

  return {
    ...base,
    ...overrides,
  };
};
