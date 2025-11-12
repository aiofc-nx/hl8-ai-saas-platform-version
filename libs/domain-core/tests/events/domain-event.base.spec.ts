import { DomainEventBase } from "../../src/events/domain-event.base.js";
import { AuditTrail } from "../../src/auditing/audit-trail.value-object.js";
import { SoftDeleteStatus } from "../../src/auditing/soft-delete-status.value-object.js";
import { DateTimeValueObject } from "../../src/value-objects/date-time.value-object.js";
import { TenantId } from "../../src/value-objects/tenant-id.vo.js";
import { OrganizationId } from "../../src/value-objects/organization-id.vo.js";
import { DepartmentId } from "../../src/value-objects/department-id.vo.js";
import { UserId } from "../../src/value-objects/user-id.vo.js";
import { DomainException } from "../../src/exceptions/domain.exception.js";
import { UuidGenerator } from "../../src/utils/uuid-generator.js";

class SampleDomainEvent extends DomainEventBase {
  public constructor() {
    super({
      eventId: UuidGenerator.generate(),
      occurredAt: DateTimeValueObject.now(),
      aggregateId: "aggregate-123",
      tenantId: TenantId.create("tenant_test"),
      organizationId: OrganizationId.create("org_test"),
      departmentId: DepartmentId.create("dept_test"),
      triggeredBy: UserId.create("actor"),
      auditMetadata: AuditTrail.create({ createdBy: UserId.create("writer") }),
      softDeleteStatus: SoftDeleteStatus.create(),
    });
  }

  public eventName(): string {
    return "SampleDomainEvent";
  }
}

describe("DomainEventBase", () => {
  it("应携带完整上下文数据", () => {
    const event = new SampleDomainEvent();

    expect(event.eventId).toEqual(expect.any(String));
    expect(event.eventName()).toBe("SampleDomainEvent");
    expect(event.tenantId.value).toBe("tenant_test");
    expect(event.organizationId?.value).toBe("org_test");
    expect(event.departmentId?.value).toBe("dept_test");
    expect(event.triggeredBy?.value).toBe("actor");
    expect(event.auditMetadata).toBeInstanceOf(AuditTrail);
    expect(event.softDeleteStatus).toBeInstanceOf(SoftDeleteStatus);
  });

  it("非法事件标识应抛出异常", () => {
    expect(
      () =>
        new (class extends DomainEventBase {
          public constructor() {
            super({
              eventId: "invalid",
              occurredAt: DateTimeValueObject.now(),
              aggregateId: "aggregate-123",
              tenantId: TenantId.create("tenant_test"),
              triggeredBy: null,
              auditMetadata: AuditTrail.create({ createdBy: null }),
              softDeleteStatus: SoftDeleteStatus.create(),
            });
          }

          public eventName(): string {
            return "InvalidEvent";
          }
        })(),
    ).toThrow(DomainException);
  });
});
