/**
 * @fileoverview CASL 权限能力接口
 * @description 定义 CASL 权限能力的接口规范，支持权限规则构建和缓存
 *
 * ## 业务规则
 *
 * ### 权限规则构建规则
 * - 支持基于用户、租户、组织等维度构建权限规则
 * - 支持基于事件流或读模型构建权限规则
 * - 支持权限规则的缓存和失效
 * - 支持多级失效策略（用户、租户、全局）
 *
 * ### 权限缓存规则
 * - 权限缓存键包含租户、用户、组织维度
 * - 用户权限变更时失效该用户的缓存
 * - 租户权限变更时失效该租户所有用户的缓存
 * - 全局权限变更时失效全部缓存
 * - 缓存服务不可用时降级到直接查询
 */

import type { AbilityBuilder, MongoAbility } from "@casl/ability";
import type { RawRuleOf } from "@casl/ability";

/**
 * @description 安全上下文
 * @remarks 定义权限验证的安全上下文
 */
export interface SecurityContext {
  /**
   * @description 用户标识
   * @remarks 用户的唯一标识
   */
  readonly userId: string;

  /**
   * @description 租户标识
   * @remarks 租户的唯一标识，用于多租户隔离
   */
  readonly tenantId: string;

  /**
   * @description 组织标识
   * @remarks 组织的唯一标识，可选
   */
  readonly organizationId?: string;
}

/**
 * @description 权限能力类型
 * @remarks 定义 CASL 权限能力的类型
 */
export type AppAbility = MongoAbility;

/**
 * @description 权限规则类型
 * @remarks 定义 CASL 权限规则的类型
 */
export type AppRule = RawRuleOf<AppAbility>;

/**
 * @description 权限规则构建器
 * @remarks 定义权限规则构建器的函数类型
 *
 * @param can - 允许操作函数
 * @param cannot - 禁止操作函数
 * @param context - 安全上下文
 * @returns Promise<void>
 */
export type AbilityRuleBuilder = (
  can: AbilityBuilder<AppAbility>["can"],
  cannot: AbilityBuilder<AppAbility>["cannot"],
  context: SecurityContext,
) => Promise<void> | void;

/**
 * @description CASL 权限能力服务接口
 * @remarks 定义 CASL 权限能力服务的核心操作，包括权限规则构建
 *
 * @example
 * ```typescript
 * // 注入权限能力服务
 * constructor(private readonly abilityService: CaslAbilityService) {}
 *
 * // 解析用户权限能力
 * const context: SecurityContext = {
 *   userId: 'user-1',
 *   tenantId: 'tenant-1',
 *   organizationId: 'org-1',
 * };
 * const ability = await abilityService.resolveAbility(context);
 * ```
 */
export interface CaslAbilityService {
  /**
   * @description 解析用户权限能力
   * @remarks 根据安全上下文构建用户的权限能力
   *
   * ## 业务规则
   * - 支持基于用户、租户、组织等维度构建权限规则
   * - 支持权限规则的缓存
   * - 支持权限规则的失效
   *
   * @param context - 安全上下文
   * @returns 权限能力
   * @throws {CaslAbilityException} 当权限解析失败时
   *
   * @example
   * ```typescript
   * const context: SecurityContext = {
   *   userId: 'user-1',
   *   tenantId: 'tenant-1',
   *   organizationId: 'org-1',
   * };
   * const ability = await abilityService.resolveAbility(context);
   * ```
   */
  resolveAbility(context: SecurityContext): Promise<AppAbility>;
}

/**
 * @description 权限缓存服务接口
 * @remarks 定义权限缓存服务的核心操作，包括缓存获取、设置和失效
 *
 * @example
 * ```typescript
 * // 注入权限缓存服务
 * constructor(private readonly cacheService: AbilityCacheService) {}
 *
 * // 获取缓存
 * const key = cacheService.buildKey(context);
 * const ability = await cacheService.get(key);
 *
 * // 设置缓存
 * await cacheService.set(key, ability);
 *
 * // 失效缓存
 * await cacheService.invalidate(context, 'user');
 * ```
 */
export interface AbilityCacheService {
  /**
   * @description 构建缓存键
   * @remarks 根据安全上下文构建缓存键
   *
   * ## 业务规则
   * - 缓存键包含租户、用户、组织维度
   * - 缓存键格式：`casl:ability:${userId}:${tenantId}:${organizationId || ''}`
   *
   * @param context - 安全上下文
   * @returns 缓存键
   *
   * @example
   * ```typescript
   * const context: SecurityContext = {
   *   userId: 'user-1',
   *   tenantId: 'tenant-1',
   *   organizationId: 'org-1',
   * };
   * const key = cacheService.buildKey(context);
   * // key = 'casl:ability:user-1:tenant-1:org-1'
   * ```
   */
  buildKey(context: SecurityContext): string;

  /**
   * @description 获取缓存
   * @remarks 根据缓存键获取权限能力
   *
   * ## 业务规则
   * - 缓存服务不可用时降级到直接查询
   * - 缓存服务不可用时仅记录日志而不抛出异常
   *
   * @param key - 缓存键
   * @returns 权限能力或 null
   * @throws {AbilityCacheException} 当缓存服务不可用且无法降级时（通常不会抛出，而是返回 null）
   *
   * @example
   * ```typescript
   * const key = cacheService.buildKey(context);
   * const ability = await cacheService.get(key);
   * ```
   */
  get(key: string): Promise<AppAbility | null>;

  /**
   * @description 设置缓存
   * @remarks 将权限能力缓存到缓存服务
   *
   * ## 业务规则
   * - 缓存服务不可用时仅记录日志而不抛出异常
   * - 缓存服务不可用时不影响权限验证流程
   *
   * @param key - 缓存键
   * @param ability - 权限能力
   * @returns Promise<void>
   * @throws {AbilityCacheException} 当缓存服务不可用且无法降级时（通常不会抛出，而是记录日志）
   *
   * @example
   * ```typescript
   * const key = cacheService.buildKey(context);
   * await cacheService.set(key, ability);
   * ```
   */
  set(key: string, ability: AppAbility): Promise<void>;

  /**
   * @description 失效缓存
   * @remarks 根据安全上下文和失效级别失效缓存
   *
   * ## 业务规则
   * - 用户权限变更时失效该用户的缓存
   * - 租户权限变更时失效该租户所有用户的缓存
   * - 全局权限变更时失效全部缓存
   * - 缓存服务不可用时仅记录日志而不抛出异常
   *
   * @param context - 安全上下文
   * @param level - 失效级别（user、tenant、global）
   * @returns Promise<void>
   * @throws {AbilityCacheException} 当缓存服务不可用且无法降级时（通常不会抛出，而是记录日志）
   *
   * @example
   * ```typescript
   * const context: SecurityContext = {
   *   userId: 'user-1',
   *   tenantId: 'tenant-1',
   *   organizationId: 'org-1',
   * };
   * await cacheService.invalidate(context, 'user');
   * ```
   */
  invalidate(
    context: SecurityContext,
    level: "user" | "tenant" | "global",
  ): Promise<void>;
}
