import { jest } from "@jest/globals";

import { AuditTrail } from "../../src/auditing/audit-trail.value-object.js";
import { SoftDeleteStatus } from "../../src/auditing/soft-delete-status.value-object.js";
import { DomainException } from "../../src/exceptions/domain.exception.js";
import { DateTimeValueObject } from "../../src/value-objects/date-time.value-object.js";
import { DepartmentId } from "../../src/value-objects/department-id.vo.js";
import { OrganizationId } from "../../src/value-objects/organization-id.vo.js";
import { TenantId } from "../../src/value-objects/tenant-id.vo.js";
import { UserId } from "../../src/value-objects/user-id.vo.js";

describe("多租户上下文值对象", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("TenantId 应拒绝空字符串", () => {
    expect(() => TenantId.create("")).toThrow(DomainException);
    expect(() => TenantId.create("   ")).toThrow(DomainException);
  });

  it("TenantId 与 OrganizationId、DepartmentId 支持等值比较", () => {
    const tenantA = TenantId.create("tenant_a");
    const tenantB = TenantId.create("tenant_a");
    const tenantC = TenantId.create("tenant_c");

    expect(tenantA.equals(tenantB)).toBe(true);
    expect(tenantA.equals(tenantC)).toBe(false);

    const orgA = OrganizationId.create("org_a");
    const orgB = OrganizationId.create("org_a");
    const dept = DepartmentId.create("dept_a");

    expect(orgA.equals(orgB)).toBe(true);
    expect(orgA.equals(dept as unknown as OrganizationId)).toBe(false);
  });

  it("AuditTrail 应记录创建与更新信息", () => {
    const creator = UserId.create("user_creator");
    const trail = AuditTrail.create({ createdBy: creator });

    expect(trail.createdBy).toEqual(creator);
    expect(trail.updatedBy).toEqual(creator);

    const previousUpdatedAt = trail.updatedAt;
    const updater = UserId.create("user_updater");

    jest.useFakeTimers({ now: Date.now() + 5_000 });
    const updatedTrail = trail.update({ updatedBy: updater });

    expect(updatedTrail.updatedBy).toEqual(updater);
    expect(updatedTrail.updatedAt.isAfter(previousUpdatedAt)).toBe(true);
    expect(updatedTrail.createdAt).toEqual(trail.createdAt);
  });

  it("SoftDeleteStatus 应支持软删除与恢复", () => {
    const status = SoftDeleteStatus.create();
    expect(status.isDeleted).toBe(false);
    expect(status.deletedAt).toBeNull();

    const deleter = UserId.create("deleter");
    jest.useFakeTimers({ now: Date.now() + 1_000 });
    const deleted = status.markDeleted(deleter);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedBy).toEqual(deleter);
    expect(deleted.deletedAt).not.toBeNull();

    const restorer = UserId.create("restorer");
    const restored = deleted.restore(restorer);

    expect(restored.isDeleted).toBe(false);
    expect(restored.deletedAt).toBeNull();
    expect(restored.deletedBy).toEqual(restorer);
  });

  it("DateTimeValueObject 支持时间比较与序列化", () => {
    const now = DateTimeValueObject.now();
    jest.useFakeTimers({ now: Date.now() + 1_000 });
    const later = DateTimeValueObject.now();

    expect(later.isAfter(now)).toBe(true);
    expect(now.isAfter(later)).toBe(false);
    expect(now.toISOString()).toEqual(now.toJSDate().toISOString());
  });
});
