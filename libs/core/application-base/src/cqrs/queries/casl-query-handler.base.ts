import { Injectable } from "@nestjs/common";
import { CaslAbilityCoordinator } from "../../casl/casl-ability-coordinator.js";
import {
  assertDepartmentScope,
  assertOrganizationScope,
  assertTenantScope,
} from "../../interfaces/security-context.js";
import { AuditCoordinator } from "../../audit/audit-coordinator.js";
import type { CaslQueryBase } from "./casl-query.base.js";

/**
 * @public
 * @description 查询处理器基类，统一执行权限校验与审计。
 */
@Injectable()
export abstract class CaslQueryHandler<
  TQuery extends CaslQueryBase<TResult>,
  TResult = unknown,
> {
  protected constructor(
    protected readonly abilityCoordinator: CaslAbilityCoordinator,
    protected readonly auditCoordinator: AuditCoordinator,
  ) {}

  /**
   * @description 查询执行总入口。
   */
  public async execute(query: TQuery): Promise<TResult> {
    const descriptor = query.abilityDescriptor();
    await this.abilityCoordinator.ensureAuthorized(query.context, descriptor);
    const result = await this.handle(query);
    await this.auditCoordinator.record(query.context, {
      tenantId: query.context.tenantId,
      userId: query.context.userId,
      action: descriptor.subject,
      payload: query.auditPayload(),
      result,
      metadata: { action: descriptor.action, type: "query" },
    });
    return result;
  }

  /**
   * @description 子类实现的查询逻辑。
   */
  protected abstract handle(query: TQuery): Promise<TResult>;

  protected assertTenantScope(
    query: TQuery,
    tenantId: string,
    message?: string,
  ): void {
    assertTenantScope(query.context, tenantId, message);
  }

  protected assertOrganizationScope(
    query: TQuery,
    organizationId: string,
    message?: string,
  ): void {
    assertOrganizationScope(query.context, organizationId, message);
  }

  protected assertDepartmentScope(
    query: TQuery,
    departmentId: string,
    message?: string,
  ): void {
    assertDepartmentScope(query.context, departmentId, message);
  }
}
