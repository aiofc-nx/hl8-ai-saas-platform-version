import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";
import { DEFAULT_CACHE_KEY_SEPARATOR } from "../constants/cache-defaults.js";

/**
 * @description 缓存命名空间淘汰策略枚举，定义写路径默认行为。
 */
export enum CacheEvictionPolicy {
  DoubleDelete = "double-delete",
  Refresh = "refresh",
  TtlOnly = "ttl-only",
}

/**
 * @description 缓存命名空间策略配置，描述业务域键前缀、TTL 与失效行为。
 */
export class CacheNamespacePolicyConfig {
  /**
   * @description 业务域标识，必须唯一且满足命名规范。
   */
  @IsString()
  @Matches(/^[a-z]+[a-z0-9-]*$/u, {
    message: "域标识只能包含小写字母、数字和短横线",
  })
  domain!: string;

  /**
   * @description 键前缀，构成命名空间的首段。
   */
  @IsString()
  @Matches(/^[a-zA-Z0-9-_]+$/u, {
    message: "键前缀只能包含字母、数字、短横线和下划线",
  })
  keyPrefix!: string;

  /**
   * @description 可选的键后缀，用于区分配置版本。
   */
  @IsOptional()
  @IsString()
  keySuffix?: string | null;

  /**
   * @description 缓存键分隔符，默认使用冒号。
   */
  @IsString()
  @IsOptional()
  separator: string = DEFAULT_CACHE_KEY_SEPARATOR;

  /**
   * @description 默认缓存 TTL（秒），必须为正整数。
   */
  @IsInt({ message: "默认缓存 TTL 必须是整数" })
  @Min(1, { message: "默认缓存 TTL 至少为 1 秒" })
  defaultTTL!: number;

  /**
   * @description 失效策略类型，控制写路径一致性方式。
   */
  @IsEnum(CacheEvictionPolicy)
  evictionPolicy!: CacheEvictionPolicy;

  /**
   * @description 命中率告警阈值，可选，范围 0-1。
   */
  @IsOptional()
  @IsNumber({}, { message: "命中率阈值必须是数字" })
  @Min(0, { message: "命中率阈值不能小于 0" })
  @Max(1, { message: "命中率阈值不能超过 1" })
  hitThresholdAlert?: number | null;
}
