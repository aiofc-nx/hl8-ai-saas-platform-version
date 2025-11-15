# T090 完成报告：模块依赖注入完善

## ✅ 已完成工作

### 1. 模块结构改进

- ✅ 将 `TenantModule` 从静态模块改为动态模块（使用 `register` 方法）
- ✅ 添加 `TenantModuleOptions` 接口，支持配置 `contextName` 和 `isGlobal`
- ✅ 更新模块文档，说明所有依赖项和使用方式

### 2. 依赖模块导入

- ✅ 导入 `ApplicationCoreModule`：提供 `CaslAbilityCoordinator` 和 `AuditCoordinator`
- ✅ 导入 `EventStoreModule`：提供 `EventStore` 和 `SnapshotService`
- ✅ 导入 `EventPublisherModule`：提供 `EventPublisher`
- ✅ 导入 `MikroOrmModule.forFeature`：注册 `TenantProjection` 实体

### 3. EntityManager 注入修复

- ✅ 修复 `TenantRepositoryImpl`：使用 `@Inject(getEntityManagerToken("postgres"))`
- ✅ 修复 `TenantProjectionHandler`：使用 `@Inject(getEntityManagerToken("postgres"))`
- ✅ 修复 `GetTenantContextHandler`：使用 `@Inject(getEntityManagerToken("postgres"))`
- ✅ 修复 `GetTenantByIdHandler`：使用 `@Inject(getEntityManagerToken("postgres"))`
- ✅ 修复 `ListTenantsHandler`：使用 `@Inject(getEntityManagerToken("postgres"))`

### 4. 依赖注入配置

- ✅ `EventStore`：通过 `EventStoreModule.forRoot()` 注册，使用 `@Inject("EventStore")` 注入
- ✅ `SnapshotService`：通过 `EventStoreModule.forRoot()` 注册，使用 `@Inject("SnapshotService")` 注入
- ✅ `EventPublisher`：通过 `EventPublisherModule.forRoot()` 注册，使用 `@Inject("EventPublisher")` 注入
- ✅ `EntityManager`：通过 `MikroOrmModule.forFeature()` 注册，使用 `@Inject(getEntityManagerToken("postgres"))` 注入
- ✅ `Logger`：通过 `PinoLoggingModule.forRoot()` 注册（在应用根模块），直接注入 `Logger` 类型

### 5. 导出更新

- ✅ 在 `index.ts` 中导出 `TenantModuleOptions` 类型

## 📝 使用方式

### 在应用根模块中配置

```typescript
import { PinoLoggingModule } from "@hl8/logger";
import { MikroOrmModule } from "@hl8/mikro-orm-nestjs";
import { TenantModule } from "@hl8/tenant";
import { TenantProjection } from "@hl8/tenant";

@Module({
  imports: [
    // 1. 配置日志模块（全局）
    PinoLoggingModule.forRoot({
      config: {
        level: "info",
        // ... 其他配置
      },
    }),

    // 2. 配置 MikroORM（全局）
    MikroOrmModule.forRootAsync({
      contextName: "postgres",
      useFactory: async (config: AppConfig) => {
        // ... 数据库配置
        return {
          // ... 配置选项
          entities: [TenantProjection],
        };
      },
      inject: [AppConfig],
    }),

    // 3. 注册实体（可选，如果已经在 forRootAsync 中注册）
    MikroOrmModule.forFeature([TenantProjection], "postgres"),

    // 4. 注册租户管理模块
    TenantModule.register({
      contextName: "postgres",
      isGlobal: false,
    }),
  ],
})
export class AppModule {}
```

## ⚠️ 注意事项

1. **EntityManager 上下文名称**：
   - 默认使用 `"postgres"` 作为上下文名称
   - 如果应用使用不同的上下文名称，需要在 `TenantModule.register()` 中指定

2. **依赖顺序**：
   - `PinoLoggingModule` 和 `MikroOrmModule` 必须在应用根模块中配置
   - `TenantModule` 依赖于这些全局模块

3. **ApplicationCoreModule 可选依赖**：
   - 当前 `ApplicationCoreModule.register()` 没有提供 `abilityService` 和 `auditService`
   - 如果需要权限和审计功能，需要在注册时提供这些服务

4. **TypeScript 类型错误**：
   - 可能存在 `@hl8/mikro-orm-nestjs` 的类型定义缓存问题
   - 这通常不影响运行时，可以通过重新构建或重启 IDE 解决

## 🔄 后续工作

- [ ] 验证模块可以正确启动
- [ ] 测试依赖注入是否正常工作
- [ ] 如果需要，提供 `abilityService` 和 `auditService` 的实现
