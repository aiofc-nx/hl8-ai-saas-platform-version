import { IsOptional, IsString } from "class-validator";
import { RedisCommonConfig } from "./redis-common.config.js";

/**
 * @description 单个 Redis 客户端配置，覆盖全局默认值。
 */
export class RedisClientConfig extends RedisCommonConfig {
  /**
   * @description Redis 连接 URL，优先级高于 host/port。
   */
  @IsString()
  @IsOptional()
  url?: string;

  /**
   * @description 命名空间前缀，用于区分不同业务域。
   */
  @IsString()
  @IsOptional()
  namespace?: string;

  /**
   * @description Unix 域套接字路径，与 host/port 互斥。
   */
  @IsString()
  @IsOptional()
  path?: string;

  /**
   * @description 自定义客户端标识符，若为空则沿用 namespace。
   */
  @IsString()
  @IsOptional()
  clientKey?: string;
}
