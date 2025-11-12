## 平台级 DDD 领域层通用能力设计规范

### 1. 文档背景与目标
- 明确领域层（Domain Layer）在多租户 SaaS 平台中的统一建模规范，确保租户、组织、用户、IAM 等领域在 DDD + Clean Architecture 约束下保持纯净性与一致的领域语言。
- 补充 `docs/designs/platform-cqrs-es-eda-design.md` 未覆盖的领域层能力，定义聚合根、实体、值对象、领域事件、仓储接口等基础设施。
- 指导各业务模块复用领域层基线，减少重复实现并保证跨团队一致性。

### 2. 设计原则
1. **领域纯净性**：领域层仅依赖自身和值对象，不依赖应用层（CQRS、CASL 等）与基础设施实现，保持可测试性与移植性。
2. **统一领域语言**：公共值对象、枚举、异常等通过共享库管理，确保跨模块术语一致。
3. **聚合边界明确**：聚合根负责维护不变式，聚合内部对象不得被外部直接修改。
4. **事件驱动一致**：领域事件由聚合根发布，应用层负责订阅处理和跨界集成。
5. **仓储接口隔离**：领域层定义仓储接口，具体实现由基础设施层提供，遵循依赖倒置。
6. **内建审计能力**：所有聚合根与需要追踪的实体需具备统一的审计字段（创建者、创建时间、更新者、更新时间等），便于应用层记录审计日志。
7. **统一标识策略**：聚合根及聚合内实体的标识必须使用平台提供的 UUID v4 生成器，确保跨服务、跨租户的全局唯一性。
8. **软删除合规**：聚合根需支持软删除与恢复，记录删除/恢复时间与操作者；仓储默认过滤软删除记录，除非业务明确要求查询。
9. **租户/组织/部门上下文隔离**：所有聚合根、实体、值对象、领域事件必须显式持有 `tenantId`，并在需要时包含 `organizationId`、`departmentId` 等上下文；领域层需阻止跨租户/跨组织/跨部门操作，命令与事件必须传递完整上下文以保障下游隔离。

### 3. 目录与模块结构
```
libs/domain-core/
├── aggregates/
│   ├── aggregate-root.base.ts        # 含审计字段、不变式守卫、租户/组织/部门上下文断言
│   └── aggregate-id.value-object.ts  # UUID v4 聚合标识
├── entities/
│   └── entity.base.ts                # 可选审计信息支持
├── events/
│   ├── domain-event.base.ts
│   └── domain-event-bus.interface.ts
├── repositories/
│   └── repository.interface.ts
├── value-objects/
│   ├── tenant-id.vo.ts
│   ├── user-id.vo.ts
│   ├── organization-id.vo.ts
│   └── department-id.vo.ts
├── services/
│   └── domain-service.interface.ts
├── auditing/
│   ├── audit-trail.value-object.ts   # 统一审计轨迹
│   └── soft-delete-status.vo.ts      # 软删除状态（删除时间/操作者）
├── exceptions/
│   └── domain-exception.base.ts
└── utils/
    ├── domain-validation.ts          # 守卫/校验工具
    └── uuid-generator.ts             # UUID v4 生成器
```

- `domain-core` 作为单独 npm 包或 pnpm workspace 包提供，所有领域模块通过依赖导入。
- 值对象若与具体业务强相关（如权限类型），可在领域模块内扩展，但必须继承平台提供的基类或满足相同规范。

### 4. 核心组件与约束

#### 4.1 聚合根与实体
- **AggregateRootBase**：
  - 提供 `id`、`tenantId`、`createdAt`、`createdBy`、`updatedAt`、`updatedBy`、`version` 等审计字段。
  - 默认包含软删除状态（如 `deletedAt`、`deletedBy`、`isDeleted`），并提供恢复方法。
  - 内置领域事件队列（`addDomainEvent`、`pullDomainEvents`）。
  - 强制执行不变式检查（通过 protected `ensureValidState` 方法实现），并在公共操作前通过 `assertTenantContext` 类方法校验租户上下文。
- **EntityBase**：供聚合内部实体继承，可选开启审计支持（适合需要记录操作人的内部实体）。
- **约束**：
  - 聚合根构造器为 protected，实例通过工厂方法/静态构造函数创建。
  - 聚合根不可直接暴露可变集合，需通过领域方法封装操作（添加角色、撤销权限等）。
  - 聚合 root 内部状态变更后必须调用 `addDomainEvent` 推送事件，供应用层处理。
  - 聚合根与聚合内实体的标识须通过平台 UUID 工具生成，禁止依赖数据库自增或自定义格式。
  - 软删除仅更新审计/状态，不允许直接物理删除；恢复需通过领域方法显式执行。
  - 聚合内任何引用和操作必须保持租户上下文一致，禁止跨租户引用；如需跨租户协作，应通过事件或应用层流程完成。
  - 基类提供 `assertSameTenant` / `assertSameOrganization` / `assertSameDepartment` 守卫，聚合方法在访问跨上下文资源前必须显式调用。
  - `touch`、`markDeleted`、`restore` 负责更新审计轨迹与软删除状态，应用层不得绕过聚合直接操作审计字段。

#### 4.2 值对象
- **ValueObjectBase**：
  - 提供不可变构造、等值比较 (`equals`)。
  - 所有值对象须通过静态工厂（`create`）或命名构造函数创建，并执行参数校验。
- **通用值对象**：
  - `TenantId`、`UserId`、`OrganizationId`、`DepartmentId` 等在共享库提供。
  - 时间类值对象统一封装 Luxon（`DateTimeValueObject`），避免直接使用原生日期。
- **约束**：
  - 值对象必须使用中文 TSDoc 描述业务语义。
  - 禁止在领域层传递裸字符串/数字作为 ID 或状态。

#### 4.3 领域事件
- **DomainEventBase**：
  - 字段包含 `eventId`、`occurredAt`、`aggregateId` 等。
  - 必须携带 `tenantId` 等跨模块必要上下文，防止事件丢失租户信息。
- **事件发布流程**：
  1. 聚合根通过 `addDomainEvent` 收集事件。
  2. 应用层在保存聚合后调用 `publishDomainEvents` 将事件推至事件总线。
  3. 事件处理器（可在应用层或基础设施层）订阅并处理。
- **约束**：
  - 领域事件命名采用 `PastTense + Event` 格式（如 `RoleAssignedEvent`）。
  - 事件载荷需要满足跨服务契约，禁止包含内部隐私字段。
  - 事件应包含必要审计信息（操作人、时间等），以便应用层记录。
  - 针对软删除/恢复需提供对应领域事件，确保下游读模型能够同步状态。
  - 事件必须携带 `tenantId`（以及必要的 `organizationId`、`departmentId`），以保障下游服务进行租户隔离。

#### 4.4 仓储接口
- **RepositoryInterface**：
  - 标准方法：`save(aggregate)`, `findById(id)`, `findBy(criteria)`, `delete(id)`。
  - 以 `AggregateRepository` 命名规范定义（如 `UserAuthorizationRepository`）。
- **实现约束**：
  - 领域层只定义接口，具体实现放在 `infrastructure/repositories`。
  - 实现须处理多租户隔离（默认在基础设施层注入 CASL/CQRS 过滤，领域层保持纯净）。
  - 仓储查询条件 `RepositoryFindByCriteria` 必须至少包含 `tenantId`，可选 `organizationId`、`departmentId`、`ids` 与 `includeDeleted`。
  - 仓储接口需使用平台提供的值对象，避免原始类型，并默认排除软删除记录（除非显式 `includeDeleted`）。

#### 4.5 领域服务
- 提供跨聚合的业务逻辑封装，需实现 `DomainService` 接口。
- 领域服务应保持无状态，依赖通过构造函数注入。
- 服务实现需记录审计与错误信息，调用 `AuditService` 等操作必须在应用层完成，领域层只暴露意图；若需要记录内部操作人，可通过审计值对象传递。

### 5. 与应用层基线的依赖关系
- 应用层（CQRS + ES + EDA）基于领域层构建，不允许反向引用。
- 应用层命令/查询处理器在执行领域逻辑前后，负责调用：
  - `aggregate.pullDomainEvents()` → 发布事件。
  - `AuditService` 记录操作。
  - `CaslAbilityService` 校验权限。
- 领域层文档需提供对应用层基线文档的引用，说明依赖方向与合作方式。

### 6. 领域建模流程
1. **识别领域边界**：通过事件风暴、业务访谈确定聚合根、实体、值对象。
2. **定义聚合根**：继承平台基类，实现构造与不变式校验。
3. **声明领域事件**：确保事件携带必要上下文。
4. **编写仓储接口**：定义聚合的持久化契约。
5. **编写值对象**：统一业务标识符与状态表达。
6. **更新领域文档**：记录术语、约束、协作边界。

### 7. 测试与质量要求
- 聚合根、值对象需编写旁置单元测试（覆盖不变式、行为、事件触发）。
- 提供领域层测试基座（mock 仓储、值对象工厂）。
- `@hl8/domain-testing` 提供 `AggregateTestHarness` 等工具，聚合测试必须优先复用以减少重复样板。
- 领域事件需编写契约测试，确保事件结构符合约定。
- 质量门槛：核心聚合单元测试覆盖率 ≥ 95%，领域服务 ≥ 90%。

### 8. 版本管理与扩展
- 领域层基线变更需记录在 `docs/designs/platform-domain-baseline.md` 中，并同步到 `CHANGELOG.md`。
- 新增值对象或领域基类需经平台架构评审，确保不会引入应用层依赖。
- 支持通过扩展包/目录（`libs/domain-extensions/`）提供可选的领域模式（如规格模式、聚合快照）。

### 9. 参考与链接
- `docs/designs/platform-cqrs-es-eda-baseline.md`
- `docs/designs/platform-cqrs-es-eda-design.md`
- `docs/designs/iam-guide.md`
- `docs/designs/iam-domain-boundary-supplement.md`

---

本规范与应用层通用能力文档共同构成平台级技术基线，领域团队在开展建模工作前需先审阅并与架构团队对齐，确保跨领域协作与演进过程中保持统一语言与实践。

