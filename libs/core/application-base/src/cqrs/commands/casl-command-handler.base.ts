import { Injectable } from "@nestjs/common";
import { CaslAbilityCoordinator } from "../../casl/casl-ability-coordinator.js";
import {
  assertDepartmentScope,
  assertOrganizationScope,
  assertTenantScope,
} from "../../interfaces/security-context.js";
import { AuditCoordinator } from "../../audit/audit-coordinator.js";
import type { CaslCommandBase } from "./casl-command.base.js";

/**
 * @public
 * @description 命令处理器基类，统一执行权限校验与审计记录。
 */
@Injectable()
export abstract class CaslCommandHandler<
  TCommand extends CaslCommandBase<TResult>,
  TResult = void,
> {
  protected constructor(
    protected readonly abilityCoordinator: CaslAbilityCoordinator,
    protected readonly auditCoordinator: AuditCoordinator,
  ) {}

  /**
   * @description 命令总线入口，实现权限校验、业务处理与审计记录。
   * @param command - 待执行的命令。
   */
  public async execute(command: TCommand): Promise<TResult> {
    const descriptor = command.abilityDescriptor();
    await this.abilityCoordinator.ensureAuthorized(command.context, descriptor);
    const result = await this.handle(command);
    await this.auditCoordinator.record(command.context, {
      tenantId: command.context.tenantId,
      userId: command.context.userId,
      action: descriptor.subject,
      payload: command.auditPayload(),
      result,
      metadata: { action: descriptor.action, type: "command" },
    });
    return result;
  }

  /**
   * @description 由具体命令处理器实现的业务逻辑。
   */
  protected abstract handle(command: TCommand): Promise<TResult>;

  /**
   * @description 校验命令是否在同租户范围内执行。
   */
  protected assertTenantScope(
    command: TCommand,
    tenantId: string,
    message?: string,
  ): void {
    assertTenantScope(command.context, tenantId, message);
  }

  /**
   * @description 校验命令是否在同组织范围内执行。
   */
  protected assertOrganizationScope(
    command: TCommand,
    organizationId: string,
    message?: string,
  ): void {
    assertOrganizationScope(command.context, organizationId, message);
  }

  /**
   * @description 校验命令是否在同部门范围内执行。
   */
  protected assertDepartmentScope(
    command: TCommand,
    departmentId: string,
    message?: string,
  ): void {
    assertDepartmentScope(command.context, departmentId, message);
  }
}
