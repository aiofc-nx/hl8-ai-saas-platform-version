import type { AggregateId } from "../aggregates/aggregate-id.value-object.js";
import type { AggregateRootBase } from "../aggregates/aggregate-root.base.js";
import type { DepartmentId } from "../value-objects/department-id.vo.js";
import type { OrganizationId } from "../value-objects/organization-id.vo.js";
import type { TenantId } from "../value-objects/tenant-id.vo.js";

/**
 * @public
 * @remarks 聚合查询条件。
 */
export interface RepositoryFindByCriteria<TId extends AggregateId> {
  tenantId: TenantId;
  organizationId?: OrganizationId;
  departmentId?: DepartmentId;
  ids?: TId[];
  includeDeleted?: boolean;
}

/**
 * @public
 * @remarks 聚合根仓储接口，提供统一的持久化契约。
 */
export interface Repository<
  TAggregate extends AggregateRootBase<TId>,
  TId extends AggregateId,
> {
  findById(id: TId): Promise<TAggregate | null>;
  findBy(criteria: RepositoryFindByCriteria<TId>): Promise<TAggregate[]>;
  save(aggregate: TAggregate): Promise<void>;
  delete(id: TId): Promise<void>;
}
