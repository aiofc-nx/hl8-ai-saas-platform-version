<!--
Sync Impact Report
Version: 1.1.0 → 1.2.0
Modified Principles: III. 技术栈约束原则
Added Sections: 附加约束（项目定位与架构要求）
Removed Sections: 无
Templates:
- .specify/templates/plan-template.md ⚠ 文件已删除，需确认是否恢复以继续执行章程校验流程
- .specify/templates/spec-template.md ⚠ 文件已删除，需确认是否恢复以继续执行章程校验流程
- .specify/templates/tasks-template.md ⚠ 文件已删除，需确认是否恢复以继续执行章程校验流程
Follow-up TODOs: TODO(RESTORE_SPECKIT_ASSETS): speckit 模板及命令资产已被移除，需确认后续治理工具链策略
-->

# hl8-aisaas-platform Constitution

## Core Principles

### I. 中文优先原则

- 所有代码注释、技术文档、错误消息、日志输出及用户界面文案必须使用中文，且注释遵循 TSDoc 规范。
- Git 提交信息须使用英文描述；代码变量命名保持英文，但必须配有中文注释说明业务语义。

**理由**：统一中文语境提升团队沟通效率，确保业务认知一致，降低知识传递成本。

### II. 代码即文档原则

- 公共 API、类、方法、接口、枚举必须编写完整 TSDoc 注释，覆盖功能描述、业务规则、使用场景、前置条件、后置条件、异常抛出及注意事项。
- 代码变更时必须同步更新注释，保持实现与文档一致。

**理由**：通过高质量注释让代码自身成为权威业务文档，缩短交接时间并减少额外文档维护负担。

### III. 技术栈约束原则

- 全仓统一采用 Node.js + TypeScript，使用 pnpm 管理依赖并通过 monorepo 组织代码。
- 服务端项目必须启用 NodeNext 模块系统：`module`/`moduleResolution` 设为 `NodeNext`，`target` 设为 `ES2022`，`strict` 启用。
- `package.json` 中需声明 `type: "module"` 与 `engines: { "node": ">=20" }`，禁止新增 CommonJS 模块代码。
- 服务端基础框架固定为 NestJS + Fastify，无需兼容 Express。
- 数据访问层统一使用 MikroORM 管理实体生命周期与迁移。
- 关系型数据库选型锁定 PostgreSQL，文档型数据库选型锁定 MongoDB。
- 领域命令与查询处理须引入 `@nestjs/cqrs` 实现 CQRS 分层。
- 权限控制统一引入 CASL（`@casl/ability`）建模权限策略。

**理由**：统一技术栈、框架与依赖选择可提升跨团队协作效率，降低学习成本，并确保在性能、扩展性与安全性上的基线能力一致。

### IV. 测试要求原则

- 单元测试与被测文件同目录(旁放)，命名 `{filename}.spec.ts`；集成与端到端测试集中放置在 `tests/integration/` 与 `tests/e2e/`。
- 采用分层测试策略：单元、集成、端到端各司其职，确保快速反馈与可维护性。
- 核心业务逻辑测试覆盖率须达到 80% 以上，关键路径 90% 以上，所有公共 API 必须具备测试用例。

**理由**：高标准测试体系保障关键功能可靠性，支持快速迭代并防止回归。

### V. 配置模块使用规范

- 必须优先通过 `@hl8/config` 读取与管理配置，禁止直接使用原始配置对象。
- 每个配置需定义 TypeScript 配置类，并使用 `class-validator` 装饰器声明字段校验逻辑。

**理由**：统一配置入口与验证机制可强化类型安全、运行时校验与文档一致性。

### VI. 日志模块使用规范

- 日志必须统一通过 `@hl8/logger` 输出，禁止直接使用 Nest 内置 `Logger` 或第三方日志库（如 `pino`、`winston` 等）。
- 如需扩展日志能力，先在 `@hl8/logger` 中实现标准化接口，再供业务模块复用。

**理由**：集中式日志体系保证日志格式一致、上下文完整与脱敏策略统一，提升可观测性。

### VII. 异常模块使用规范

- 异常处理需统一依赖 `libs/infra/exceptions` 提供的异常定义与封装。
- 新增业务异常必须在该模块中声明异常类型、错误码与中文错误信息，禁止直接构造裸异常。
- 跨模块异常需使用标准化转换与传播工具保持语义一致。

**理由**：统一异常语义避免重复实现，提升排障效率并确保错误信息一致。

### VIII. 缓存模块使用规范

- 缓存策略必须通过 `libs/infra/cache` 管理，禁止直接操作底层缓存驱动。
- 新增缓存命名空间或策略时需在模块内统一声明；扩展监控、降级等能力时亦须先在该模块实现。

**理由**：集中管理缓存策略可保持命名一致、避免资源浪费并强化系统可观测性。

## 附加约束

- 项目目标：打造面向现代企业管理的 SaaS 平台，为多部门协同与业务自动化提供统一能力中心。
- 多租户能力为硬性要求，业务实现需确保租户隔离、自助开通与生命周期管理策略完备。
- 数据存储与访问层必须实现严格的租户级数据隔离与安全防护。
- 业务模块开发需遵循 DDD + Clean Architecture + CQRS + Event Sourcing + 事件驱动架构（EDA）的混合模式，确保可演化性与高可观测性。

## 开发流程

- 所有规划文档必须通过 Constitution Check，逐项验证八项核心原则的合规性。
- 设计评审与代码评审需引用本章程条款做出合规结论，发现偏差时必须在实施前补齐方案。
- 交付前需完成测试分层验证，确保覆盖率门槛与模块规范均已满足。

## Governance

- 本章程优先级高于其他内部流程文件，若出现冲突，应以章程为准。
- 章程变更需提交书面提案，获得项目治理小组批准并更新版本号与修订记录。
- 每季度开展合规审查，随机抽取项目成果检查八项原则落实情况，必要时启动整改计划。
- 所有团队成员有责任在评审、开发与交付过程中主动引用章程条款并记录合规性证明。

**Version**: 1.2.0 | **Ratified**: 2025-11-09 | **Last Amended**: 2025-11-10

# [PROJECT_NAME] Constitution

<!-- Example: Spec Constitution, TaskFlow Constitution, etc. -->

## Core Principles

### [PRINCIPLE_1_NAME]

<!-- Example: I. Library-First -->

[PRINCIPLE_1_DESCRIPTION]

<!-- Example: Every feature starts as a standalone library; Libraries must be self-contained, independently testable, documented; Clear purpose required - no organizational-only libraries -->

### [PRINCIPLE_2_NAME]

<!-- Example: II. CLI Interface -->

[PRINCIPLE_2_DESCRIPTION]

<!-- Example: Every library exposes functionality via CLI; Text in/out protocol: stdin/args → stdout, errors → stderr; Support JSON + human-readable formats -->

### [PRINCIPLE_3_NAME]

<!-- Example: III. Test-First (NON-NEGOTIABLE) -->

[PRINCIPLE_3_DESCRIPTION]

<!-- Example: TDD mandatory: Tests written → User approved → Tests fail → Then implement; Red-Green-Refactor cycle strictly enforced -->

### [PRINCIPLE_4_NAME]

<!-- Example: IV. Integration Testing -->

[PRINCIPLE_4_DESCRIPTION]

<!-- Example: Focus areas requiring integration tests: New library contract tests, Contract changes, Inter-service communication, Shared schemas -->

### [PRINCIPLE_5_NAME]

<!-- Example: V. Observability, VI. Versioning & Breaking Changes, VII. Simplicity -->

[PRINCIPLE_5_DESCRIPTION]

<!-- Example: Text I/O ensures debuggability; Structured logging required; Or: MAJOR.MINOR.BUILD format; Or: Start simple, YAGNI principles -->

## [SECTION_2_NAME]

<!-- Example: Additional Constraints, Security Requirements, Performance Standards, etc. -->

[SECTION_2_CONTENT]

<!-- Example: Technology stack requirements, compliance standards, deployment policies, etc. -->

## [SECTION_3_NAME]

<!-- Example: Development Workflow, Review Process, Quality Gates, etc. -->

[SECTION_3_CONTENT]

<!-- Example: Code review requirements, testing gates, deployment approval process, etc. -->

## Governance

<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

[GOVERNANCE_RULES]

<!-- Example: All PRs/reviews must verify compliance; Complexity must be justified; Use [GUIDANCE_FILE] for runtime development guidance -->

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]

<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->
