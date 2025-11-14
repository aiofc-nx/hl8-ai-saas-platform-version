/**
 * @fileoverview CASL 权限能力服务实现
 * @description 实现 CASL 权限能力服务，支持权限规则构建和缓存
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

import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  AbilityBuilder,
  MongoAbility,
  createMongoAbility,
} from "@casl/ability";
import { Logger } from "@hl8/logger";
import { CaslAbilityException } from "../exceptions/infrastructure-exception.js";
import type {
  AbilityCacheService,
  AbilityRuleBuilder,
  AppAbility,
  SecurityContext,
} from "./casl-ability.interface.js";
import { CaslAbilityService } from "./casl-ability.interface.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description CASL 权限能力服务实现
 * @remarks 实现 CASL 权限能力服务，支持权限规则构建和缓存
 *
 * @example
 * ```typescript
 * // 注入权限能力服务
 * constructor(private readonly abilityService: CaslAbilityServiceImpl) {}
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
@Injectable()
export class CaslAbilityServiceImpl implements CaslAbilityService {
  /**
   * @description 构造函数
   * @param ruleBuilder - 权限规则构建器（可选）
   * @param cacheService - 权限缓存服务（可选）
   * @param logger - 日志服务（可选）
   */
  constructor(
    @Optional()
    @Inject("AbilityRuleBuilder")
    private readonly ruleBuilder?: AbilityRuleBuilder,
    @Optional()
    @Inject("AbilityCacheService")
    private readonly cacheService?: AbilityCacheService,
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
  ) {}

  /**
   * @description 解析用户权限能力
   * @remarks 根据安全上下文构建用户的权限能力
   *
   * @param context - 安全上下文
   * @returns 权限能力
   * @throws {CaslAbilityException} 当权限解析失败时
   */
  async resolveAbility(context: SecurityContext): Promise<AppAbility> {
    try {
      // 尝试从缓存获取
      if (this.cacheService) {
        const cacheKey = this.cacheService.buildKey(context);
        const cachedAbility = await this.cacheService.get(cacheKey);

        if (cachedAbility) {
          // 记录日志
          this.logger?.debug("从缓存获取权限能力", {
            userId: context.userId,
            tenantId: context.tenantId,
            organizationId: context.organizationId,
          });

          return cachedAbility;
        }
      }

      // 构建权限能力
      const ability = await this.buildAbility(context);

      // 缓存权限能力
      if (this.cacheService) {
        try {
          const cacheKey = this.cacheService.buildKey(context);
          await this.cacheService.set(cacheKey, ability);
        } catch (error) {
          // 缓存失败时仅记录日志，不影响权限验证流程
          this.logger?.warn("权限能力缓存失败", {
            userId: context.userId,
            tenantId: context.tenantId,
            organizationId: context.organizationId,
            error: (error as Error).message,
          });
        }
      }

      // 记录日志
      this.logger?.debug("权限能力已构建", {
        userId: context.userId,
        tenantId: context.tenantId,
        organizationId: context.organizationId,
      });

      return ability;
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        userId: context.userId,
        tenantId: context.tenantId,
        organizationId: context.organizationId,
      });

      // 抛出异常
      throw new CaslAbilityException(
        `权限能力解析失败: ${(error as Error).message}`,
        "CASL_ABILITY_ERROR",
        {
          userId: context.userId,
          tenantId: context.tenantId,
          organizationId: context.organizationId,
        },
        error,
      );
    }
  }

  /**
   * @description 构建权限能力
   * @remarks 根据安全上下文构建权限能力
   *
   * @param context - 安全上下文
   * @returns 权限能力
   */
  private async buildAbility(context: SecurityContext): Promise<AppAbility> {
    // 创建权限构建器
    const { can, cannot, build } = new AbilityBuilder<MongoAbility>(
      createMongoAbility,
    );

    // 如果提供了权限规则构建器，使用它构建权限规则
    if (this.ruleBuilder) {
      await this.ruleBuilder(can, cannot, context);
    } else {
      // 默认权限规则：所有用户都有基本权限
      can("read", "all");
      can("create", "all");
      can("update", "all");
      can("delete", "all");
    }

    // 构建权限能力
    return build();
  }
}
