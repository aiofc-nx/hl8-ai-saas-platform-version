/**
 * @fileoverview 租户聚合根
 * @description 租户管理领域的核心实体，负责维护租户的不变式和生命周期状态转移
 *
 * ## 业务规则
 *
 * ### 聚合不变式
 * - 租户名称在同一平台内必须唯一（由应用层保证）
 * - 状态转移必须符合状态机规则
 * - 已归档的租户不能执行激活、停用操作
 *
 * ### 生命周期
 * - 创建：状态为 Initialized
 * - 激活：从 Initialized 或 Suspended 转为 Active
 * - 停用：从 Active 转为 Suspended
 * - 归档：从任意状态转为 Archived（软删除）
 *
 * ## 使用示例
 *
 * ```typescript
 * const tenant = TenantAggregate.create({
 *   tenantName: TenantName.create("ABC公司"),
 *   contactInfo: TenantContactInfo.create({ ... }),
 *   context: TenantContext.create({ ... }),
 *   profile: TenantProfile.create({ ... }),
 *   createdBy: userId
 * });
 * ```
 */

import {
  AggregateId,
  AggregateRootBase,
  type AggregateRootProps,
  AuditTrail,
  DateTimeValueObject,
  DomainException,
  SoftDeleteStatus,
  TenantId,
  UuidGenerator,
} from "@hl8/domain-base";
import type { UserId } from "@hl8/domain-base";
import { TenantProfile } from "../entities/tenant-profile.entity.js";
import {
  TenantActivatedEvent,
  TenantArchivedEvent,
  TenantCreatedEvent,
  TenantProfileUpdatedEvent,
  TenantSuspendedEvent,
} from "../events/index.js";
import type { DomainEventProps } from "@hl8/domain-base";
import { TenantContactInfo } from "../value-objects/tenant-contact-info.vo.js";
import { TenantContext } from "../value-objects/tenant-context.vo.js";
import { TenantName } from "../value-objects/tenant-name.vo.js";
import {
  TenantStatus,
  TenantStatusEnum,
} from "../value-objects/tenant-status.vo.js";

/**
 * 创建租户的数据
 */
export interface CreateTenantData {
  readonly tenantName: TenantName;
  readonly contactInfo: TenantContactInfo;
  readonly context: TenantContext;
  readonly profile?: TenantProfile;
  readonly createdBy?: UserId | null;
}

/**
 * 更新租户档案的命令
 */
export interface UpdateTenantProfileCommand {
  readonly legalName?: string | null;
  readonly registrationCode?: string | null;
  readonly industry?: string | null;
  readonly updatedBy?: UserId | null;
}

/**
 * 租户聚合根
 *
 * @description 租户管理领域的核心实体
 */
export class TenantAggregate extends AggregateRootBase<AggregateId> {
  private _tenantName: TenantName;
  private _status: TenantStatus;
  private _contactInfo: TenantContactInfo;
  private _context: TenantContext;
  private _profile: TenantProfile;

  /**
   * 私有构造函数
   *
   * @param props - 聚合根属性
   * @param data - 租户数据
   */
  private constructor(
    props: AggregateRootProps<AggregateId>,
    data: {
      tenantName: TenantName;
      status: TenantStatus;
      contactInfo: TenantContactInfo;
      context: TenantContext;
      profile: TenantProfile;
    },
  ) {
    super(props);
    this._tenantName = data.tenantName;
    this._status = data.status;
    this._contactInfo = data.contactInfo;
    this._context = data.context;
    this._profile = data.profile;
    this.ensureValidState();
  }

  /**
   * 创建租户聚合根
   *
   * @param data - 创建租户的数据
   * @returns 租户聚合根实例
   */
  public static create(data: CreateTenantData): TenantAggregate {
    const id = AggregateId.generate();
    // 租户聚合的 tenantId 等于其 id（租户本身就是租户）
    // 需要将 AggregateId 转换为 TenantId
    const tenantId = TenantId.create(id.value);
    const auditTrail = AuditTrail.create({
      createdBy: data.createdBy ?? null,
    });
    const softDeleteStatus = SoftDeleteStatus.create();
    const status = TenantStatus.Initialized;
    const profile = data.profile ?? TenantProfile.create();

    const aggregate = new TenantAggregate(
      {
        id,
        tenantId,
        auditTrail,
        softDeleteStatus,
        version: 0,
      },
      {
        tenantName: data.tenantName,
        status,
        contactInfo: data.contactInfo,
        context: data.context,
        profile,
      },
    );

    // 触发创建事件
    const event = new TenantCreatedEvent(
      aggregate.buildEventProps(data.createdBy ?? null),
      {
        tenantName: data.tenantName.value,
        status,
        contactInfo: data.contactInfo,
        context: data.context,
        profile: profile,
      },
    );
    aggregate.addDomainEvent(event);

    return aggregate;
  }

  /**
   * 激活租户
   *
   * @param initiator - 操作发起人
   * @throws {DomainException} 当状态不允许激活时抛出
   */
  public activate(initiator: UserId | null = null): void {
    // 校验状态
    if (this._status.isArchived()) {
      throw new DomainException("已归档的租户不能激活");
    }

    if (!this._status.canTransitionTo(TenantStatus.Active)) {
      throw new DomainException(
        `当前状态 ${this._status.value} 不能激活，只能从 Initialized 或 Suspended 状态激活`,
      );
    }

    const previousStatus = this._status;
    this._status = TenantStatus.Active;
    this.touch(initiator);

    // 触发激活事件
    const event = new TenantActivatedEvent(this.buildEventProps(initiator), {
      tenantName: this._tenantName.value,
      previousStatus,
      currentStatus: this._status,
    });
    this.addDomainEvent(event);
  }

  /**
   * 停用租户
   *
   * @param initiator - 操作发起人
   * @throws {DomainException} 当状态不允许停用时抛出
   */
  public deactivate(initiator: UserId | null = null): void {
    // 校验状态
    if (this._status.isArchived()) {
      throw new DomainException("已归档的租户不能停用");
    }

    if (!this._status.isActive()) {
      throw new DomainException(
        `当前状态 ${this._status.value} 不能停用，只能从 Active 状态停用`,
      );
    }

    const previousStatus = this._status;
    this._status = TenantStatus.Suspended;
    this.touch(initiator);

    // 触发停用事件
    const event = new TenantSuspendedEvent(this.buildEventProps(initiator), {
      tenantName: this._tenantName.value,
      previousStatus,
      currentStatus: this._status,
    });
    this.addDomainEvent(event);
  }

  /**
   * 归档租户（软删除）
   *
   * @param initiator - 操作发起人
   */
  public archive(initiator: UserId | null = null): void {
    // 归档可以从任意状态执行
    const previousStatus = this._status;
    this._status = TenantStatus.Archived;
    this.markDeleted(initiator);

    // 触发归档事件
    const event = new TenantArchivedEvent(this.buildEventProps(initiator), {
      tenantName: this._tenantName.value,
      previousStatus,
    });
    this.addDomainEvent(event);
  }

  /**
   * 更新租户档案
   *
   * @param command - 更新命令
   */
  public updateProfile(command: UpdateTenantProfileCommand): void {
    // 校验状态
    if (this._status.isArchived()) {
      throw new DomainException("已归档的租户不能更新档案");
    }

    // 更新档案
    this._profile = this._profile.update({
      legalName: command.legalName,
      registrationCode: command.registrationCode,
      industry: command.industry,
    });
    this.touch(command.updatedBy ?? null);

    // 触发档案更新事件
    const event = new TenantProfileUpdatedEvent(
      this.buildEventProps(command.updatedBy ?? null),
      {
        profile: this._profile,
      },
    );
    this.addDomainEvent(event);
  }

  /**
   * 校验聚合不变式
   *
   * @throws {DomainException} 当聚合状态不满足业务规则时抛出
   */
  protected ensureValidState(): void {
    // 租户名称不能为空（由值对象保证）
    // 状态必须有效（由值对象保证）
    // 联系人信息必须有效（由值对象保证）
    // 上下文必须有效（由值对象保证）
  }

  /**
   * 构建领域事件属性
   *
   * @param triggeredBy - 触发事件的用户
   * @returns 领域事件属性
   */
  private buildEventProps(triggeredBy: UserId | null): DomainEventProps {
    return {
      eventId: UuidGenerator.generate(),
      occurredAt: DateTimeValueObject.now(),
      aggregateId: this.id.toString(),
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      departmentId: this.departmentId,
      triggeredBy,
      auditMetadata: this.auditTrail,
      softDeleteStatus: this.softDeleteStatus,
    };
  }

  /**
   * 获取租户名称
   */
  public get tenantName(): TenantName {
    return this._tenantName;
  }

  /**
   * 获取租户状态
   */
  public get status(): TenantStatus {
    return this._status;
  }

  /**
   * 获取联系人信息
   */
  public get contactInfo(): TenantContactInfo {
    return this._contactInfo;
  }

  /**
   * 获取组织上下文
   */
  public get context(): TenantContext {
    return this._context;
  }

  /**
   * 获取租户档案
   */
  public get profile(): TenantProfile {
    return this._profile;
  }
}
