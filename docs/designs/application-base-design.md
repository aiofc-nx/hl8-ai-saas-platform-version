## @hl8/application-base 详细设计

> 关联基线：`docs/designs/application-base-baseline.md`

### 1. 背景与目标
- 为拆分后的 `@hl8/application-base` 提供架构视图、目录组织、关键流程与示例代码。
- 指导领域团队在应用层复用统一的命令/查询、Saga、权限协同与审计拦截能力。
- 明确应用层与 `@hl8/infrastructure-base` 的接口分工，确保依赖单向、上下文隔离。

> **实现状态（2025-11-12）**：核心组件已在 `libs/core/application-base` 交付，命令/查询基类、CASL 协调器、审计协调器及拦截器均具备单元与集成测试。

### 2. 架构视图
```
┌──────────────────────────────┐
│ Application Core             │
│ ┌──────────────────────────┐ │
│ │ CQRS Layer               │ │
│ │  ├─ Commands             │ │
│ │  ├─ Queries              │ │
│ │  └─ Validators           │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Saga & Orchestration     │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ CASL Coordination        │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Audit Coordination       │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
            │
            ▼ 接口依赖
┌──────────────────────────────┐
│ @hl8/infrastructure-base      │
└──────────────────────────────┘
```

### 3. 目录与模块组织
```
libs/application-base/
├── casl/
│   ├── casl-ability-coordinator.ts
│   └── casl-ability.guard.ts
├── cqrs/
│   ├── commands/
│   │   ├── casl-command.base.ts
│   │   └── casl-command-handler.base.ts
│   ├── queries/
│   │   ├── casl-query.base.ts
│   │   └── casl-query-handler.base.ts
│   ├── sagas/
│   │   └── base-saga.ts
│   ├── interceptors/
│   │   ├── audit-command.interceptor.ts
│   │   └── audit-query.interceptor.ts
│   └── validators/
│       └── command-validator.ts
├── audit/
│   └── audit-coordinator.ts
└── interfaces/
    ├── application-core.module.ts
    └── security-context.interface.ts
```

### 4. 核心组件设计

#### 4.1 命令/查询基类
```typescript
export interface SecurityContext {
  readonly tenantId: TenantId;
  readonly organizationIds?: OrganizationId[];
  readonly departmentIds?: DepartmentId[];
  readonly userId: UserId;
}

export abstract class CaslCommandBase<TResponse = void> {
  protected constructor(public readonly context: SecurityContext) {}
}

export abstract class CaslCommandHandler<
  TCommand extends CaslCommandBase,
  TResponse,
> {
  protected constructor(
    private readonly abilityCoordinator: CaslAbilityCoordinator,
    private readonly auditCoordinator: AuditCoordinator,
  ) {}

  public async execute(command: TCommand): Promise<TResponse> {
    await this.ensureScope(command.context);
    await this.abilityCoordinator.ensureAuthorized(command);
    const result = await this.handle(command);
    await this.auditCoordinator.record(command, result);
    return result;
  }

  protected abstract handle(command: TCommand): Promise<TResponse>;

  protected async ensureScope(context: SecurityContext): Promise<void> {
    // 调用租户、组织、部门断言
  }
}
```

- Command/Query Handler 通过依赖注入获取 `CaslAbilityCoordinator` 与 `AuditCoordinator`。
- `SecurityContext` 由入口层构建、通过 `AsyncLocalStorage` 注入。

#### 4.2 Saga 编排
```typescript
export interface SagaStep<TContext> {
  readonly name: string;
  execute(context: TContext): Promise<void>;
  compensate?(context: TContext, error: Error): Promise<void>;
}

export abstract class BaseSaga<TContext> {
  protected readonly steps: SagaStep<TContext>[] = [];

  protected constructor(protected readonly eventPublisher: EventPublisher) {}

  public async run(context: TContext): Promise<void> {
    for (const step of this.steps) {
      try {
        await step.execute(context);
      } catch (error) {
        await this.compensate(step, context, error as Error);
        throw error;
      }
    }
  }

  private async compensate(
    failedStep: SagaStep<TContext>,
    context: TContext,
    error: Error,
  ): Promise<void> {
    for (const step of [...this.steps].reverse()) {
      if (step === failedStep && step.compensate) {
        await step.compensate(context, error);
      }
    }
  }
}
```

- Saga 步骤通过接口调用基础设施服务（事件发布、缓存刷新等）。
- 必须显式声明补偿逻辑，确保跨租户操作可回滚。

#### 4.3 CASL 能力协调
```typescript
export class CaslAbilityCoordinator {
  public constructor(private readonly abilityService: AbilityService) {}

  public async ensureAuthorized(command: CaslCommandBase): Promise<void> {
    const ability = await this.abilityService.resolveAbility(
      command.context,
    );
    if (!ability.can(command.constructor.name, command)) {
      throw new ForbiddenException("当前操作不具备执行权限");
    }
  }
}
```

- `AbilityService` 由 `@hl8/infrastructure-base` 提供，负责缓存与重建。
- 协调器仅负责应用层校验及权限不足时的异常抛出。

#### 4.4 审计协调
```typescript
export class AuditCoordinator {
  public constructor(private readonly auditService: AuditService) {}

  public async record(command: CaslCommandBase, result: unknown): Promise<void> {
    await this.auditService.append({
      tenantId: command.context.tenantId,
      userId: command.context.userId,
      commandId: command.constructor.name,
      resultSnapshot: result,
    });
  }
}
```

- `AuditService` 接口来自基础设施层。
- 记录内容必须与平台审计规范一致，使用中文描述。

### 5. 模块装配
```typescript
@Module({
  imports: [],
  providers: [
    CaslAbilityCoordinator,
    AuditCoordinator,
    {
      provide: AbilityServiceToken,
      useExisting: InfrastructureAbilityService,
    },
  ],
  exports: [CaslAbilityCoordinator, AuditCoordinator],
})
export class ApplicationCoreModule {}
```

- `ApplicationCoreModule` 仅导出协调器与基类，不直接绑定具体基础设施实现。
- 实现类在业务模块中通过 `InfrastructureCoreModule` 注入。

### 6. 流程示例
1. 接口层接收命令请求，构建 `SecurityContext`，封装为 `AssignRoleCommand`。
2. `AssignRoleCommandHandler`（继承 `CaslCommandHandler`）执行：
   - 校验租户/组织/部门上下文。
   - 调用 `CaslAbilityCoordinator.ensureAuthorized`。
   - 执行业务逻辑（调用聚合、保存仓储）。
   - 调用 `AuditCoordinator.record`。
3. 聚合产生的领域事件由基础设施事件发布器处理。

### 7. 测试策略
- 命令/查询处理器测试需模拟 `AbilityService`、`AuditService` 接口。
- Saga 测试需覆盖成功、补偿、异常路径。
- 协调器测试需验证权限不足时抛出平台定义的异常。
- 提供测试基座：`createSecurityContextMock()`、`createCommandHandlerTestHarness()`。

### 8. 后续扩展
- 支撑多语言国际化时，可在协调器中引入翻译服务。
- 若需引入命令超时、重试策略，可提供装饰器扩展点。
- 持续追踪 `@hl8/infrastructure-base` 接口变更，保持兼容。

