import { Inject, Injectable } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import { AbstractCacheKeyBuilder } from "./abstract-key.builder.js";
import type { CacheLogger } from "../types/logger.types.js";

/**
 * @description 构建租户配置缓存键的载荷。
 */
export interface TenantConfigKeyPayload {
  /** @description 租户唯一标识 */
  tenantId: string;
  /** @description 配置项标识，默认使用 config */
  configKey?: string;
  /** @description 可选的版本或环境标签 */
  variant?: string;
}

const TENANT_CONFIG_NAMESPACE = "tenant-config";
const DEFAULT_CONFIG_KEY = "config";

/**
 * @description 租户配置缓存键生成器，统一租户数据的命名规则。
 */
@Injectable()
export class TenantConfigKeyBuilder extends AbstractCacheKeyBuilder<TenantConfigKeyPayload> {
  constructor(@Inject(Logger) logger: CacheLogger) {
    super(logger);
  }

  /**
   * @description 返回租户配置缓存的命名空间常量。
   * @returns 命名空间字符串 tenant-config
   */
  protected getNamespace(): string {
    return TENANT_CONFIG_NAMESPACE;
  }

  /**
   * @description 组合租户配置缓存键的核心片段。
   * @param payload 租户配置缓存载荷
   * @returns 包含租户 ID、配置键与可选变种标签的片段数组
   */
  protected getKeyParts(
    payload: TenantConfigKeyPayload,
  ): Array<string | number> {
    const segments: Array<string | number> = [payload.tenantId];

    segments.push(payload.configKey ?? DEFAULT_CONFIG_KEY);

    if (payload.variant) {
      segments.push(payload.variant);
    }

    return segments;
  }
}
