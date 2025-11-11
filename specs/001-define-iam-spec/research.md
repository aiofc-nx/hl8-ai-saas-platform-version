# Phase 0 Research：IAM 基线规范落地

## 决策一览

### Decision: 坚持宪章技术栈与模块规范

- **Rationale**: `docs/designs/iam-v2.md`、`casl-muti-tenant-auth-cqrs-es-eda.md` 与宪章均明确使用 Node.js + TypeScript、NestJS + Fastify、MikroORM、CASL、`@hl8/config`、`@hl8/logger`，且团队既有资产已建立在该组合上。
- **Alternatives considered**:
  - 使用 Prisma/TypeORM：与现有 MikroORM 和事件溯源投影方案冲突。
  - 引入独立日志/配置库：违背宪章 VI/V。

### Decision: 多租户上下文三层（租户/组织/部门）贯穿命令、查询、接口

- **Rationale**: `iam-v2` 强调上下文贯通；`casl` 文档说明权限评估需依赖三层上下文，规范必须原样吸收以避免安全漏洞。
- **Alternatives considered**:
  - 仅保留租户级上下文：无法满足组织/部门隔离要求。
  - 运行时推断组织关系：增加复杂度且不符合 DDD 明确上下文的原则。

### Decision: 阶段划分沿用 `saas-platform-iam-plan.md` 四阶段节奏

- **Rationale**: 该文档已将 IAM 交付拆分为基础骨架→协议与 CASL→组织与审计→测试治理，与团队循序迭代诉求一致。
- **Alternatives considered**:
  - 以子域并行推进：风险高、难以验证上下游依赖。
  - 精简阶段至两步：无法确保认证协议与组织审计充分投入。

### Decision: 合规与治理检查与阶段评审绑定

- **Rationale**: 宪章要求交付前执行 Constitution Check；规范需定义每阶段结束执行一次，以便及时纠偏。
- **Alternatives considered**:
  - 仅在最终上线前检查：无法及早发现违规。
  - 只做自动化脚本：当前治理流程仍需人工审阅文档与风险项。

### Decision: 能力缓存刷新 SLA ≤ 2 分钟、事件投影滞后 < 30 秒

- **Rationale**: CASL 权限一致性依赖及时刷新；结合现有基础设施（Redis + MikroORM 投影）可达成该指标。
- **Alternatives considered**:
  - 不设指标：无法评估治理风险。
  - 提高门槛（如 5 分钟）：将削弱权限变更时效。

## 结论

阶段 0 未发现需要进一步澄清的未知项，后续设计均可在现有文档与章程基础上推进。\*\*\* End Patch
