/**
 * @fileoverview 基础设施配置类
 * @description 定义基础设施模块的配置结构，支持类型安全和运行时验证
 *
 * ## 业务规则
 *
 * ### 配置验证规则
 * - 使用 class-validator 装饰器进行验证
 * - 使用 class-transformer 进行类型转换
 * - 支持嵌套配置对象的验证
 * - 配置验证失败时阻止应用启动
 *
 * ### 配置加载规则
 * - 支持环境变量覆盖
 * - 支持配置文件加载
 * - 支持多环境配置（开发、测试、生产）
 * - 配置加载失败时提供详细的错误信息
 *
 * ### 配置使用规则
 * - 配置类属性使用 readonly 修饰符确保不可变
 * - 配置类属性使用非空断言（!）告诉编译器该属性会被初始化
 * - 配置类支持嵌套配置对象
 * - 配置类支持可选配置项
 */

import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

/**
 * @description 事件存储配置
 * @remarks 定义事件存储服务的配置参数
 */
export class EventStoreConfig {
  /**
   * @description 事件存储连接字符串
   * @remarks 支持环境变量覆盖，例如：EVENT_STORE__CONNECTION_STRING
   */
  @IsString()
  @IsNotEmpty()
  public readonly connectionString!: string;

  /**
   * @description 乐观锁重试次数
   * @remarks 当检测到版本冲突时自动重试的次数，默认 3 次
   */
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  @Type(() => Number)
  public readonly optimisticLockRetryCount: number = 3;

  /**
   * @description 乐观锁重试延迟（毫秒）
   * @remarks 重试之间的延迟时间，默认 100 毫秒
   */
  @IsInt()
  @Min(0)
  @Max(1000)
  @IsOptional()
  @Type(() => Number)
  public readonly optimisticLockRetryDelay: number = 100;

  /**
   * @description 是否启用事件归档
   * @remarks 启用后支持将事件归档到成本更低的存储
   */
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  public readonly enableArchiving: boolean = false;

  /**
   * @description 归档存储连接字符串
   * @remarks 归档存储的连接字符串，仅在启用归档时使用
   */
  @IsString()
  @IsOptional()
  public readonly archiveConnectionString?: string;
}

/**
 * @description 事件发布配置
 * @remarks 定义事件发布服务的配置参数
 */
export class EventPublisherConfig {
  /**
   * @description 消息队列类型
   * @remarks 支持 kafka、rabbitmq、rocketmq 等
   */
  @IsString()
  @IsIn(["kafka", "rabbitmq", "rocketmq", "memory"])
  @IsNotEmpty()
  public readonly messageBrokerType: string = "kafka";

  /**
   * @description 消息队列连接字符串
   * @remarks 消息队列的连接字符串，例如：kafka://localhost:9092
   */
  @IsString()
  @IsOptional()
  public readonly messageBrokerConnectionString?: string;

  /**
   * @description 是否启用消息队列降级
   * @remarks 启用后，当消息队列不可用时仅记录日志而不阻塞主流程
   */
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  public readonly enableMessageBrokerDegradation: boolean = true;
}

/**
 * @description 权限缓存配置
 * @remarks 定义权限缓存服务的配置参数
 */
export class AbilityCacheConfig {
  /**
   * @description 缓存连接字符串
   * @remarks 缓存服务的连接字符串，例如：redis://localhost:6379
   */
  @IsString()
  @IsOptional()
  public readonly cacheConnectionString?: string;

  /**
   * @description 缓存 TTL（秒）
   * @remarks 缓存过期时间，默认 3600 秒（1 小时）
   */
  @IsInt()
  @Min(0)
  @Max(86400)
  @IsOptional()
  @Type(() => Number)
  public readonly ttlSeconds: number = 3600;

  /**
   * @description 是否启用缓存降级
   * @remarks 启用后，当缓存不可用时降级到直接查询权限规则构建服务
   */
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  public readonly enableCacheDegradation: boolean = true;
}

/**
 * @description 审计服务配置
 * @remarks 定义审计服务的配置参数
 */
export class AuditServiceConfig {
  /**
   * @description 审计存储连接字符串
   * @remarks 审计存储的连接字符串，例如：postgresql://localhost:5432/audit
   */
  @IsString()
  @IsNotEmpty()
  public readonly connectionString!: string;

  /**
   * @description 是否启用审计记录归档
   * @remarks 启用后支持将审计记录归档到成本更低的存储
   */
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  public readonly enableArchiving: boolean = false;

  /**
   * @description 归档存储连接字符串
   * @remarks 归档存储的连接字符串，仅在启用归档时使用
   */
  @IsString()
  @IsOptional()
  public readonly archiveConnectionString?: string;
}

/**
 * @description 基础设施配置
 * @remarks 定义基础设施模块的完整配置结构
 */
export class InfrastructureConfig {
  /**
   * @description 事件存储配置
   * @remarks 事件存储服务的配置参数
   */
  @ValidateNested()
  @Type(() => EventStoreConfig)
  @IsOptional()
  public readonly eventStore?: EventStoreConfig;

  /**
   * @description 事件发布配置
   * @remarks 事件发布服务的配置参数
   */
  @ValidateNested()
  @Type(() => EventPublisherConfig)
  @IsOptional()
  public readonly eventPublisher?: EventPublisherConfig;

  /**
   * @description 权限缓存配置
   * @remarks 权限缓存服务的配置参数
   */
  @ValidateNested()
  @Type(() => AbilityCacheConfig)
  @IsOptional()
  public readonly abilityCache?: AbilityCacheConfig;

  /**
   * @description 审计服务配置
   * @remarks 审计服务的配置参数
   */
  @ValidateNested()
  @Type(() => AuditServiceConfig)
  @IsOptional()
  public readonly auditService?: AuditServiceConfig;
}
