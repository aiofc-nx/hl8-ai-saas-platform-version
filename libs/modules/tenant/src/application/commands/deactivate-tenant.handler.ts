/**
 * @fileoverview 停用租户命令处理器
 * @description 处理停用租户命令，包括状态校验、聚合更新、事件保存和发布
 *
 * ## 业务规则
 *
 * ### 权限校验
 * - 由 CaslCommandHandler 基类自动处理权限校验
 * - 需要 "manage" "Tenant" 权限
 *
 * ### 业务校验
 * - 租户必须存在
 * - 租户状态必须为 Active
 * - 已归档的租户不能停用
 *
 * ### 执行流程
 * 1. 从仓储加载租户聚合
 * 2. 调用聚合的 deactivate 方法
 * 3. 保存聚合到仓储（事件流）
 * 4. 发布领域事件
 *
 * ## 使用示例
 *
 * ```typescript
 * const handler = new DeactivateTenantHandler(...);
 * await handler.execute(command);
 * ```
 */

import { CommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import {
  CaslCommandHandler,
  CaslAbilityCoordinator,
  AuditCoordinator,
} from "@hl8/application-base";
import type { EventStore } from "@hl8/infrastructure-base";
import type { EventPublisher } from "@hl8/infrastructure-base";
import { AggregateId, UserId } from "@hl8/domain-base";
import { Logger } from "@hl8/logger";
import { DomainException } from "@hl8/domain-base";
import { TenantAggregate } from "../../domains/tenant/aggregates/tenant.aggregate.js";
import { DeactivateTenantCommand } from "./deactivate-tenant.command.js";
import type { TenantRepository } from "../../domains/tenant/repositories/tenant.repository.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * 停用租户命令处理器
 *
 * @description 处理停用租户命令
 */
@CommandHandler(DeactivateTenantCommand)
export class DeactivateTenantHandler extends CaslCommandHandler<
  DeactivateTenantCommand,
  void
> {
  /**
   * 构造函数
   *
   * @param abilityCoordinator - CASL 权限协调器
   * @param auditCoordinator - 审计协调器
   * @param tenantRepository - 租户仓储
   * @param eventStore - 事件存储
   * @param eventPublisher - 事件发布器
   * @param logger - 日志服务
   */
  constructor(
    abilityCoordinator: CaslAbilityCoordinator,
    auditCoordinator: AuditCoordinator,
    private readonly tenantRepository: TenantRepository,
    @Inject("EventStore") private readonly eventStore: EventStore,
    @Inject("EventPublisher") private readonly eventPublisher: EventPublisher,
    private readonly logger: LoggerService,
  ) {
    super(abilityCoordinator, auditCoordinator);
  }

  /**
   * 处理停用租户命令
   *
   * @param command - 停用租户命令
   */
  protected async handle(command: DeactivateTenantCommand): Promise<void> {
    // 1. 从仓储加载租户聚合
    const tenantId = AggregateId.fromString(command.tenantId);
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant) {
      throw new DomainException(`租户不存在: ${command.tenantId}`);
    }

    // 2. 校验租户状态（聚合根内部会进行校验，这里可以提前检查以提供更好的错误信息）
    if (tenant.status.isArchived()) {
      throw new DomainException("已归档的租户不能停用");
    }

    if (!tenant.status.isActive()) {
      throw new DomainException(
        `当前状态 ${tenant.status.value} 不能停用，只能从 Active 状态停用`,
      );
    }

    // 3. 调用聚合的 deactivate 方法
    const userId = UserId.create(command.context.userId);
    tenant.deactivate(userId);

    // 4. 保存聚合到仓储（事件流）
    // 仓储会将领域事件转换为 StoredEvent 并保存到 EventStore，同时发布到事件总线
    await this.tenantRepository.save(tenant);

    this.logger.log("租户停用成功", {
      tenantId: tenant.id.toString(),
      tenantName: tenant.tenantName.value,
    });
  }
}
