/**
 * @description 默认缓存键分隔符，统一缓存命名规范。
 */
export const DEFAULT_CACHE_KEY_SEPARATOR = ":";

/**
 * @description 租户配置缓存所属域名称，便于复用常量避免硬编码。
 */
export const TENANT_CONFIG_CACHE_DOMAIN = "tenant-config";

/**
 * @description 租户配置缓存默认 TTL（秒），用于维持热点配置的命中率。
 */
export const TENANT_CONFIG_CACHE_TTL_SECONDS = 300;

/**
 * @description 默认延迟双删等待时间（毫秒）。
 */
export const DEFAULT_DOUBLE_DELETE_DELAY_MS = 100;

/**
 * @description 默认分布式锁持有时间（毫秒）。
 */
export const DEFAULT_REDIS_LOCK_TTL_MS = 1_000;

/**
 * @description 默认的 JSON 序列化策略，将业务对象转为字符串。
 * @param payload 需要缓存的业务对象
 * @returns JSON 字符串
 */
export const serializeToJson = <T>(payload: T): string =>
  JSON.stringify(payload);

/**
 * @description 默认的 JSON 反序列化策略，将字符串还原为业务对象。
 * @param content 缓存中存储的 JSON 字符串
 * @returns 还原后的业务对象
 */
export const deserializeFromJson = <T>(content: string): T =>
  JSON.parse(content) as T;
