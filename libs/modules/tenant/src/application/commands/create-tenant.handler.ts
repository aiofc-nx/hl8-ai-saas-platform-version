/**
 * @fileoverview 创建租户命令处理器
 * @description 处理创建租户命令，包括名称唯一性校验、聚合创建、事件保存和发布
 *
 * ## 业务规则
 *
 * ### 权限校验
 * - 由 CaslCommandHandler 基类自动处理权限校验
 * - 需要 "manage" "Tenant" 权限
 *
 * ### 业务校验
 * - 租户名称必须在平台内唯一
 * - 通过仓储查询检查名称是否已存在
 *
 * ### 执行流程
 * 1. 校验租户名称唯一性
 * 2. 创建租户聚合根
 * 3. 保存聚合到仓储（事件流）
 * 4. 发布领域事件
 *
 * ## 使用示例
 *
 * ```typescript
 * const handler = new CreateTenantHandler(...);
 * const result = await handler.execute(command);
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
import { UserId, AggregateId } from "@hl8/domain-base";
import { Logger } from "@hl8/logger";
import { DomainException } from "@hl8/domain-base";
import { TenantAggregate } from "../../domains/tenant/aggregates/tenant.aggregate.js";
import { CreateTenantCommand } from "./create-tenant.command.js";
import type { TenantRepository } from "../../domains/tenant/repositories/tenant.repository.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * 创建租户命令处理器
 *
 * @description 处理创建租户命令
 */
@CommandHandler(CreateTenantCommand)
export class CreateTenantHandler extends CaslCommandHandler<
  CreateTenantCommand,
  { tenantId: string }
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
   * 处理创建租户命令
   *
   * @param command - 创建租户命令
   * @returns 创建结果，包含租户ID
   */
  protected async handle(
    command: CreateTenantCommand,
  ): Promise<{ tenantId: string }> {
    // 1. 校验租户名称唯一性
    // 注意：创建租户时，系统租户ID应该从配置或上下文获取
    // 这里暂时使用命令的租户ID（实际应该是系统租户）
    const systemTenantId = AggregateId.fromString(command.context.tenantId);
    const existingTenant = await this.tenantRepository.findByName(
      command.tenantName,
      systemTenantId,
    );

    if (existingTenant) {
      throw new DomainException(
        `租户名称 "${command.tenantName.value}" 已存在，请使用其他名称`,
      );
    }

    // 2. 创建租户聚合根
    const userId = UserId.create(command.context.userId);
    const tenant = TenantAggregate.create({
      tenantName: command.tenantName,
      contactInfo: command.contactInfo,
      context: command.context,
      profile: command.profile,
      createdBy: userId,
    });

    // 3. 保存聚合到仓储（事件流）
    // 仓储会将领域事件转换为 StoredEvent 并保存到 EventStore，同时发布到事件总线
    await this.tenantRepository.save(tenant);

    this.logger.log("租户创建成功", {
      tenantId: tenant.id.toString(),
      tenantName: tenant.tenantName.value,
    });

    return {
      tenantId: tenant.id.toString(),
    };
  }
}
