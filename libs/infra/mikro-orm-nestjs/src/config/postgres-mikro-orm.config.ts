import { defineConfig } from "@mikro-orm/postgresql";
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
 * @description PostgreSQL 上下文配置
 */
export class PostgresMikroOrmConfig extends BaseMikroOrmConfig {
  constructor() {
    super();
    this.contextName = "postgres";
  }

  /**
   * @description 数据库主机名
   */
  @IsString()
  host: string = "127.0.0.1";

  /**
   * @description 数据库端口
   */
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  port: number = 5432;

  /**
   * @description 数据库名称
   */
  @IsString()
  dbName: string = "hl8-platform";

  /**
   * @description 用户名
   */
  @IsString()
  username: string = "postgres";

  /**
   * @description 密码
   */
  @IsString()
  password: string = "postgres";

  /**
   * @description 默认 Schema
   */
  @IsString()
  schema: string = "public";

  /**
   * @description 是否开启调试日志
   */
  @IsBoolean()
  debug: boolean = false;

  /**
   * @description 连接池最小连接数
   */
  @IsInt()
  @Min(0)
  @Type(() => Number)
  poolMin: number = 2;

  /**
   * @description 连接池最大连接数
   */
  @IsInt()
  @Min(1)
  @Type(() => Number)
  poolMax: number = 20;

  /**
   * @description 连接超时时长（毫秒）
   */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Type(() => Number)
  connectionTimeoutMs?: number;

  /**
   * @description 生成 MikroORM Options
   * @returns Options
   */
  protected override buildOrmOptions(): Options {
    const config = defineConfig({
      contextName: this.contextName,
      host: this.host,
      port: this.port,
      dbName: this.dbName,
      user: this.username,
      password: this.password,
      schema: this.schema,
      debug: this.debug,
      allowGlobalContext: false,
    });

    config.pool = {
      ...(config.pool ?? {}),
      min: this.poolMin,
      max: this.poolMax,
    };

    if (this.connectionTimeoutMs) {
      config.driverOptions = {
        ...(config.driverOptions ?? {}),
        connection: {
          ...(config.driverOptions?.connection ?? {}),
          connectTimeoutMS: this.connectionTimeoutMs,
        },
      };
    }

    return config as unknown as Options;
  }
}
