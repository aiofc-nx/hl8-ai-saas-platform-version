import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * @description Redis 通用连接参数配置，定义网络与客户端行为。
 */
export class RedisCommonConfig {
  /**
   * @description 命令超时时间（毫秒），超过即认为失败。
   */
  @IsInt()
  @Min(0)
  commandTimeout: number = 5000;

  /**
   * @description Redis 主机地址，可使用 URL 形式覆盖。
   */
  @IsString()
  @IsOptional()
  host?: string;

  /**
   * @description Redis 端口，默认跟随官方 6379，可根据需求调整。
   */
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(65_535)
  port?: number;

  /**
   * @description Socket 保活时间，0 表示禁用。
   */
  @IsInt()
  @Min(0)
  keepAlive: number = 0;

  /**
   * @description 是否禁用 Nagle 算法，默认启用低延迟。
   */
  @IsBoolean()
  noDelay: boolean = true;

  /**
   * @description 客户端名称，用于排查连接。
   */
  @IsString()
  @IsOptional()
  @MinLength(3)
  connectionName?: string;

  /**
   * @description Redis 用户名，适用于 Redis6 ACL。
   */
  @IsString()
  @IsOptional()
  username?: string;

  /**
   * @description Redis 密码，禁止明文写入代码，需通过配置中心注入。
   */
  @IsString()
  @IsOptional()
  password?: string;

  /**
   * @description 逻辑库编号，默认 0。
   */
  @IsInt()
  @Min(0)
  @Max(15)
  db: number = 0;

  /**
   * @description 是否自动重新订阅频道。
   */
  @IsBoolean()
  autoResubscribe: boolean = true;

  /**
   * @description 是否自动重发未完成命令。
   */
  @IsBoolean()
  autoResendUnfulfilledCommands: boolean = true;

  /**
   * @description 是否启用只读模式。
   */
  @IsBoolean()
  readOnly: boolean = false;

  /**
   * @description 是否将数值以字符串形式返回。
   */
  @IsBoolean()
  stringNumbers: boolean = false;

  /**
   * @description 初始化连接超时时间（毫秒）。
   */
  @IsInt()
  @Min(0)
  connectTimeout: number = 10_000;

  /**
   * @description 是否启用监控模式。
   */
  @IsBoolean()
  monitor: boolean = false;

  /**
   * @description 每个命令最大重试次数，null 表示无限等待。
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxRetriesPerRequest: number | null = 20;

  /**
   * @description 最大加载重试时间（毫秒）。
   */
  @IsInt()
  @Min(0)
  maxLoadingRetryTime: number = 10_000;

  /**
   * @description 是否启用自动管道，提升吞吐。
   */
  @IsBoolean()
  enableAutoPipelining: boolean = false;

  /**
   * @description 自动管道忽略命令列表。
   */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  autoPipeliningIgnoredCommands?: string[];

  /**
   * @description 是否允许离线队列。
   */
  @IsBoolean()
  enableOfflineQueue: boolean = true;

  /**
   * @description 是否启用 ready 检查。
   */
  @IsBoolean()
  enableReadyCheck: boolean = true;

  /**
   * @description 是否延迟连接，直到首次命令才连接 Redis。
   */
  @IsBoolean()
  lazyConnect: boolean = false;
}
