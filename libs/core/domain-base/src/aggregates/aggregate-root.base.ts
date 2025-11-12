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

/**
 * @public
 * @description 聚合根构造参数，涵盖多租户上下文、审计与版本信息。
 * @typeParam TId - 聚合根标识类型，必须继承自 `AggregateId`。
 * @example
 * ```ts
 * const props: AggregateRootProps<AggregateId> = {
 *   id: AggregateId.generate(),
 *   tenantId: TenantId.create("tenant_1"),
 *   auditTrail: AuditTrail.create({ createdBy: null }),
 *   softDeleteStatus: SoftDeleteStatus.create(),
 * };
 * ```
 */
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
 * @description 聚合根基类，统一处理多租户上下文、审计、软删除与领域事件。
 * @typeParam TId - 聚合根标识类型，必须继承自 `AggregateId`。
 * @example
 * ```ts
 * class TenantAggregate extends AggregateRootBase<AggregateId> {
 *   public constructor(props: AggregateRootProps<AggregateId>) {
 *     super(props);
 *     this.ensureValidState();
 *   }
 *
 *   protected ensureValidState(): void {
 *     if (!this.tenantId) {
 *       throw new DomainException("租户不能为空");
 *     }
 *   }
 * }
 * ```
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
   * @description 聚合根必须实现的领域不变式，用于保障聚合状态合法。
   * @throws {DomainException} 当聚合状态不满足业务规则时抛出。
   * @example
   * ```ts
   * protected ensureValidState(): void {
   *   if (!this.tenantId.equals(expectedTenant)) {
   *     throw new DomainException("租户不匹配");
   *   }
   * }
   * ```
   */
  protected abstract ensureValidState(): void;

  /**
   * @description 获取聚合所属租户标识。
   * @returns 聚合拥有的租户 `TenantId`。
   * @example
   * ```ts
   * const tenant = aggregate.tenantId;
   * ```
   */
  public get tenantId(): TenantId {
    return this._tenantId;
  }

  /**
   * @description 获取聚合所属组织标识。
   * @returns 聚合拥有的组织 `OrganizationId`，可能为 `undefined`。
   * @example
   * ```ts
   * const organization = aggregate.organizationId;
   * ```
   */
  public get organizationId(): OrganizationId | undefined {
    return this._organizationId;
  }

  /**
   * @description 获取聚合所属部门标识。
   * @returns 聚合拥有的部门 `DepartmentId`，可能为 `undefined`。
   * @example
   * ```ts
   * const department = aggregate.departmentId;
   * ```
   */
  public get departmentId(): DepartmentId | undefined {
    return this._departmentId;
  }

  /**
   * @description 获取聚合审计信息。
   * @returns 聚合的审计轨迹 `AuditTrail`。
   * @example
   * ```ts
   * const createdBy = aggregate.auditTrail.createdBy;
   * ```
   */
  public get auditTrail(): AuditTrail {
    return this._auditTrail;
  }

  /**
   * @description 获取聚合软删除状态。
   * @returns 聚合的软删除值对象 `SoftDeleteStatus`。
   * @example
   * ```ts
   * const isDeleted = aggregate.softDeleteStatus.isDeleted();
   * ```
   */
  public get softDeleteStatus(): SoftDeleteStatus {
    return this._softDeleteStatus;
  }

  /**
   * @description 获取聚合版本号。
   * @returns 聚合的当前版本号。
   * @example
   * ```ts
   * const version = aggregate.version;
   * ```
   */
  public get version(): number {
    return this._version;
  }

  /**
   * @description 更新聚合审计信息，并记录执行人。
   * @param actor - 执行操作的用户标识，支持 `null` 表示系统操作。
   * @returns 返回 `void`，仅修改内部状态。
   * @example
   * ```ts
   * aggregate.touch(UserId.create("user_1"));
   * ```
   */
  protected touch(actor: UserId | null): void {
    this._auditTrail = this._auditTrail.update({ updatedBy: actor ?? null });
  }

  /**
   * @description 将聚合标记为已删除，并更新审计信息。
   * @param actor - 执行删除操作的用户标识，支持 `null` 表示系统操作。
   * @returns 返回 `void`，仅修改内部状态。
   * @example
   * ```ts
   * aggregate.markDeleted(UserId.create("user_1"));
   * ```
   */
  protected markDeleted(actor: UserId | null): void {
    this._softDeleteStatus = this._softDeleteStatus.markDeleted(actor ?? null);
    this.touch(actor);
  }

  /**
   * @description 恢复聚合软删除状态，并更新审计信息。
   * @param actor - 执行恢复操作的用户标识，支持 `null` 表示系统操作。
   * @returns 返回 `void`，仅修改内部状态。
   * @example
   * ```ts
   * aggregate.restore(UserId.create("user_1"));
   * ```
   */
  protected restore(actor: UserId | null): void {
    this._softDeleteStatus = this._softDeleteStatus.restore(actor ?? null);
    this.touch(actor);
  }

  /**
   * @description 校验传入租户与聚合所属租户是否一致。
   * @param tenantId - 用于校验的租户标识。
   * @param message - 自定义异常消息，可选。
   * @throws {DomainException} 当租户不一致时抛出。
   * @returns 返回 `void`，若校验失败将抛出异常。
   * @example
   * ```ts
   * aggregate.assertSameTenant(inputTenantId);
   * ```
   */
  protected assertSameTenant(tenantId: TenantId, message?: string): void {
    if (!this._tenantId.equals(tenantId)) {
      throw new DomainException(message ?? "跨租户操作被拒绝");
    }
  }

  /**
   * @description 校验传入组织与聚合所属组织是否一致。
   * @param organizationId - 用于校验的组织标识，可选。
   * @param message - 自定义异常消息，可选。
   * @throws {DomainException} 当聚合存在组织且传入组织不一致时抛出。
   * @returns 返回 `void`，若校验失败将抛出异常。
   * @example
   * ```ts
   * aggregate.assertSameOrganization(inputOrganizationId);
   * ```
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
   * @description 校验传入部门与聚合所属部门是否一致。
   * @param departmentId - 用于校验的部门标识，可选。
   * @param message - 自定义异常消息，可选。
   * @throws {DomainException} 当聚合存在部门且传入部门不一致时抛出。
   * @returns 返回 `void`，若校验失败将抛出异常。
   * @example
   * ```ts
   * aggregate.assertSameDepartment(inputDepartmentId);
   * ```
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
   * @description 收集聚合产生的领域事件以待发布。
   * @param event - 需要记录的领域事件。
   * @returns 返回 `void`，领域事件将缓存于聚合内。
   * @example
   * ```ts
   * aggregate.addDomainEvent(new TenantCreatedEvent(aggregate.id));
   * ```
   */
  protected addDomainEvent(event: DomainEventBase): void {
    this.domainEvents.push(event);
  }

  /**
   * @description 拉取并清空聚合累积的领域事件。
   * @returns 聚合已收集的领域事件数组。
   * @example
   * ```ts
   * const events = aggregate.pullDomainEvents();
   * ```
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
