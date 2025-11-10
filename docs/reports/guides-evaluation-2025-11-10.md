# 多租户分层指南合规评估报告

## 1. 评估背景

依据《hl8-aisaas-platform Constitution》（版本 1.2.0）之核心原则，尤其关注「I. 中文优先原则」「II. 代码即文档原则」「III. 技术栈约束原则」「VI. 日志模块使用规范」及附加约束（DDD + Clean Architecture + CQRS + Event Sourcing + EDA），对 `docs/guides` 目录下四份多租户分层指南进行一次全面合规性复核。

## 2. 评估范围

- `docs/guides/application-layer-guide.md`
- `docs/guides/domain-layer-guide.md`
- `docs/guides/infrastructure-layer-guide.md`
- `docs/guides/interface-layer-guide.md`

## 3. 合规性结论

| 文档           | 合规结论 | 主要违章条款      | 备注                                           |
| -------------- | -------- | ----------------- | ---------------------------------------------- |
| 应用层指南     | 未合规   | II、VIII 附加约束 | 示例代码存在未声明依赖、接口不一致问题         |
| 领域层指南     | 未合规   | II、附加约束      | 示例代码语法错误、异步调用位置不合法           |
| 基础设施层指南 | 未合规   | II、III、VI       | 仓储基类定义冲突、示例违背日志规范             |
| 接口层指南     | 未合规   | II、VI            | 多处直接使用 Nest `Logger`，未落实日志统一规范 |

## 4. 关键问题与证据

### 4.1 领域层指南：示例代码无法编译，违反「代码即文档原则」

- `Department.create` 在同步工厂函数中使用 `await`，破坏 TypeScript 语法；示例无法直接复用，违背“代码即文档”要求：

```292:310:docs/guides/domain-layer-guide.md
  public static create(creation: DepartmentCreation): Department {
    const path = creation.parentId ?
      DepartmentPath.createChild(creation.parentId) :
      DepartmentPath.root();

    const level = creation.parentId ?
      await this.calculateLevel(creation.parentId) + 1 : 0;
```

- 多处示例访问 `this.departmentRepository` 等依赖，但类中未展示注入方式，读者无法按图复现，违反附加约束中“DDD + Clean Architecture”的可实现性要求：

```438:465:docs/guides/domain-layer-guide.md
  public async joinDepartment(command: JoinDepartmentCommand): Promise<void> {
    // 验证用户是否在父组织中
    const department = await this.departmentRepository.findById(command.departmentId);
    if (!this._organizationMemberships.has(department.organizationId.value)) {
      throw new AuthorizationError('用户不在该部门所属的组织中');
    }
```

### 4.2 基础设施层指南：示例违背技术栈与日志规范

- 仓储基类定义与接口同名，`implements MultiTenantRepository<T>` 会递归指向自身，无法通过类型检查，违反“代码即文档原则”：

```53:104:docs/guides/infrastructure-layer-guide.md
export abstract class MultiTenantRepository<T extends MultiTenantAggregateRoot>
  implements MultiTenantRepository<T> {

  constructor(
    protected readonly em: EntityManager,
    protected readonly mapper: EntityMapper<T>,
    protected readonly tenantContext: TenantContext,
    protected readonly logger: Logger
  ) {}
```

- `TenantConnectionManager` 构造函数内直接 `await`，与 TypeScript 语法冲突，示例无法落地：

```491:505:docs/guides/infrastructure-layer-guide.md
  constructor(private readonly configService: ConfigService) {
    this.baseORM = await MikroORM.init(MultiTenantMikroORMConfig.createDefaultConfig());
  }
```

- 多个示例直接注入/实例化 `Logger`，未通过 `@hl8/logger` 输出，违反宪章 VI「日志模块使用规范」：

```137:168:docs/guides/infrastructure-layer-guide.md
export class MikroOrmOrganizationRepository
  extends MultiTenantRepository<Organization>
  implements OrganizationRepository {

  constructor(
    em: EntityManager,
    mapper: OrganizationMapper,
    tenantContext: TenantContext,
    logger: Logger
  ) {
    super(em, mapper, tenantContext, logger);
  }
```

### 4.3 应用层指南：示例依赖未声明，难以贯彻 DDD + CQRS

- `CreateDepartmentHandler` 使用 `this.organizationRepository` 等依赖但未在构造函数声明，导致示例不可执行，违背原则 II：

```347:429:docs/guides/application-layer-guide.md
export class CreateDepartmentHandler extends MultiTenantCommandHandler<CreateDepartmentCommand> {
  async execute(command: CreateDepartmentCommand): Promise<DepartmentId> {
    // 验证组织访问权限
    const organization = await this.organizationRepository.findById(
      command.organizationId,
      command.tenantId
    );
```

- 单元测试示例调用 `mockAbilityService.checkPermission`，与前文 `getAbilityForUser` API 不一致，导致示例无法照搬执行。

### 4.4 接口层指南：持续违反统一日志规范

- `MultiTenantController` 及异常过滤器等均直接实例化 `new Logger`，未按宪章 VI 要求通过 `@hl8/logger` —— 属于制度性违规：

```55:82:docs/guides/interface-layer-guide.md
export abstract class MultiTenantController {
  protected readonly logger = new Logger(this.constructor.name);

  // 获取当前租户上下文
  protected getCurrentTenantContext(@TenantContext() context: TenantContext): TenantContext {
```

```884:973:docs/guides/interface-layer-guide.md
@Catch()
export class MultiTenantExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MultiTenantExceptionFilter.name);
```

## 5. 风险评估

- **实现偏差风险**：示例代码无法直接编译，将误导后续模块开发；一旦按图实现，可能引入运行时错误或架构偏移。
- **制度违约风险**：日志统一、技术栈约束已被文件示例破坏，若照搬会造成代码库广泛违章。
- **知识传递风险**：宪章强调“代码即文档”，当前指南尚未达到可复用标准，影响新成员上手效率。

## 6. 整改建议

1. **统一代码示例**：逐一跑通 TypeScript 编译，补齐依赖注入与上下文说明，必要时在文档中显式标注“伪代码”或“示意”。
2. **日志模块整改**：全文将 `Logger` 替换为 `@hl8/logger` 提供的能力，并补充示例配置。
3. **接口一致性**：更新测试示例与正文示例所依赖的接口名称，避免 `checkPermission`/`getAbilityForUser` 混用。
4. **制度验证流程**：在文档发版前执行「Constitution Check」，确保指南自身成为可执行规范样板。

## 7. 后续行动项

- 文档维护团队需根据本报告启动修订，建议按模块拆分任务，引入 lint/compile 校验。
- 评估结论应纳入下次季度合规审查，复检修订成果，确保宪章落实。

## 8. 整改计划

### 8.1 驱动与治理安排

- **责任人指派**：由架构组牵头，分别指定应用层、领域层、基础设施层、接口层章节的文档 Owner，并在治理周会确认。
- **时间节奏**：两周内完成草案修订与交叉 Review；第三周组织一次 Constitution Check，确认全部示例可编译并符合日志/异常/配置规范。
- **质量门禁**：新增「指南静态校验」流水线，执行 TypeScript 编译验证、lint、以及 `@hl8/logger` 使用扫描。

### 8.2 分文档整改清单

1. **`docs/guides/application-layer-guide.md`**
   - 补充 `CreateDepartmentHandler`、`GetOrganizationTreeHandler` 等示例的构造函数依赖注入示例，统一 `CaslAbilityService` API 描述。
   - 将单元测试示例改为调用 `getAbilityForUser` 等正式接口，确保测试片段可直接执行。
   - 标注「伪代码」与「可直接落地示例」的区别，避免读者误解。

2. **`docs/guides/domain-layer-guide.md`**
   - 调整 `Department.create` 等工厂函数，移除非法的 `await`；如需异步层级计算，另起异步工厂或服务示例。
   - 展开聚合根依赖注入说明（如 `departmentRepository`），补充接口定义或说明前置条件。
   - 对“层级操作”“权限计算”示例进行 TypeScript 编译验证，确保符合 DDD + CQRS 组合要求。

3. **`docs/guides/infrastructure-layer-guide.md`**
   - 重命名 `MultiTenantRepository` 示例类或接口，避免自引用；补充泛型 Mapper、EntityManager 的完整签名。
   - 将所有 `Logger` 替换为 `@hl8/logger`，并增加简要初始化说明。

- 修改 `TenantConnectionManager` 构造逻辑，改为 `async init()` 或 `onModuleInit`，保证示例合法。
- 为仓储示例列出必需的异常类型来源（如 `RepositoryError`）。

4. **`docs/guides/interface-layer-guide.md`**
   - 替换控制器、守卫、过滤器中的 `new Logger` 为 `@hl8/logger`，并附带配置示例。
   - 完善 `TenantIdentificationService` 依赖（`TenantContext.fromTenant`、`jwt.decode`）的来源说明或替换实现。
   - 明确 IP/UA 取值方式，移除硬编码常量，指向 Nest 请求上下文示例。

### 8.3 交付与验证

- **提交物**：四份指南修订后的 Markdown、相关示例代码片段或补充脚手架。
- **验证清单**：
  - TypeScript 编译通过；
  - 示例代码遵循 `@hl8/logger`、`@hl8/config`、`libs/infra/exceptions` 等统一模块；
  - 关键章节补充 TSDoc/中文注释说明，符合“代码即文档”。
- **审批流程**：修订 PR 需由架构组 + QA 双人审批，并附上本报告对照清单，确认所有问题闭环。

---

_报告日期：2025-11-10_  
_撰写人：GPT-5 Codex（自动化评估代理）_
