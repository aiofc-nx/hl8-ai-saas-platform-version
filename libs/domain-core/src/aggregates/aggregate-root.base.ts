import { AuditTrail } from "../auditing/audit-trail.value-object.js";
import { SoftDeleteStatus } from "../auditing/soft-delete-status.value-object.js";
import { DomainException } from "../exceptions/domain.exception.js";
import type { DomainEventBase } from "../events/domain-event.base.js";
import { EntityBase } from "../entities/entity.base.js";
import { assertDefined } from "../utils/domain-guards.js";
import { DepartmentId } from "../value-objects/department-id.vo.js";
import { OrganizationId } from "../value-objects/organization-id.vo.js";
import { TenantId } from "../value-objects/tenant-id.vo.js";
import { UserId } from "../value-objects/user-id.vo.js";
import { AggregateId } from "./aggregate-id.value-object.js";

export interface AggregateRootProps<TId extends AggregateId> {
  readonly id: TId;
  readonly tenantId: TenantId;
  readonly organizationId?: OrganizationId;
  readonly departmentId?: DepartmentId;
  readonly auditTrail?: AuditTrail;
  readonly softDeleteStatus?: SoftDeleteStatus;
  readonly version?: number;
}

/**
 * @public
 * @remarks 聚合根基类，统一处理多租户上下文、审计、软删除与领域事件。
 */
export abstract class AggregateRootBase<
  TId extends AggregateId,
> extends EntityBase<TId> {
  protected _tenantId: TenantId;
  protected _organizationId?: OrganizationId;
  protected _departmentId?: DepartmentId;
  protected _auditTrail: AuditTrail;
  protected _softDeleteStatus: SoftDeleteStatus;
  protected _version: number;
  private readonly domainEvents: DomainEventBase[] = [];

  protected constructor(props: AggregateRootProps<TId>) {
    super(props.id);
    assertDefined(props.tenantId, "聚合根必须隶属于租户");

    this._tenantId = props.tenantId;
    this._organizationId = props.organizationId;
    this._departmentId = props.departmentId;
    this._auditTrail =
      props.auditTrail ?? AuditTrail.create({ createdBy: null });
    this._softDeleteStatus =
      props.softDeleteStatus ?? SoftDeleteStatus.create();
    this._version = props.version ?? 0;
  }

  /**
   * 聚合根必须实现的领域不变式。
   */
  protected abstract ensureValidState(): void;

  public get tenantId(): TenantId {
    return this._tenantId;
  }

  public get organizationId(): OrganizationId | undefined {
    return this._organizationId;
  }

  public get departmentId(): DepartmentId | undefined {
    return this._departmentId;
  }

  public get auditTrail(): AuditTrail {
    return this._auditTrail;
  }

  public get softDeleteStatus(): SoftDeleteStatus {
    return this._softDeleteStatus;
  }

  public get version(): number {
    return this._version;
  }

  /**
   * 更新审计信息。
   */
  protected touch(actor: UserId | null): void {
    this._auditTrail = this._auditTrail.update({ updatedBy: actor ?? null });
  }

  /**
   * 将聚合标记为已删除。
   */
  protected markDeleted(actor: UserId | null): void {
    this._softDeleteStatus = this._softDeleteStatus.markDeleted(actor ?? null);
    this.touch(actor);
  }

  /**
   * 恢复软删除状态。
   */
  protected restore(actor: UserId | null): void {
    this._softDeleteStatus = this._softDeleteStatus.restore(actor ?? null);
    this.touch(actor);
  }

  /**
   * 校验租户上下文一致性。
   */
  protected assertSameTenant(tenantId: TenantId, message?: string): void {
    if (!this._tenantId.equals(tenantId)) {
      throw new DomainException(message ?? "跨租户操作被拒绝");
    }
  }

  /**
   * 校验组织上下文一致性。
   */
  protected assertSameOrganization(
    organizationId?: OrganizationId,
    message?: string,
  ): void {
    if (!this._organizationId) {
      return;
    }
    if (!organizationId || !this._organizationId.equals(organizationId)) {
      throw new DomainException(message ?? "跨组织操作被拒绝");
    }
  }

  /**
   * 校验部门上下文一致性。
   */
  protected assertSameDepartment(
    departmentId?: DepartmentId,
    message?: string,
  ): void {
    if (!this._departmentId) {
      return;
    }
    if (!departmentId || !this._departmentId.equals(departmentId)) {
      throw new DomainException(message ?? "跨部门操作被拒绝");
    }
  }

  /**
   * 收集领域事件。
   */
  protected addDomainEvent(event: DomainEventBase): void {
    this.domainEvents.push(event);
  }

  /**
   * 拉取并清空领域事件队列。
   */
  public pullDomainEvents(): DomainEventBase[] {
    if (this.domainEvents.length === 0) {
      return [];
    }
    const events = [...this.domainEvents];
    this.domainEvents.length = 0;
    return events;
  }
}
