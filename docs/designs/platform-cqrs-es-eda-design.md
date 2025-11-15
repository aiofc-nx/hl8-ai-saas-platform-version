## 平台级 CQRS + ES + EDA 设计索引

### 1. 文档目标

- 汇总拆分后 `@hl8/application-base` 与 `@hl8/infrastructure-base` 的详细设计文档，作为平台级应用层 + 基础设施能力的索引。
- 描述两大基础包之间的协作路径、依赖关系与集成注意事项。
- 为领域模块提供统一入口，便于查阅各自的详细实现与扩展点。

### 2. 能力结构总览

```
┌────────────────────────────────────────────┐
│ Platform Layer                             │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ @hl8/application-base               │  │
│  │  ├─ CQRS 命令/查询骨架              │  │
│  │  ├─ Saga & 流程编排                 │  │
│  │  ├─ CASL 权限协同                   │  │
│  │  └─ 应用层审计协调                 │  │
│  └──────────────────────────────────────┘  │
│                 ▲ 接口依赖                 │
│  ┌──────────────────────────────────────┐  │
│  │ @hl8/infrastructure-base            │  │
│  │  ├─ 事件溯源存储与发布             │  │
│  │  ├─ 事件驱动与外部适配             │  │
│  │  ├─ CASL 权限缓存与投影            │  │
│  │  ├─ 审计、日志、配置、异常         │  │
│  │  └─ 缓存与其他基础设施            │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

### 3. 详细设计文档导航

- `docs/designs/application-base-design.md`：应用层基线拆分后的详细设计，包括命令/查询基类、Saga 协调、权限与审计协作模式。
- `docs/designs/infrastructure-base-design.md`：基础设施能力的详细设计，覆盖事件存储、事件发布、缓存、审计、日志、配置等模块。

### 4. 协作模式与依赖

- `@hl8/application-base` 通过接口依赖注入方式消费 `@hl8/infrastructure-base` 暴露的服务（事件存储、事件发布器、CASL 能力、审计服务等）。
- 两个基础包均必须：
  - 采用 `NodeNext` 模块系统、`strict` TypeScript 编译设置。
  - 提供中文 TSDoc，覆盖 `@description`、`@example`、`@throws` 等标签。
  - 保持多租户上下文显式传递，禁止跨包引用具体业务实现。
- 领域模块应在设计文档中标注：依赖 `ApplicationCoreModule`（来自 `@hl8/application-base`）、`InfrastructureCoreModule`（来自 `@hl8/infrastructure-base`）的方式。

### 5. 迁移计划概览

1. 代码迁移：将原平台层命令/查询、Saga、权限协调代码移动至 `libs/application-base/`；基础设施相关代码移动至 `libs/infrastructure-base/`。
2. 依赖重构：更新业务模块注入逻辑，确保仅通过接口访问基础设施能力。
3. 测试与验证：为新包补充单元/集成测试；回归平台核心流程（命令→事件→投影）。
4. 文档同步：领域团队更新自身文档引用，指向新的基线与设计文件。

### 6. 后续维护

- 本索引需与两个基础包的 `CHANGELOG.md` 同步更新，记录重大变更与接口调整。
- 若新增共享能力（如新的消息适配器、额外的应用层拦截器），需在对应详细设计文档登记，并在此索引中追加指引。

### 7. 参考链接

- `docs/designs/application-base-baseline.md`
- `docs/designs/infrastructure-base-baseline.md`
- `docs/designs/application-base-design.md`
- `docs/designs/infrastructure-base-design.md`
