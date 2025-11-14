/**
 * @fileoverview 缓存模块
 * @description 集成 @hl8/cache 提供缓存管理，支持缓存读取、写入、失效等功能
 *
 * ## 业务规则
 *
 * ### 缓存管理规则
 * - 使用 @hl8/cache 提供的缓存服务
 * - 支持 Redis 缓存和内存缓存
 * - 支持缓存 TTL 设置
 * - 支持缓存失效策略
 *
 * ### 缓存使用规则
 * - 支持缓存读取、写入、删除等操作
 * - 支持缓存命名空间管理
 * - 支持缓存一致性保证
 * - 支持缓存降级策略
 *
 * ### 缓存降级规则
 * - 当缓存不可用时降级到直接查询
 * - 缓存降级不影响业务功能
 * - 缓存降级时记录日志
 */

import { CacheInfrastructureModule } from "@hl8/cache";
import { Global, Module } from "@nestjs/common";

/**
 * @description 缓存模块
 * @remarks 注册缓存服务为全局模块，支持依赖注入
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [CacheModule],
 * })
 * export class AppModule {}
 *
 * // 使用缓存服务
 * @Injectable()
 * export class MyService {
 *   constructor(
 *     private readonly cacheReadService: CacheReadService,
 *     private readonly cacheNamespaceService: CacheNamespaceService,
 *   ) {}
 *
 *   async getData(key: string) {
 *     return this.cacheReadService.get(key);
 *   }
 * }
 * ```
 */
@Global()
@Module({
  imports: [CacheInfrastructureModule],
  exports: [CacheInfrastructureModule],
})
export class CacheModule {}
