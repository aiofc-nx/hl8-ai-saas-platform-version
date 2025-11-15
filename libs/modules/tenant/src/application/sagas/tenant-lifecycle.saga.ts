/**
 * @fileoverview 租户生命周期 Saga
 * @description 协调租户创建后的初始化流程，包括默认组织创建、IAM 基础角色初始化等
 *
 * ## 业务规则
 *
 * ### Saga 职责
 * - 监听 TenantCreatedEvent，初始化默认组织结构
 * - 监听 TenantActivatedEvent，初始化 IAM 基础角色
 * - 监听 TenantSuspendedEvent，触发 IAM 禁用权限，通知消息系统
 * - Saga 失败时记录补偿，支持后续重试
 *
 * ### 补偿机制
 * - 初始化失败时记录补偿事件
 * - 支持后续手动或自动重试
 * - 补偿操作应该是幂等的
 *
 * ### 执行流程
 * 1. 监听租户创建事件
 * 2. 创建默认组织根节点
 * 3. 初始化 IAM 基础角色
 * 4. 如果失败，记录补偿事件
 *
 * ## 使用示例
 *
 * ```typescript
 * // Saga 会自动注册到 NestJS CQRS EventBus
 * // 当 TenantCreatedEvent 发布时，会自动调用 onTenantCreated 方法
 * ```
 */

import { Injectable } from "@nestjs/common";
import {
  CommandBus,
  EventsHandler,
  EventBus,
  IEventHandler,
} from "@nestjs/cqrs";
import { Logger } from "@hl8/logger";
import type { SecurityContext } from "@hl8/application-base";
import {
  TenantActivatedEvent,
  TenantCreatedEvent,
  TenantSuspendedEvent,
} from "../../domains/tenant/events/index.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * 租户生命周期 Saga
 *
 * @description 协调租户创建后的初始化流程
 */
@Injectable()
@EventsHandler(TenantCreatedEvent, TenantActivatedEvent, TenantSuspendedEvent)
export class TenantLifecycleSaga
  implements
    IEventHandler<
      TenantCreatedEvent | TenantActivatedEvent | TenantSuspendedEvent
    >
{
  /**
   * 构造函数
   *
   * @param commandBus - 命令总线，用于执行初始化命令
   * @param eventBus - 事件总线，用于发布补偿事件
   * @param logger - 日志服务
   */
  constructor(
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerService,
  ) {}

  /**
   * 处理租户生命周期事件
   *
   * @param event - 租户生命周期事件
   */
  async handle(
    event: TenantCreatedEvent | TenantActivatedEvent | TenantSuspendedEvent,
  ): Promise<void> {
    if (event instanceof TenantCreatedEvent) {
      await this.onTenantCreated(event);
    } else if (event instanceof TenantActivatedEvent) {
      await this.onTenantActivated(event);
    } else if (event instanceof TenantSuspendedEvent) {
      await this.onTenantSuspended(event);
    }
  }

  /**
   * 处理租户创建事件
   *
   * @description 租户创建后，初始化默认组织结构和 IAM 基础角色
   *
   * @param event - 租户创建事件
   */
  private async onTenantCreated(event: TenantCreatedEvent): Promise<void> {
    const tenantId = event.aggregateId;
    const sagaId = `tenant_init_${tenantId}_${Date.now()}`;

    this.logger.log("开始处理租户创建 Saga", {
      tenantId,
      tenantName: event.tenantName,
      sagaId,
    });

    try {
      // 创建系统安全上下文（用于执行初始化命令）
      const securityContext = this.createSystemSecurityContext(tenantId);

      // 步骤 1: 创建默认组织根节点
      // 注意：此步骤需要组织模块实现后才能执行
      // 当前先记录日志，等待组织模块实现
      this.logger.log("准备创建默认组织根节点", {
        tenantId,
        defaultOrganizationId: event.context.defaultOrganizationId,
        sagaId,
      });

      // TODO: 当组织模块实现后，取消注释以下代码
      // const createOrganizationCommand = new CreateOrganizationCommand(
      //   securityContext,
      //   {
      //     tenantId,
      //     organizationName: `${event.tenantName} - 默认组织`,
      //     organizationCode: "DEFAULT",
      //     isDefault: true,
      //   },
      // );
      // await this.commandBus.execute(createOrganizationCommand);

      // 步骤 2: 初始化 IAM 基础角色
      // 注意：此步骤需要 IAM 模块实现后才能执行
      // 当前先记录日志，等待 IAM 模块实现
      this.logger.log("准备初始化 IAM 基础角色", {
        tenantId,
        sagaId,
      });

      // TODO: 当 IAM 模块实现后，取消注释以下代码
      // const initializeRolesCommand = new InitializeTenantRolesCommand(
      //   securityContext,
      //   {
      //     tenantId,
      //     defaultRoles: ["ADMIN", "USER", "VIEWER"],
      //   },
      // );
      // await this.commandBus.execute(initializeRolesCommand);

      this.logger.log("租户创建 Saga 执行成功", {
        tenantId,
        sagaId,
      });

      // TODO: 发布 Saga 完成事件（如果需要）
      // await this.eventBus.publish(
      //   new TenantInitializationCompletedEvent(tenantId, sagaId),
      // );
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error("租户创建 Saga 执行失败"),
        {
          tenantId,
          sagaId,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );

      // 记录补偿事件，支持后续重试
      // 注意：Saga 失败不应该阻止租户创建成功
      // 租户创建操作已经完成，这里只是后续的初始化流程
      // TODO: 当补偿事件定义后，取消注释以下代码
      // await this.eventBus.publish(
      //   new TenantInitializationFailedEvent(tenantId, sagaId, error),
      // );
    }
  }

  /**
   * 创建系统安全上下文
   *
   * @description 用于执行初始化命令的系统级安全上下文
   *
   * @param tenantId - 租户ID
   * @returns 系统安全上下文
   */
  private createSystemSecurityContext(tenantId: string): SecurityContext {
    return {
      tenantId,
      userId: "system", // 系统用户ID
      organizationIds: [],
      departmentIds: [],
      metadata: {
        source: "TenantLifecycleSaga",
        operation: "tenant_initialization",
      },
    };
  }

  /**
   * 处理租户激活事件
   *
   * @description 租户激活后，可能需要执行一些额外的初始化操作
   *
   * @param event - 租户激活事件
   */
  private async onTenantActivated(event: TenantActivatedEvent): Promise<void> {
    const tenantId = event.aggregateId;
    const sagaId = `tenant_activation_${tenantId}_${Date.now()}`;

    this.logger.log("开始处理租户激活 Saga", {
      tenantId,
      sagaId,
    });

    try {
      // 创建系统安全上下文
      const securityContext = this.createSystemSecurityContext(tenantId);

      // TODO: 执行激活后的初始化操作
      // 例如：发送欢迎通知、初始化默认配置等
      this.logger.log("准备执行租户激活后的初始化操作", {
        tenantId,
        sagaId,
      });

      // TODO: 当通知服务实现后，取消注释以下代码
      // await this.notificationService.sendWelcomeNotification(tenantId);

      // TODO: 当配置服务实现后，取消注释以下代码
      // await this.configService.initializeDefaultConfig(tenantId);

      this.logger.log("租户激活 Saga 执行成功", {
        tenantId,
        sagaId,
      });

      // TODO: 发布 Saga 完成事件（如果需要）
      // await this.eventBus.publish(
      //   new TenantActivationCompletedEvent(tenantId, sagaId),
      // );
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error("租户激活 Saga 执行失败"),
        {
          tenantId,
          sagaId,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );

      // TODO: 记录补偿事件
      // await this.eventBus.publish(
      //   new TenantActivationFailedEvent(tenantId, sagaId, error),
      // );

      // 注意：Saga 失败不应该阻止租户激活成功
      // 租户激活操作已经完成，这里只是后续的初始化流程
    }
  }

  /**
   * 处理租户停用事件
   *
   * @description 租户停用后，触发 IAM 禁用权限，通知消息系统
   *
   * @param event - 租户停用事件
   */
  private async onTenantSuspended(event: TenantSuspendedEvent): Promise<void> {
    const tenantId = event.aggregateId;
    const sagaId = `tenant_suspension_${tenantId}_${Date.now()}`;

    this.logger.log("开始处理租户停用 Saga", {
      tenantId,
      sagaId,
    });

    try {
      // 创建系统安全上下文
      const securityContext = this.createSystemSecurityContext(tenantId);

      // 步骤 1: 触发 IAM 禁用权限
      // 注意：此步骤需要 IAM 模块实现后才能执行
      this.logger.log("准备触发 IAM 禁用权限", {
        tenantId,
        sagaId,
      });

      // TODO: 当 IAM 模块实现后，取消注释以下代码
      // const disablePermissionsCommand = new DisableTenantPermissionsCommand(
      //   securityContext,
      //   {
      //     tenantId,
      //     reason: "租户已停用",
      //   },
      // );
      // await this.commandBus.execute(disablePermissionsCommand);

      // 步骤 2: 通知消息系统
      // 注意：此步骤需要消息服务实现后才能执行
      this.logger.log("准备通知消息系统", {
        tenantId,
        sagaId,
      });

      // TODO: 当消息服务实现后，取消注释以下代码
      // await this.messageService.notifyTenantSuspended({
      //   tenantId,
      //   suspendedAt: new Date(),
      //   reason: event.reason,
      // });

      this.logger.log("租户停用 Saga 执行成功", {
        tenantId,
        sagaId,
      });

      // TODO: 发布 Saga 完成事件（如果需要）
      // await this.eventBus.publish(
      //   new TenantSuspensionCompletedEvent(tenantId, sagaId),
      // );
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error("租户停用 Saga 执行失败"),
        {
          tenantId,
          sagaId,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );

      // TODO: 记录补偿事件
      // await this.eventBus.publish(
      //   new TenantSuspensionFailedEvent(tenantId, sagaId, error),
      // );

      // 注意：即使 Saga 失败，租户停用操作已经完成
      // 租户停用操作已经完成，这里只是后续的清理流程
    }
  }
}
