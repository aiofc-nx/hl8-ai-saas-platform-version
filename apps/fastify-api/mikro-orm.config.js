import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Migrator } from "@mikro-orm/migrations";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { SeedManager } from "@mikro-orm/seeder";

/**
 * @description 读取并解析应用配置文件
 * @returns config/default.json 的 JSON 对象
 * @throws Error 当配置文件不存在或解析失败时抛出
 */
function loadRawConfig() {
  const configPath = resolve(process.cwd(), "config", "default.json");
  const rawContent = readFileSync(configPath, "utf-8");
  return JSON.parse(rawContent);
}

/**
 * @description 构建供 MikroORM CLI 使用的配置对象
 */
const rawConfig = loadRawConfig();
const database = rawConfig.database ?? {};
const entities = database.entities ?? {};
const migrations = database.migrations ?? {};
const seeder = database.seeder ?? {};

const mikroOrmConfig = {
  driver: PostgreSqlDriver,
  host: database.host,
  port: database.port,
  user: database.user,
  password: database.password,
  dbName: database.dbName,
  schema: database.schema,
  debug:
    database.debug ??
    (typeof process.env.NODE_ENV === "string"
      ? process.env.NODE_ENV !== "production"
      : false),
  registerRequestContext: database.registerRequestContext ?? true,
  autoLoadEntities: database.autoLoadEntities ?? true,
  entities: [entities.glob ?? "./dist/entities/**/*.js"],
  migrations: {
    tableName: migrations.tableName ?? "mikro_orm_migrations",
    path: migrations.path ?? "./dist/database/migrations",
    pathTs: migrations.pathTs ?? "./src/database/migrations",
    glob: migrations.glob ?? "!(*.d).{js,ts}",
  },
  seeder: {
    path: seeder.path ?? "./dist/database/seeders",
    pathTs: seeder.pathTs ?? "./src/database/seeders",
    glob: seeder.glob ?? "!(*.d).{js,ts}",
    defaultSeeder: seeder.defaultSeeder ?? "DatabaseSeeder",
    emit: seeder.emit ?? "ts",
    fileName: (className) =>
      (seeder.fileNamePattern ?? "[name].seeder").replace(
        "[name]",
        String(className).toLowerCase(),
      ),
  },
  extensions: [Migrator, SeedManager],
};

export default mikroOrmConfig;
