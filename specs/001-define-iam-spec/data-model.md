# Data Model：IAM 基线规范落地

## 核心实体

### IAM 规范主体

- **描述**：统一约束 IAM 底座开发的根文档，聚合架构原则、阶段计划、职责矩阵、质量门槛。
- **关键字段**：
  - `version`：语义化版本（主.次.修），与宪章同步。
  - `principles`：引用的章程条款列表。
  - `milestones`：阶段名称、目标、预计时长、交付物、度量。
  - `rolesMatrix`：角色 → 职责 / RACI 标记。
  - `governance`：合规流程、审计频率、变更提交流程。
- **校验规则**：
  - 所有描述字段必须使用中文。
  - `milestones` 至少包含 4 阶段（基础、协议+CASL、组织+审计、测试+治理）。
  - 任何引用的外部文档需包含绝对路径或明确编号。

### 子域交付清单

- **描述**：围绕租户、组织、认证、授权、共享内核、基础设施、接口层的交付任务集，用于指导阶段计划。
- **关键字段**：
  - `subdomainName`：子域标识（Tenant / Organization / Auth / Authorization / SharedKernel / Infrastructure / Interfaces）。
  - `deliverables`：主要交付物（功能、文档、测试、演示工单）。
  - `dependencies`：对其他子域或共享能力的依赖。
  - `qualityGates`：覆盖率、审计、CASL 一致性、性能等指标。
  - `ownerRole`：责任角色（对应职责矩阵）。
  - `phaseAlignment`：主要集中在哪一阶段推进。
- **示例表**：

| 子域           | 交付物                                               | 依赖                                     | 质量门槛                                     | 责任角色                    | 对应阶段  |
| -------------- | ---------------------------------------------------- | ---------------------------------------- | -------------------------------------------- | --------------------------- | --------- |
| Tenant         | 租户聚合、Provisioning Saga、租户上下文注入          | SharedKernel、Infrastructure、Interfaces | 覆盖率 ≥85%；Provisioning 审计日志齐备       | 子域负责人（Tenant）        | Phase 1-2 |
| Organization   | 组织/部门聚合、树形查询、跨层级权限继承              | Tenant、Authorization                    | 组织读接口 p95 <300ms；跨层权限测试覆盖      | 子域负责人（Organization）  | Phase 3   |
| Auth           | 认证协议适配、会话管理、登录守卫                     | Tenant、Infrastructure                   | 协议回归测试 100%；安全评估通过              | 子域负责人（Auth）          | Phase 2   |
| Authorization  | CASL 能力工厂、事件溯源聚合、能力缓存刷新            | Tenant、Auth、SharedKernel               | 能力缓存命中率 ≥90%；刷新 ≤2 分钟            | 子域负责人（Authorization） | Phase 2   |
| SharedKernel   | 值对象、异常、时间模型、ID 模板                      | -                                        | 新增值对象具备 TSDoc、单元测试；跨子域复用率 | 平台基础设施团队            | Phase 1-4 |
| Infrastructure | CLS、BaseTenantRepository、Event Store、AuditService | SharedKernel                             | CLS 覆盖所有入口；事件存储多租户隔离验证     | 平台基础设施团队            | Phase 1-3 |
| Interfaces     | MultiTenantController、守卫、拦截器、异常过滤器      | Tenant、Auth、Authorization              | 接口层上下文校验 100%；E2E 场景通过          | 接口层负责人                | Phase 1-4 |

- **校验规则**：
  - 每个子域必须至少列出一个阶段一任务。
  - `qualityGates` 需覆盖测试覆盖率与合规检查两个维度。

### 合规检查清单

- **描述**：治理团队执行 Constitution Check 的条目集。
- **关键字段**：
  - `principle`：宪章条款引用。
  - `checkItem`：检查动作（示例：验证 CASL 能力缓存刷新 SLA）。
  - `evidence`：证明材料（代码路径、日志、测试报告）。
  - `owner`：责任角色。
- **校验规则**：
  - 所有核心原则（I-VIII）必须至少有一条检查项。
  - `evidence` 必须指向可追溯的文档或系统记录。

## 状态与生命周期

- **草拟（Draft）**：架构负责人完成初稿，待评审。
- **评审中（Reviewing）**：架构委员会与子域负责人评议，可能迭代。
- **基线锁定（Baseline）**：通过评审，作为执行依据；需记录版本号。
- **变更中（Amending）**：宪章或外部依赖变更触发更新流程。
- **废止（Deprecated）**：被新版本替换，但保留审计轨迹。

状态变更必须在 `governance` 中记录审批人与时间戳，并同步到 `docs/governance/` 变更记录。

## 关系

- `IAM 规范主体` **聚合** `子域交付清单` 与 `合规检查清单`。
- `子域交付清单` **依赖** `docs/designs/*.md` 提供的领域方案。
- `合规检查清单` **引用** 宪章条款与测试、日志、审计结果。

## 数据量与规模假设

- 规范版本：预计每季度更新 1-2 次。
- 子域任务：每阶段约 5-10 个关键交付项。
- 合规检查：至少 20 条（覆盖全部原则与关键风险）。

## 约束

- 所有文档必须存储在仓库内，遵循 Git 版本管理。
- 任何跨租户数据描述必须在规范中显式说明控制策略。
- 文档更新需同步更新 `version` 与变更日志，保证审计可追溯。\*\*\* End Patch
