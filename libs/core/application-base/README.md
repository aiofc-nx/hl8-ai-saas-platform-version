# @hl8/application-base

`@hl8/application-base` 提供命令、查询、Saga、权限校验与审计协同的应用层基线能力，帮助业务模块在 1 个工作日内完成接入。

## 核心特性

- 标准化的 `SecurityContext` 与租户/组织/部门范围校验工具。
- 基于 CASL 的命令、查询处理器基类，自动执行权限校验。
- 审计协调器与拦截器，统一写入审计日志并复用平台日志规范。
- Saga 抽象，支持顺序执行与补偿策略。
- 动态模块 `ApplicationCoreModule.register()`，便于在 NestJS 中快速集成。

## 快速开始

1. **注册模块**

   ```ts
   @Module({
     imports: [
       ApplicationCoreModule.register({
         abilityService: { provide: ABILITY_SERVICE_TOKEN, useClass: AbilityServiceImpl },
         auditService: { provide: AUDIT_SERVICE_TOKEN, useClass: AuditServiceImpl },
       }),
     ],
   })
   export class AppModule {}
   ```

2. **实现命令处理器**

   ```ts
   export class AssignRoleCommand extends CaslCommandBase<void> {
     public constructor(
       context: SecurityContext,
       public readonly payload: { tenantId: string; roleId: string },
     ) {
       super(context);
     }

     public abilityDescriptor() {
       return { action: "manage", subject: "AssignRoleCommand" };
     }

     public override auditPayload() {
       return this.payload;
     }
   }
   ```

3. **继承命令处理器基类**
   ```ts
   @CommandHandler(AssignRoleCommand)
   export class AssignRoleCommandHandler extends CaslCommandHandler<AssignRoleCommand, void> {
     protected async handle(command: AssignRoleCommand): Promise<void> {
       this.assertTenantScope(command, command.payload.tenantId);
       // 领域逻辑...
     }
   }
   ```

更详细的接入示例见 `specs/002-define-application-base/quickstart.md`。

## 测试

```bash
pnpm --filter @hl8/application-base test
```

## 运维核对清单

- 核查 TSDoc 是否覆盖公共 API。
- 确认命令/查询/协同器的单元测试通过，覆盖率 ≥80%。
- 在集成测试中验证权限拒绝与审计记录链路。
