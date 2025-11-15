# 租户管理模块 - 下一步工作计划

## 📊 当前状态总结

### ✅ 已完成工作

1. **领域层（Domain Layer）**
   - ✅ 值对象：TenantName、TenantStatus、TenantContactInfo、TenantContext
   - ✅ 实体：TenantProfile
   - ✅ 聚合根：TenantAggregate
   - ✅ 领域事件：TenantCreatedEvent、TenantActivatedEvent、TenantSuspendedEvent、TenantArchivedEvent、TenantProfileUpdatedEvent
   - ✅ 仓储接口：TenantRepository

2. **应用层（Application Layer）**
   - ✅ 命令处理器：CreateTenantHandler、ActivateTenantHandler、DeactivateTenantHandler、ArchiveTenantHandler、UpdateTenantProfileHandler
   - ✅ 查询处理器：GetTenantContextHandler、GetTenantByIdHandler、ListTenantsHandler
   - ✅ Saga：TenantLifecycleSaga（基础框架）

3. **基础设施层（Infrastructure Layer）**
   - ✅ 仓储实现：TenantRepositoryImpl（基于 EventStore）
   - ✅ 投影处理器：TenantProjectionHandler
   - ✅ 读模型：TenantProjection、TenantReadModel

4. **接口层（Interface Layer）**
   - ✅ 控制器：TenantCommandController、TenantQueryController
   - ✅ DTO：所有请求和响应 DTO

5. **代码质量**
   - ✅ TSDoc 注释补充完成（T080）
   - ✅ 代码清理与重构完成（T082）
   - ✅ 异常处理统一使用 DomainException
   - ✅ 日志统一使用 @hl8/logger

---

## 🎯 下一步工作计划（按优先级排序）

### 阶段 1：核心功能完善（高优先级）

#### T090：模块依赖注入完善

**目标**：完善 TenantModule 的依赖注入配置

**任务清单**：

- [ ] 导入 ApplicationCoreModule 以获取 CaslAbilityCoordinator 和 AuditCoordinator
- [ ] 注册 EventStore 提供者
- [ ] 注册 EventPublisher 提供者
- [ ] 注册 EntityManager（通过 MikroORM 模块）
- [ ] 注册 Logger（通过 @hl8/logger 模块）
- [ ] 注册 SnapshotService（可选）

**预计工作量**：2-3 小时

---

#### T091：SecurityContext 集成

**目标**：在控制器中正确获取和使用 SecurityContext

**任务清单**：

- [ ] 研究 @hl8/application-base 中的 SecurityContext 装饰器用法
- [ ] 在 TenantCommandController 中实现 SecurityContext 获取
- [ ] 在 TenantQueryController 中实现 SecurityContext 获取
- [ ] 移除临时模拟的 SecurityContext 代码
- [ ] 确保所有命令和查询都正确传递 SecurityContext

**预计工作量**：2-3 小时

---

#### T092：数据库迁移文件生成

**目标**：生成实际的数据库迁移文件

**任务清单**：

- [ ] 配置 MikroORM 连接和迁移设置
- [ ] 运行 `pnpm --filter @hl8/tenant run db:migration:create` 生成迁移
- [ ] 验证迁移文件包含所有必要的表和索引
- [ ] 测试迁移的 up 和 down 操作
- [ ] 更新迁移占位符文件或删除占位符

**预计工作量**：1-2 小时

---

### 阶段 2：功能增强（中优先级）

#### T093：Saga 业务逻辑实现

**目标**：实现租户生命周期 Saga 的实际业务逻辑

**任务清单**：

- [ ] 实现 TenantCreatedEvent 处理：
  - [ ] 创建默认组织根节点（调用组织管理模块）
  - [ ] 初始化 IAM 基础角色（调用 IAM 模块）
  - [ ] 实现补偿逻辑
- [ ] 实现 TenantActivatedEvent 处理：
  - [ ] 执行激活后的初始化操作
  - [ ] 实现补偿逻辑
- [ ] 实现 TenantSuspendedEvent 处理：
  - [ ] 触发 IAM 禁用权限
  - [ ] 通知消息系统
  - [ ] 实现补偿逻辑
- [ ] 添加错误处理和重试机制

**预计工作量**：4-6 小时

**依赖**：需要组织管理模块和 IAM 模块的接口定义

---

#### T094：仓储多条件查询实现

**目标**：实现 TenantRepository.findBy 方法

**任务清单**：

- [ ] 设计查询条件接口
- [ ] 从读模型查询符合条件的聚合 ID
- [ ] 对每个 ID 调用 findById 重建聚合
- [ ] 返回聚合数组
- [ ] 添加单元测试

**预计工作量**：2-3 小时

---

#### T095：事件发布完善

**目标**：确保所有命令处理器都正确发布事件

**任务清单**：

- [ ] 检查 UpdateTenantProfileHandler 的事件发布逻辑
- [ ] 确保所有命令处理器在保存聚合后都发布事件
- [ ] 验证事件发布到事件总线的流程

**预计工作量**：1 小时

---

### 阶段 3：测试与质量保证（高优先级）

#### T096：单元测试编写

**目标**：为核心业务逻辑编写单元测试

**任务清单**：

- [ ] 值对象测试：
  - [ ] TenantName.spec.ts
  - [ ] TenantStatus.spec.ts
  - [ ] TenantContactInfo.spec.ts
  - [ ] TenantContext.spec.ts
- [ ] 聚合根测试：
  - [ ] TenantAggregate.spec.ts（测试状态转换、事件生成）
- [ ] 命令处理器测试：
  - [ ] CreateTenantHandler.spec.ts
  - [ ] ActivateTenantHandler.spec.ts
  - [ ] DeactivateTenantHandler.spec.ts
  - [ ] ArchiveTenantHandler.spec.ts
  - [ ] UpdateTenantProfileHandler.spec.ts
- [ ] 查询处理器测试：
  - [ ] GetTenantContextHandler.spec.ts
  - [ ] GetTenantByIdHandler.spec.ts
  - [ ] ListTenantsHandler.spec.ts
- [ ] 仓储测试：
  - [ ] TenantRepositoryImpl.spec.ts（测试事件溯源重建）

**预计工作量**：8-12 小时

**测试覆盖率目标**：核心业务逻辑 80% 以上，关键路径 90% 以上

---

#### T097：集成测试编写

**目标**：编写端到端集成测试

**任务清单**：

- [ ] 创建测试数据库配置
- [ ] 编写租户创建流程集成测试
- [ ] 编写租户生命周期集成测试（创建 → 激活 → 停用 → 归档）
- [ ] 编写查询功能集成测试
- [ ] 测试事件溯源和读模型同步

**预计工作量**：4-6 小时

---

### 阶段 4：文档与优化（低优先级）

#### T098：API 文档完善

**目标**：完善 Swagger/OpenAPI 文档

**任务清单**：

- [ ] 为所有控制器端点添加完整的 Swagger 注解
- [ ] 添加请求/响应示例
- [ ] 添加错误响应文档
- [ ] 生成 OpenAPI 规范文件

**预计工作量**：2-3 小时

---

#### T099：性能优化

**目标**：优化查询和事件处理性能

**任务清单**：

- [ ] 实现快照机制（SnapshotService）以减少事件重放时间
- [ ] 优化读模型查询索引
- [ ] 实现事件发布批量处理
- [ ] 性能测试和调优

**预计工作量**：4-6 小时

---

#### T100：错误处理增强

**目标**：完善错误处理和用户友好的错误消息

**任务清单**：

- [ ] 统一错误码定义
- [ ] 完善异常消息（中文）
- [ ] 添加错误恢复机制
- [ ] 实现错误监控和告警

**预计工作量**：2-3 小时

---

## 📅 建议执行顺序

### 第一周（核心功能完善）

1. **T090** - 模块依赖注入完善（2-3 小时）
2. **T091** - SecurityContext 集成（2-3 小时）
3. **T092** - 数据库迁移文件生成（1-2 小时）
4. **T095** - 事件发布完善（1 小时）

**小计**：6-9 小时

### 第二周（功能增强）

5. **T093** - Saga 业务逻辑实现（4-6 小时，可能需要等待依赖模块）
6. **T094** - 仓储多条件查询实现（2-3 小时）

**小计**：6-9 小时

### 第三周（测试）

7. **T096** - 单元测试编写（8-12 小时）
8. **T097** - 集成测试编写（4-6 小时）

**小计**：12-18 小时

### 第四周（文档与优化）

9. **T098** - API 文档完善（2-3 小时）
10. **T099** - 性能优化（4-6 小时）
11. **T100** - 错误处理增强（2-3 小时）

**小计**：8-12 小时

---

## 🎯 里程碑

- **里程碑 1**：核心功能可用（完成 T090-T092）
  - 模块可以正确启动
  - 数据库迁移可以执行
  - 基本 CRUD 操作可以工作

- **里程碑 2**：功能完整（完成 T093-T095）
  - 所有业务功能实现完成
  - Saga 流程可以执行

- **里程碑 3**：质量保证（完成 T096-T097）
  - 测试覆盖率达标
  - 集成测试通过

- **里程碑 4**：生产就绪（完成 T098-T100）
  - 文档完整
  - 性能达标
  - 错误处理完善

---

## 📝 注意事项

1. **依赖关系**：
   - T093（Saga 实现）可能需要等待组织管理模块和 IAM 模块的接口定义
   - T090（模块依赖）应该在 T096（单元测试）之前完成

2. **测试策略**：
   - 建议采用 TDD（测试驱动开发）方式，先写测试再实现功能
   - 单元测试应该与被测文件放在同一目录

3. **代码质量**：
   - 所有代码必须遵循平台宪章要求
   - 保持 TSDoc 注释的完整性和准确性
   - 确保所有异常都使用平台标准异常

4. **性能考虑**：
   - 事件溯源可能在大数据量时性能下降，需要实现快照机制
   - 读模型查询需要合适的索引

---

## 🔄 持续改进

- 定期回顾和更新此计划
- 根据实际开发进度调整优先级
- 记录开发过程中的问题和解决方案
- 收集反馈并优化实现
