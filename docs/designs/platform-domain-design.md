## 平台级 DDD 领域层通用能力设计规范（详细设计）

> 关联基线：`docs/designs/platform-domain-baseline.md`

### 1. 背景与目标
- **统一建模**：提供多租户 SaaS 平台统一的领域层实践指南，确保租户、组织、用户、IAM 等模块沿用一致的 DDD 语言与建模方式。
- **补充细节**：在基线文档基础上，扩展领域组件的交互流程、目录规范、示例代码、测试治理及落地步骤。
- **确保纯净性**：明确领域层与应用层、基础设施层的依赖边界，保障聚合根与值对象不受外部框架侵染。

### 2. 总体架构视图
```
┌──────────────────────────────┐
│ Interface Layer               │
└──────────────┬───────────────┘
               │ 调用命令/查询
┌──────────────▼───────────────┐
│ Application Layer             │
│ (CQRS + ES + EDA)             │
└──────────────┬───────────────┘
               │ 调用聚合/服务
┌──────────────▼───────────────┐
│ Domain Layer (本规范)         │
│ 聚合根/实体/值对象/事件/仓储      │
└──────────────┬───────────────┘
               │ 定义接口
┌──────────────▼───────────────┐
│ Infrastructure Layer          │
│ 仓储实现/ORM/消息/缓存          │
└──────────────────────────────┘
```

### 3. 目录与模块组织
```
libs/core/domain-base/
├── aggregates/
│   ├── aggregate-root.base.ts       # 聚合根抽象基类（含审计、租户/组织/部门断言）
│   └── aggregate-id.value-object.ts # 聚合唯一标识（UUID v4）
├── entities/
│   └── entity.base.ts               # 聚合内部实体基类（可选审计）
├── events/
│   ├── domain-event.base.ts         # 领域事件基类（含上下文与操作人）
│   └── domain-event-dispatcher.interface.ts   # (可选) 领域事件调度器接口
├── repositories/
│   └── repository.interface.ts      # 仓储接口规范
├── value-objects/
│   ├── tenant-id.vo.ts
│   ├── user-id.vo.ts
│   ├── organization-id.vo.ts
│   ├── department-id.vo.ts
│   └── date-time.value-object.ts
├── auditing/
│   ├── audit-trail.value-object.ts  # 审计轨迹
│   └── soft-delete-status.value-object.ts     # 软删除状态
├── services/
│   └── domain-service.interface.ts
├── exceptions/
│   └── domain-exception.base.ts
└── utils/
    ├── domain-guards.ts             # 不变式守卫、校验工具
    └── uuid-generator.ts            # 标识生成（UUID v4）
```

- **扩展目录**：支持在 `libs/domain-extensions/` 中提供规格模式、聚合快照等可选功能。
- **依赖方式**：领域模块通过 `import { AggregateRootBase } from "@hl8/domain-base";` 等方式引入公共能力。

### 4. 核心组件设计

#### 4.1 聚合根与实体
```typescript
export interface AggregateRootProps<TId extends AggregateId> {
  readonly id: TId;
  readonly tenantId: TenantId;
  readonly organizationId?: OrganizationId;
  readonly departmentId?: DepartmentId;
  readonly auditTrail?: AuditTrail;
  readonly softDeleteStatus?: SoftDeleteStatus;
  readonly version?: number;
}

export abstract class AggregateRootBase<TId extends AggregateId> extends EntityBase<TId> {
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
    this._auditTrail = props.auditTrail ?? AuditTrail.create({ createdBy: null });
    this._softDeleteStatus = props.softDeleteStatus ?? SoftDeleteStatus.create();
    this._version = props.version ?? 0;
  }

  protected abstract ensureValidState(): void;

  protected touch(actor: UserId | null): void {
    this._auditTrail = this._auditTrail.update({ updatedBy: actor ?? null });
  }

  protected markDeleted(actor: UserId | null): void {
    this._softDeleteStatus = this._softDeleteStatus.markDeleted(actor ?? null);
    this.touch(actor);
  }

  protected restore(actor: UserId | null): void {
    this._softDeleteStatus = this._softDeleteStatus.restore(actor ?? null);
    this.touch(actor);
  }

  protected assertSameTenant(tenantId: TenantId, message?: string): void {
    if (!this._tenantId.equals(tenantId)) {
      throw new DomainException(message ?? "跨租户操作被拒绝");
    }
  }

  protected assertSameOrganization(organizationId?: OrganizationId, message?: string): void {
    if (!this._organizationId) {
      return;
    }
    if (!organizationId || !this._organizationId.equals(organizationId)) {
      throw new DomainException(message ?? "跨组织操作被拒绝");
    }
  }

  protected assertSameDepartment(departmentId?: DepartmentId, message?: string): void {
    if (!this._departmentId) {
      return;
    }
    if (!departmentId || !this._departmentId.equals(departmentId)) {
      throw new DomainException(message ?? "跨部门操作被拒绝");
    }
  }

  protected addDomainEvent(event: DomainEventBase): void {
    this.domainEvents.push(event);
  }

  public pullDomainEvents(): DomainEventBase[] {
    if (this.domainEvents.length === 0) {
      return [];
    }
    const events = [...this.domainEvents];
    this.domainEvents.length = 0;
    return events;
  }
}
```

- **要点**：
  - 构造函数必须调用 `ensureValidState()` 保持不变式。
  - 聚合根公开读方法（getters），写方法通过显式命令（如 `assignRole`）。
  - 聚合根内部集合使用不可变结构或封装操作，避免外部直接修改。

#### 4.2 值对象
```typescript
interface AuditTrailProps {
  readonly createdAt: DateTimeValueObject;
  readonly createdBy: UserId | null;
  readonly updatedAt: DateTimeValueObject;
  readonly updatedBy: UserId | null;
}

export class AuditTrail extends ValueObjectBase<AuditTrailProps> {
  private constructor(props: AuditTrailProps) {
    super(props);
  }

  public static create(initial: {
    createdBy?: UserId | null;
    updatedBy?: UserId | null;
  }): AuditTrail {
    const now = DateTimeValueObject.now();
    const createdBy = initial.createdBy ?? null;
    const updatedBy = initial.updatedBy ?? initial.createdBy ?? null;

    return new AuditTrail({
      createdAt: now,
      createdBy,
      updatedAt: now,
      updatedBy,
    });
  }

  public update(change: { updatedBy?: UserId | null }): AuditTrail {
    return new AuditTrail({
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      updatedAt: DateTimeValueObject.now(),
      updatedBy: change.updatedBy ?? this.updatedBy ?? null,
    });
  }

  public get createdAt(): DateTimeValueObject {
    return this.props.createdAt;
  }

  public get updatedAt(): DateTimeValueObject {
    return this.props.updatedAt;
  }
}

interface SoftDeleteProps {
  readonly isDeleted: boolean;
  readonly deletedAt: DateTimeValueObject | null;
  readonly deletedBy: UserId | null;
}

export class SoftDeleteStatus extends ValueObjectBase<SoftDeleteProps> {
  private constructor(props: SoftDeleteProps) {
    super(props);
  }

  public static create(initial?: {
    isDeleted?: boolean;
    deletedAt?: DateTimeValueObject | null;
    deletedBy?: UserId | null;
  }): SoftDeleteStatus {
    return new SoftDeleteStatus({
      isDeleted: initial?.isDeleted ?? false,
      deletedAt: initial?.deletedAt ?? null,
      deletedBy: initial?.deletedBy ?? null,
    });
  }

  public markDeleted(actor: UserId | null = null): SoftDeleteStatus {
    if (this.isDeleted) {
      return this;
    }

    return new SoftDeleteStatus({
      isDeleted: true,
      deletedAt: DateTimeValueObject.now(),
      deletedBy: actor ?? null,
    });
  }

  public restore(actor: UserId | null = null): SoftDeleteStatus {
    if (!this.isDeleted) {
      return this;
    }

    return new SoftDeleteStatus({
      isDeleted: false,
      deletedAt: null,
      deletedBy: actor ?? null,
    });
  }

  public get isDeleted(): boolean {
    return this.props.isDeleted;
  }
}
```

- 所有值对象：
  - 使用 `create` 工厂方法执行校验。
  - 通过 `equals` 与 `hashCode` 实现等值判断。
  - 注解中文 TSDoc，说明业务语义与使用场景。

#### 4.3 领域事件
```typescript
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

  public get tenantId(): TenantId {
    return this.props.tenantId;
  }

  public abstract eventName(): string;
}
```

- 领域事件命名如 `RoleAssignedEvent`、`TenantDeactivatedEvent`。
- 聚合根在状态变更方法中调用 `addDomainEvent(new RoleAssignedEvent(...))`。
- 应用层在保存聚合后拉取事件并交给 EventBus。

#### 4.4 仓储接口
```typescript
export interface Repository<TAggregate extends AggregateRootBase<TId>, TId extends AggregateId> {
  findById(id: TId): Promise<TAggregate | null>;
  findBy(criteria: RepositoryCriteria): Promise<TAggregate[]>;
  save(aggregate: TAggregate): Promise<void>;
  delete(id: TId): Promise<void>;
}
```

- 仓储接口：
  - 定义聚合的持久化契约，禁止暴露 ORM 细节到领域层。
  - 封装多租户隔离条件（`TenantId` 等）在实现层处理。
- 实现层（MikroORM、Prisma 等）需映射聚合到持久化模型，并处理并发控制。

#### 4.5 领域服务
- 适用于跨聚合、复杂规则（如跨租户审批流）：
  ```typescript
  export interface DomainService {
    // marker interface
  }
  ```
- 实现示例 `RoleAssignmentPolicyService`，提供 `canAssignRole()` 等方法。
- 领域服务只负责领域决策，外部资源访问通过仓储注入。

### 5. 模板与脚手架
- 提供 `pnpm run scaffold:aggregate --name UserAuthorization` 等脚手架命令，生成聚合根、值对象、事件骨架与审计字段模板。
- 模板文件包含 TSDoc、Guard 校验、事件发布与审计/软删除示例，降低团队建模门槛。

### 6. 领域建模流程
1. **领域探索**：事件风暴、用户故事 → 识别聚合与上下文。
2. **定义值对象**：确定业务标识符与状态枚举，统一存放于共享库。
3. **设计聚合**：编写聚合根与实体，明确不变式和领域行为。
4. **声明领域事件**：记录聚合状态变更，确保携带租户/组织上下文。
5. **定义仓储接口**：描述聚合加载与持久化方式。
6. **编写测试**：聚合、值对象、领域服务的单元测试；事件契约测试。
7. **更新文档**：领域设计文档中引用本规范，并记录特定扩展。

### 7. 与应用层协作
- 应用层命令/查询处理器遵循以下流程：
  1. 从仓储加载聚合（如新建则使用 UUID 工厂生成聚合 ID），并在命令进入时校验租户上下文。
  2. 调用聚合方法执行业务操作。
  3. 保存聚合并拉取领域事件。
  4. 将事件发布至 CQRS/事件总线。
- 领域层不关心 CASL 权限、审计记录等逻辑，由应用层负责。
- 事件命名、载荷须与应用层事件溯源规范保持一致，避免契约不一致。

### 8. 测试策略
- **聚合测试**：使用 in-memory 仓储或 mock 仓储模拟依赖，验证不变式、事件生成、ID 生成、审计轨迹与软删除状态更新。
- **值对象测试**：验证构造校验、等值比较。
- **领域服务测试**：使用 stub 仓储、值对象，确保业务规则正确。
- **契约测试**：对领域事件结构建立 fixture，供应用层与其他模块共享。
- 提供 `libs/core/domain-testing/` 工具包（mock 仓储、事件断言器、值对象工厂）。

### 9. 质量与治理
- 代码需通过 ESLint、TypeScript 严格模式；所有公共 API 注释使用中文 TSDoc。
- 版本变更在 `CHANGELOG.md` 记录，重大变更需评审并通知各领域。
- 遵循平台宪章：日志使用 `@hl8/logger`；审计字段必须在聚合方法中通过 `touch` 或类似方法更新，禁止绕过聚合直接修改持久化层。

### 10. 参考资料
- `docs/designs/platform-domain-baseline.md`
- `docs/designs/platform-cqrs-es-eda-baseline.md`
- `docs/designs/platform-cqrs-es-eda-design.md`
- `docs/designs/iam-guide.md`
- `docs/designs/iam-domain-boundary-supplement.md`

---

本设计规范与领域层基线文档配套使用，为平台层提供可复用的 DDD 能力。各业务团队应先参考此规范，再结合自身领域文档细化聚合边界、领域语言与上下文协作策略。任何扩展或定制能力必须先在平台层登记，并由架构团队评审通过。

