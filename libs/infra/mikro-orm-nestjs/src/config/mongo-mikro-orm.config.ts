import { defineConfig } from "@mikro-orm/mongodb";
import type { Options } from "@mikro-orm/core";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { BaseMikroOrmConfig } from "./base-mikro-orm.config.js";

/**
 * @description MongoDB 上下文配置
 */
export class MongoMikroOrmConfig extends BaseMikroOrmConfig {
  constructor() {
    super();
    this.contextName = "mongo";
  }

  /**
   * @description MongoDB 连接字符串
   */
  @IsString()
  uri: string = "mongodb://127.0.0.1:27017/hl8-platform";

  /**
   * @description 默认数据库名称
   */
  @IsString()
  dbName: string = "hl8-platform";

  /**
   * @description 是否开启调试日志
   */
  @IsBoolean()
  debug: boolean = false;

  /**
   * @description 是否启用 retryWrites
   */
  @IsBoolean()
  retryWrites: boolean = true;

  /**
   * @description 连接池最大连接数
   */
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  maxPoolSize: number = 50;

  /**
   * @description 自定义读取偏好，例如 primary、primaryPreferred 等
   */
  @IsOptional()
  @IsString()
  readPreference?: string;

  /**
   * @description 构建 MongoDB MikroORM 配置
   * @returns Options
   */
  protected override buildOrmOptions(): Options {
    const config = defineConfig({
      contextName: this.contextName,
      clientUrl: this.uri,
      dbName: this.dbName,
      debug: this.debug,
      allowGlobalContext: false,
    });

    config.driverOptions = {
      ...(config.driverOptions ?? {}),
      maxPoolSize: this.maxPoolSize,
      retryWrites: this.retryWrites,
      ...(this.readPreference ? { readPreference: this.readPreference } : {}),
    };

    return config as unknown as Options;
  }
}
