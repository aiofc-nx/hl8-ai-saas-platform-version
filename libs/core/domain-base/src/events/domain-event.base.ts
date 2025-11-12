import { AuditTrail } from "../auditing/audit-trail.value-object.js";
import { SoftDeleteStatus } from "../auditing/soft-delete-status.value-object.js";
import { assertNonEmptyString, assertUuid } from "../utils/domain-guards.js";
import { DateTimeValueObject } from "../value-objects/date-time.value-object.js";
import { DepartmentId } from "../value-objects/department-id.vo.js";
import { OrganizationId } from "../value-objects/organization-id.vo.js";
import { TenantId } from "../value-objects/tenant-id.vo.js";
import { UserId } from "../value-objects/user-id.vo.js";

/**
 * @public
 * @description 领域事件属性集合，统一封装多租户、审计与软删除上下文。
 * @example
 * ```ts
 * const props: DomainEventProps = {
 *   eventId: UuidGenerator.generate(),
 *   occurredAt: DateTimeValueObject.now(),
 *   aggregateId: aggregate.id.toString(),
 *   tenantId: aggregate.tenantId,
 *   triggeredBy: null,
 *   auditMetadata: aggregate.auditTrail,
 *   softDeleteStatus: aggregate.softDeleteStatus,
 * };
 * ```
 */
export interface DomainEventProps {
  readonly eventId: string;
  readonly occurredAt: DateTimeValueObject;
  readonly aggregateId: string;
  readonly tenantId: TenantId;
  readonly organizationId?: OrganizationId;
  readonly departmentId?: DepartmentId;
  readonly triggeredBy: UserId | null;
  readonly auditMetadata: AuditTrail;
  readonly softDeleteStatus: SoftDeleteStatus;
}

/**
 * @public
 * @description 领域事件基类，统一携带多租户、审计与软删除上下文。
 * @example
 * ```ts
 * export class TenantCreatedEvent extends DomainEventBase {
 *   public constructor(props: DomainEventProps) {
 *     super(props);
 *   }
 *
 *   public eventName(): string {
 *     return "TenantCreatedEvent";
 *   }
 * }
 * ```
 */
export abstract class DomainEventBase {
  private readonly props: DomainEventProps;

  /**
   * @description 构造领域事件基类。
   * @param props - 领域事件所需的上下文属性。
   * @throws {DomainException} 当事件标识或聚合标识非法时抛出。
   * @returns 返回 `DomainEventBase` 的子类实例。
   * @example
   * ```ts
   * super(props);
   * ```
   */
  protected constructor(props: DomainEventProps) {
    assertUuid(props.eventId, "事件标识必须为合法的 UUID");
    assertNonEmptyString(props.aggregateId, "事件必须关联聚合标识");
    this.props = props;
  }

  /**
   * @description 获取事件标识。
   * @returns 事件 UUID。
   * @example
   * ```ts
   * const id = event.eventId;
   * ```
   */
  public get eventId(): string {
    return this.props.eventId;
  }

  /**
   * @description 获取事件发生时间。
   * @returns 时间值对象。
   * @example
   * ```ts
   * const occurredAt = event.occurredAt;
   * ```
   */
  public get occurredAt(): DateTimeValueObject {
    return this.props.occurredAt;
  }

  /**
   * @description 获取关联聚合标识。
   * @returns 聚合标识字符串。
   * @example
   * ```ts
   * const aggregateId = event.aggregateId;
   * ```
   */
  public get aggregateId(): string {
    return this.props.aggregateId;
  }

  /**
   * @description 获取租户标识。
   * @returns 租户 `TenantId`。
   * @example
   * ```ts
   * const tenantId = event.tenantId;
   * ```
   */
  public get tenantId(): TenantId {
    return this.props.tenantId;
  }

  /**
   * @description 获取组织标识。
   * @returns 组织 `OrganizationId` 或 `undefined`。
   * @example
   * ```ts
   * const organizationId = event.organizationId;
   * ```
   */
  public get organizationId(): OrganizationId | undefined {
    return this.props.organizationId;
  }

  /**
   * @description 获取部门标识。
   * @returns 部门 `DepartmentId` 或 `undefined`。
   * @example
   * ```ts
   * const departmentId = event.departmentId;
   * ```
   */
  public get departmentId(): DepartmentId | undefined {
    return this.props.departmentId;
  }

  /**
   * @description 获取触发事件的用户。
   * @returns 用户标识或 `null`。
   * @example
   * ```ts
   * const actor = event.triggeredBy;
   * ```
   */
  public get triggeredBy(): UserId | null {
    return this.props.triggeredBy;
  }

  /**
   * @description 获取事件审计信息。
   * @returns 审计轨迹值对象。
   * @example
   * ```ts
   * const auditTrail = event.auditMetadata;
   * ```
   */
  public get auditMetadata(): AuditTrail {
    return this.props.auditMetadata;
  }

  /**
   * @description 获取事件的软删除状态。
   * @returns 软删除状态值对象。
   * @example
   * ```ts
   * const status = event.softDeleteStatus;
   * ```
   */
  public get softDeleteStatus(): SoftDeleteStatus {
    return this.props.softDeleteStatus;
  }

  /**
   * @description 领域事件名称，统一采用 `PastTense + Event`。
   * @returns 领域事件名称字符串。
   * @example
   * ```ts
   * const name = event.eventName();
   * ```
   */
  public abstract eventName(): string;
}
