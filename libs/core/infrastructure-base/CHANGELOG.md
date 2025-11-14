# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-12-19

### Added

#### 事件溯源（ES）域

- **EventStore 接口**：提供事件存储的核心接口，支持事件的追加、加载和查询
- **MikroORMEventStore 实现**：基于 MikroORM 的事件存储实现，支持乐观锁和重试机制
- **InMemoryEventStore 测试替身**：提供内存事件存储实现，用于单元测试
- **EventEntity 实体**：事件实体定义，包含 eventId、aggregateId、tenantId、version、payload、occurredAt、metadata 字段
- **EventSnapshotEntity 实体**：事件快照实体定义，支持聚合状态快照
- **SnapshotService 服务**：提供快照创建、加载和删除能力
- **AggregateReconstitution 工具**：提供聚合重建工具，支持从事件流重建聚合状态
- **EventStoreModule 模块**：事件存储模块，支持多数据源配置

#### 事件驱动（EDA）域

- **EventPublisher 接口**：提供事件发布的核心接口，支持发布到内部事件总线和外部消息队列
- **EventPublisherService 实现**：事件发布服务实现，支持降级处理
- **MessageBrokerAdapter 接口**：消息队列适配器接口，支持多种消息队列实现
- **InMemoryMessageBrokerAdapter 测试替身**：提供内存消息队列适配器实现，用于单元测试
- **KafkaAdapter 骨架**：Kafka 消息队列适配器骨架（待完善）
- **EventBusModule 模块**：事件总线模块，集成 @nestjs/cqrs
- **EventPublisherModule 模块**：事件发布模块，支持动态选择消息队列适配器

#### 权限与缓存域

- **CaslAbilityService 接口**：提供权限能力解析的核心接口
- **CaslAbilityServiceImpl 实现**：权限能力服务实现，支持权限规则构建和缓存
- **AbilityCacheService 接口**：提供权限缓存的核心接口
- **AbilityCacheServiceImpl 实现**：权限缓存服务实现，基于 Redis，支持多级缓存失效
- **SecurityContext 接口**：安全上下文接口，包含 userId、tenantId、organizationId
- **CaslAbilityModule 模块**：权限能力模块，支持可选的权限规则构建器注入

#### 审计与日志域

- **AuditService 接口**：提供审计记录的核心接口
- **AuditServiceImpl 实现**：审计服务实现，支持审计记录的追加和查询
- **AuditRepository 实现**：审计仓储实现，基于 MikroORM
- **AuditLogEntity 实体**：审计日志实体定义，包含 auditId、tenantId、userId、action、payload、occurredAt、metadata 字段
- **AuditArchiveService 服务**：审计归档服务框架（待完善归档存储集成）
- **NullAuditService 测试替身**：提供空审计服务实现，用于单元测试
- **AuditModule 模块**：审计模块，支持多数据源配置

#### 配置与异常域

- **ConfigurationService 接口**：提供配置管理的核心接口
- **ConfigurationServiceImpl 实现**：配置服务实现，支持配置值的获取和检查
- **InfrastructureConfigModule 模块**：配置模块，支持配置文件加载和环境变量覆盖
- **InfrastructureConfig 配置类**：基础设施配置类，使用 class-validator 进行验证
- **ExceptionService 接口**：提供异常处理的核心接口
- **ExceptionServiceImpl 实现**：异常服务实现，支持异常创建和记录
- **ExceptionModule 模块**：异常模块，支持统一的异常处理
- **基础设施异常类**：EventStoreException、EventPublisherException、CaslAbilityException、AuditServiceException、ConfigurationException 等

#### 核心模块

- **InfrastructureCoreModule 模块**：基础设施核心模块，整合所有基础设施服务，向应用层暴露统一的模块接口

### Features

- ✅ 支持多租户隔离，确保跨租户数据访问的隔离性达到 100%
- ✅ 支持事件溯源，提供事件存储、重放和快照管理能力
- ✅ 支持事件驱动架构，提供统一的事件发布和订阅能力
- ✅ 支持权限缓存，提供 CASL 权限能力解析和缓存能力
- ✅ 支持审计日志，提供审计记录的持久化和查询能力
- ✅ 支持配置管理，提供配置加载、验证和类型安全访问
- ✅ 支持异常处理，提供统一的异常创建和记录能力
- ✅ 支持测试替身，所有服务都提供测试替身实现
- ✅ 支持降级处理，缓存、存储、消息队列不可用时支持降级
- ✅ 支持乐观锁，事件存储支持乐观锁和自动重试机制

### Security

- 🔒 所有服务接口都支持多租户隔离，确保跨租户数据访问的隔离性达到 100%
- 🔒 所有操作都必须显式传递 `tenantId` 参数，确保数据隔离
- 🔒 审计服务支持敏感字段自动脱敏，确保日志中不包含明文敏感信息

### Performance

- ⚡ 事件存储支持乐观锁和自动重试机制，提高并发写入性能
- ⚡ 权限缓存支持多级缓存失效，提高缓存命中率
- ⚡ 审计服务支持批量插入，提高写入性能

### Documentation

- 📚 所有公共 API 都包含完整的中文 TSDoc 注释
- 📚 提供 README.md 文档，包含模块介绍、使用示例和 API 文档
- 📚 提供 CHANGELOG.md 文档，记录所有接口变更

### Testing

- 🧪 所有服务都提供测试替身实现，支持单元测试
- 🧪 测试覆盖率要求：核心业务逻辑 ≥ 80%，关键路径 ≥ 90%

## [Unreleased]

### Planned

- [ ] 完善 KafkaAdapter 实现
- [ ] 完善 AuditArchiveService 归档存储集成
- [ ] 实现事件投影处理器装饰器
- [ ] 实现 Saga 处理器装饰器
- [ ] 实现性能优化和基线测试
- [ ] 增补单元测试和集成测试
- [ ] 实现安全与租户隔离加固

### Breaking Changes

暂无

### Deprecated

暂无

### Removed

暂无

### Fixed

暂无

### Security

暂无

---

## 版本说明

- **0.1.0**：初始版本，实现核心基础设施能力

## 迁移指南

### 从 0.0.0 迁移到 0.1.0

这是初始版本，无需迁移。

---

## 贡献者

感谢所有为这个项目做出贡献的人！

## 许可证

MIT
