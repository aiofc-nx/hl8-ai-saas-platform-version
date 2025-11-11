# Implementation Plan: IAM 基线规范落地

**Branch**: `001-define-iam-spec` | **Date**: 2025-11-11 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-define-iam-spec/spec.md`

## Summary

整合现有设计文档与宪章，制定 IAM 底座的统一规范、职责矩阵、里程碑及合规要求，作为团队循序渐进交付多租户身份与授权能力的权威指引，覆盖从基础骨架到治理验收的完整路径。

## Technical Context

**Language/Version**: TypeScript 5.x（Node.js ≥ 20）  
**Primary Dependencies**: NestJS、Fastify、@nestjs/cqrs、CASL、MikroORM、@hl8/config、@hl8/logger  
**Storage**: PostgreSQL（领域事件/关系数据）、MongoDB（读模型投影）、Redis（CASL 能力缓存）  
**Testing**: Jest + @nestjs/testing（单元/集成）、Supertest（接口）、Playwright（端到端）  
**Target Platform**: Linux（容器化/Kubernetes 部署环境）  
**Project Type**: 企业级 SaaS Monorepo（Node.js 服务端为核心）  
**Performance Goals**: 能力缓存刷新 ≤ 2 分钟；核心认证/授权接口 p95 < 250ms；事件投影滞后 < 30 秒  
**Constraints**: 全链路多租户隔离；中文注释与文档；CQRS + ES + EDA；统一配置/日志/异常/缓存模块  
**Scale/Scope**: 预计支持 ≥100 租户、≥10k 活跃用户、覆盖租户/组织/认证/授权/共享内核/基础设施六大子域

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- ✅ 中文优先原则：规范及附属文档全部使用中文，代码注释遵守 TSDoc。
- ✅ 代码即文档原则：公共 API 与聚合需同步 TSDoc 与规范，计划内明确文档-实现联动。
- ✅ 技术栈约束原则：采用 Node.js + TypeScript + NestJS + Fastify + MikroORM + CASL，符合章程。
- ✅ 测试要求原则：阶段计划含单元/集成/E2E 覆盖目标（核心 80%/关键路径 90%）。
- ✅ 配置模块使用规范：所有配置通过 `@hl8/config` 声明与校验。
- ✅ 日志模块使用规范：统一经由 `@hl8/logger` 输出。
- ✅ 异常模块使用规范：借助 `libs/infra/exceptions` 定义与传播。
- ✅ 缓存模块使用规范：权限缓存由 `libs/infra/cache` 统一管理。
- ✅ 附加约束：规划遵循 DDD + Clean Architecture + CQRS + ES + EDA、多租户隔离、事件驱动等要求。

_Phase 1 设计后复检结果：所有条款依旧满足，新增的文档与契约资产均纳入中文规范体系。_

## Project Structure

### Documentation (this feature)

```text
specs/001-define-iam-spec/
├── plan.md              # 本实施计划
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出（API/事件契约）
└── tasks.md             # Phase 2 (/speckit.tasks) 将生成
```

### Source Code (repository root)

```text
apps/
└── fastify-api/                 # IAM 对外接口（REST/GraphQL）

core/
├── application/                 # CQRS 命令、查询、Saga
├── domain/                      # 聚合、实体、领域服务
├── interfaces/                  # 控制器、守卫、拦截器
└── infrastructure/              # MikroORM 仓储、Event Store、CLS

libs/
├── shared/                      # 值对象、异常、SecurityContext
├── infra/
│   ├── multi-tenancy/           # CLS、BaseTenantRepository、订阅器
│   ├── mikro-orm-nestjs/        # MikroORM + NestJS 集成封装
│   ├── cache/                   # 权限缓存策略
│   ├── exceptions/              # 统一异常
│   ├── logger/                  # 统一日志
│   └── config/                  # 配置管理
└── domains/
    ├── tenant/
    ├── organization/
    ├── auth/
    └── authorization/

tests/
├── unit/
├── integration/
└── e2e/

docs/
├── designs/                     # 架构与方案文档
├── guides/                      # 分层开发指南
└── governance/                  # 宪章、合规记录
```

**Structure Decision**: 延续既有 monorepo 目录划分，IAM 规范与配套资产存放于 `docs/designs` 与 `specs/001-define-iam-spec`，实现侧继续在 `core`/`libs`/`apps` 中演进；测试与治理资料遵循既定分层目录，确保章程合规。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed     | Simpler Alternative Rejected Because |
| --------- | -------------- | ------------------------------------ |
| 无        | 不存在章程违规 | -                                    |
