import type { Repository } from "../../src/repositories/repository.interface.js";
import type { RepositoryFindByCriteria } from "../../src/repositories/repository.interface.js";
import { AggregateRootBase } from "../../src/aggregates/aggregate-root.base.js";
import { AggregateId } from "../../src/aggregates/aggregate-id.value-object.js";
import { AuditTrail } from "../../src/auditing/audit-trail.value-object.js";
import { SoftDeleteStatus } from "../../src/auditing/soft-delete-status.value-object.js";
import { TenantId } from "../../src/value-objects/tenant-id.vo.js";
import { OrganizationId } from "../../src/value-objects/organization-id.vo.js";
import { DepartmentId } from "../../src/value-objects/department-id.vo.js";
import { UserId } from "../../src/value-objects/user-id.vo.js";

interface TestAggregateProps {
  id: AggregateId;
  tenantId: TenantId;
  organizationId?: OrganizationId;
  departmentId?: DepartmentId;
  auditTrail?: AuditTrail;
  softDeleteStatus?: SoftDeleteStatus;
  version?: number;
  name: string;
}

class TestAggregate extends AggregateRootBase<AggregateId> {
  private _name: string;

  private constructor(props: TestAggregateProps) {
    super(props);
    this._name = props.name;
    this.ensureValidState();
  }

  static create(name: string, tenantId: TenantId): TestAggregate {
    return new TestAggregate({
      id: AggregateId.generate(),
      tenantId,
      auditTrail: AuditTrail.create({ createdBy: null }),
      softDeleteStatus: SoftDeleteStatus.create(),
      name,
    });
  }

  protected ensureValidState(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new Error("名称不能为空");
    }
  }

  public get name(): string {
    return this._name;
  }

  public archive(actor: UserId | null = null): void {
    this.markDeleted(actor);
  }
}

class InMemoryRepository implements Repository<TestAggregate, AggregateId> {
  private readonly store = new Map<string, TestAggregate>();

  async findById(id: AggregateId): Promise<TestAggregate | null> {
    return this.store.get(id.value) ?? null;
  }

  async findBy(
    criteria: RepositoryFindByCriteria<AggregateId>,
  ): Promise<TestAggregate[]> {
    const matches: TestAggregate[] = [];
    for (const aggregate of this.store.values()) {
      if (!aggregate.tenantId.equals(criteria.tenantId)) {
        continue;
      }
      if (
        criteria.organizationId &&
        aggregate.organizationId &&
        !aggregate.organizationId.equals(criteria.organizationId)
      ) {
        continue;
      }
      if (
        criteria.departmentId &&
        aggregate.departmentId &&
        !aggregate.departmentId.equals(criteria.departmentId)
      ) {
        continue;
      }
      if (
        criteria.ids &&
        !criteria.ids.some((candidate) => candidate.equals(aggregate.id))
      ) {
        continue;
      }
      if (!criteria.includeDeleted && aggregate.softDeleteStatus.isDeleted) {
        continue;
      }
      matches.push(aggregate);
    }
    return matches;
  }

  async save(aggregate: TestAggregate): Promise<void> {
    this.store.set(aggregate.id.value, aggregate);
  }

  async delete(id: AggregateId): Promise<void> {
    this.store.delete(id.value);
  }
}

describe("Repository 接口契约", () => {
  it("应支持按租户筛选聚合并排除软删除记录", async () => {
    const repo = new InMemoryRepository();
    const tenantA = TenantId.create("tenant_a");
    const tenantB = TenantId.create("tenant_b");
    const aggregateA1 = TestAggregate.create("A1", tenantA);
    const aggregateA2 = TestAggregate.create("A2", tenantA);
    const aggregateB = TestAggregate.create("B1", tenantB);

    aggregateA2.archive(UserId.create("actor"));

    await repo.save(aggregateA1);
    await repo.save(aggregateA2);
    await repo.save(aggregateB);

    const results = await repo.findBy({ tenantId: tenantA });

    expect(results).toHaveLength(1);
    expect(results[0].id).toEqual(aggregateA1.id);

    const includeDeleted = await repo.findBy({
      tenantId: tenantA,
      includeDeleted: true,
    });

    expect(includeDeleted).toHaveLength(2);
  });

  it("delete 应移除聚合", async () => {
    const repo = new InMemoryRepository();
    const aggregate = TestAggregate.create("A1", TenantId.create("tenant_a"));

    await repo.save(aggregate);
    expect(await repo.findById(aggregate.id)).not.toBeNull();

    await repo.delete(aggregate.id);
    expect(await repo.findById(aggregate.id)).toBeNull();
  });
});
