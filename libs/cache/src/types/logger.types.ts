import { Logger } from "@hl8/logger";

/**
 * @description 缓存模块默认使用的日志实例类型，指向 PinoLoggerService 实例。
 */
export type CacheLogger = InstanceType<typeof Logger>;

/**
 * @description 支持创建子日志器的扩展接口，兼容 child() 工厂的存在。
 */
export type CacheLoggerWithChild = CacheLogger & {
  child?: (context: Record<string, unknown>) => CacheLogger;
};
