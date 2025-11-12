import { AuditTrail } from "../auditing/audit-trail.value-object.js";
import { SoftDeleteStatus } from "../auditing/soft-delete-status.value-object.js";
import { assertNonEmptyString, assertUuid } from "../utils/domain-guards.js";
import { DateTimeValueObject } from "../value-objects/date-time.value-object.js";
import { DepartmentId } from "../value-objects/department-id.vo.js";
import { OrganizationId } from "../value-objects/organization-id.vo.js";
import { TenantId } from "../value-objects/tenant-id.vo.js";
import { UserId } from "../value-objects/user-id.vo.js";

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
 * @remarks 领域事件基类，统一携带多租户与审计上下文。
 */
export abstract class DomainEventBase {
  private readonly props: DomainEventProps;

  protected constructor(props: DomainEventProps) {
    assertUuid(props.eventId, "事件标识必须为合法的 UUID");
    assertNonEmptyString(props.aggregateId, "事件必须关联聚合标识");
    this.props = props;
  }

  public get eventId(): string {
    return this.props.eventId;
  }

  public get occurredAt(): DateTimeValueObject {
    return this.props.occurredAt;
  }

  public get aggregateId(): string {
    return this.props.aggregateId;
  }

  public get tenantId(): TenantId {
    return this.props.tenantId;
  }

  public get organizationId(): OrganizationId | undefined {
    return this.props.organizationId;
  }

  public get departmentId(): DepartmentId | undefined {
    return this.props.departmentId;
  }

  public get triggeredBy(): UserId | null {
    return this.props.triggeredBy;
  }

  public get auditMetadata(): AuditTrail {
    return this.props.auditMetadata;
  }

  public get softDeleteStatus(): SoftDeleteStatus {
    return this.props.softDeleteStatus;
  }

  /**
   * 领域事件名称，统一采用 PastTense + Event。
   */
  public abstract eventName(): string;
}
