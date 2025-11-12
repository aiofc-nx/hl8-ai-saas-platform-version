import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { RedisClientConfig } from "./redis-client.config.js";
import { RedisCommonConfig } from "./redis-common.config.js";
import { RedisLockConfig } from "./redis-lock.config.js";
import { CacheNamespacePolicyConfig } from "./cache-namespace-policy.config.js";

/**
 * @description 缓存总体配置，聚合多客户端与锁配置。
 */
export class CacheConfig {
  /**
   * @description 是否在客户端就绪时输出中文日志。
   */
  @IsBoolean()
  readyLog: boolean = true;

  /**
   * @description 是否在发生错误时输出中文日志。
   */
  @IsBoolean()
  errorLog: boolean = true;

  /**
   * @description 是否强制使用内存缓存占位，跳过真实 Redis 连接（开发或测试环境专用）。
   */
  @IsBoolean()
  @IsOptional()
  useMemoryFallback: boolean = false;

  /**
   * @description 默认客户端键名，未指定时使用数组首个配置。
   */
  @IsString()
  @IsOptional()
  defaultClientKey?: string;

  /**
   * @description 公共配置信息，适用于所有客户端。
   */
  @ValidateNested()
  @Type(() => RedisCommonConfig)
  @IsOptional()
  commonConfig?: RedisCommonConfig;

  /**
   * @description 客户端配置列表，至少包含一个有效项。
   */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RedisClientConfig)
  clients!: RedisClientConfig[];

  /**
   * @description 分布式锁配置，缺省时使用默认值。
   */
  @ValidateNested()
  @Type(() => RedisLockConfig)
  @IsOptional()
  lock?: RedisLockConfig;

  /**
   * @description 命名空间策略配置集合，支持热加载与查询。
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CacheNamespacePolicyConfig)
  namespacePolicies: CacheNamespacePolicyConfig[] = [];
}
