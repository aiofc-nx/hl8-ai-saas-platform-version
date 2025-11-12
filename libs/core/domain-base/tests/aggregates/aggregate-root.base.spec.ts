import { jest } from "@jest/globals";

import type { AggregateRootProps } from "../../src/aggregates/aggregate-root.base.js";
import { AggregateRootBase } from "../../src/aggregates/aggregate-root.base.js";
import { AggregateId } from "../../src/aggregates/aggregate-id.value-object.js";
import { AuditTrail } from "../../src/auditing/audit-trail.value-object.js";
import { SoftDeleteStatus } from "../../src/auditing/soft-delete-status.value-object.js";
import { DomainException } from "../../src/exceptions/domain.exception.js";
import { DomainEventBase } from "../../src/events/domain-event.base.js";
import { DateTimeValueObject } from "../../src/value-objects/date-time.value-object.js";
import { DepartmentId } from "../../src/value-objects/department-id.vo.js";
import { OrganizationId } from "../../src/value-objects/organization-id.vo.js";
import { TenantId } from "../../src/value-objects/tenant-id.vo.js";
import { UserId } from "../../src/value-objects/user-id.vo.js";
import { UuidGenerator } from "../../src/utils/uuid-generator.js";

interface TestAggregateProps extends AggregateRootProps<AggregateId> {
  readonly name: string;
}

class TestDomainEvent extends DomainEventBase {
  constructor(props: {
    aggregate: AggregateId;
    tenant: TenantId;
    actor?: UserId | null;
  }) {
    super({
      eventId: UuidGenerator.generate(),
      occurredAt: DateTimeValueObject.now(),
      aggregateId: props.aggregate.value,
      tenantId: props.tenant,
      triggeredBy: props.actor ?? null,
      auditMetadata: AuditTrail.create({ createdBy: props.actor ?? null }),
      softDeleteStatus: SoftDeleteStatus.create(),
    });
  }

  eventName(): string {
    return "TestDomainEvent";
  }
}

class TestAggregate extends AggregateRootBase<AggregateId> {
  private _name: string;

  private constructor(props: TestAggregateProps) {
    super(props);
    this._name = props.name;
    this.ensureValidState();
  }

  static create(
    name: string,
    overrides: Partial<TestAggregateProps> = {},
  ): TestAggregate {
    const tenantId = overrides.tenantId ?? TenantId.create("tenant_test");
    const auditTrail =
      overrides.auditTrail ?? AuditTrail.create({ createdBy: null });
    const softDeleteStatus =
      overrides.softDeleteStatus ?? SoftDeleteStatus.create();

    return new TestAggregate({
      id: overrides.id ?? AggregateId.generate(),
      tenantId,
      organizationId:
        overrides.organizationId ?? OrganizationId.create("org_test"),
      departmentId: overrides.departmentId ?? DepartmentId.create("dept_test"),
      auditTrail,
      softDeleteStatus,
      version: overrides.version ?? 0,
      name,
    });
  }

  protected ensureValidState(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new DomainException("聚合名称不能为空");
    }
  }

  changeName(name: string, actor: UserId | null = null): void {
    this._name = name;
    this.touch(actor);
    this.ensureValidState();
  }

  remove(actor: UserId | null = null): void {
    this.markDeleted(actor);
  }

  restoreAggregate(actor: UserId | null = null): void {
    this.restore(actor);
  }

  enforceTenantContext(tenantId: TenantId): void {
    this.assertSameTenant(tenantId);
  }

  publishDomainEvent(event: DomainEventBase): void {
    this.addDomainEvent(event);
  }

  get name(): string {
    return this._name;
  }
}

describe("AggregateRootBase", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("should enforce invariants through ensureValidState", () => {
    expect(() => TestAggregate.create("")).toThrow(DomainException);
  });

  it("should update audit trail when touch is invoked", () => {
    const aggregate = TestAggregate.create("initial");
    const actor = UserId.create("user_actor");

    const initialUpdatedAt = aggregate.auditTrail.updatedAt;
    jest.useFakeTimers({ now: Date.now() + 1_000 });

    aggregate.changeName("updated", actor);

    expect(aggregate.auditTrail.updatedBy).toEqual(actor);
    expect(aggregate.auditTrail.updatedAt.isAfter(initialUpdatedAt)).toBe(true);
  });

  it("should mark aggregate as deleted and restore it", () => {
    const actor = UserId.create("deleter");
    const aggregate = TestAggregate.create("test");

    aggregate.remove(actor);

    expect(aggregate.softDeleteStatus.isDeleted).toBe(true);
    expect(aggregate.softDeleteStatus.deletedBy).toEqual(actor);
    expect(aggregate.softDeleteStatus.deletedAt).not.toBeNull();

    aggregate.restoreAggregate(actor);

    expect(aggregate.softDeleteStatus.isDeleted).toBe(false);
    expect(aggregate.softDeleteStatus.deletedAt).toBeNull();
  });

  it("should guard against cross-tenant operations", () => {
    const aggregate = TestAggregate.create("test");
    const otherTenant = TenantId.create("tenant_other");

    expect(() => aggregate.enforceTenantContext(otherTenant)).toThrow(
      DomainException,
    );
  });

  it("should collect domain events and clear queue after polling", () => {
    const aggregate = TestAggregate.create("test");
    const event = new TestDomainEvent({
      aggregate: aggregate.id,
      tenant: aggregate.tenantId,
      actor: null,
    });

    aggregate.publishDomainEvent(event);

    const events = aggregate.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toBe(event);
    expect(aggregate.pullDomainEvents()).toHaveLength(0);
  });
});
