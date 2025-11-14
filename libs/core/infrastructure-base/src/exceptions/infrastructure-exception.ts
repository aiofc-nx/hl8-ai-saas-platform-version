/**
 * @fileoverview 基础设施异常定义
 * @description 定义基础设施模块专用的异常类，扩展 @hl8/exceptions 提供的异常基类
 */

import { HttpStatus } from "@nestjs/common";
import {
  AbstractHttpException,
  GeneralInternalServerException,
  InternalServiceUnavailableException,
} from "@hl8/exceptions";

/**
 * @description 事件存储异常
 * @remarks 用于事件存储操作失败时的异常处理
 */
export class EventStoreException extends GeneralInternalServerException {
  /**
   * @description 构造函数
   * @param detail - 错误详细信息（中文）
   * @param errorCode - 业务错误码
   * @param context - 错误上下文信息
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "事件存储操作失败",
    errorCode?: string,
    context?: Record<string, unknown>,
    rootCause?: unknown,
  ) {
    super(detail, errorCode || "EVENT_STORE_ERROR", rootCause);
    if (context) {
      Object.assign(this, context);
    }
  }
}

/**
 * @description 事件存储版本冲突异常数据
 * @remarks 扩展 OptimisticLockException 的数据类型
 */
interface EventStoreVersionConflictData {
  currentVersion?: number;
  expectedVersion?: number;
  aggregateId?: string;
  tenantId?: string;
  retryCount?: number;
}

/**
 * @description 事件存储版本冲突异常
 * @remarks 用于事件版本冲突时的异常处理，扩展 OptimisticLockException
 */
export class EventStoreVersionConflictException extends AbstractHttpException<EventStoreVersionConflictData> {
  /**
   * @description 构造函数
   * @param currentVersion - 数据库当前版本
   * @param expectedVersion - 调用方期望版本
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @param retryCount - 重试次数
   * @param detail - 自定义提示信息
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    currentVersion?: number,
    expectedVersion?: number,
    aggregateId?: string,
    tenantId?: string,
    retryCount?: number,
    detail: string = "事件版本冲突，已重试指定次数但仍失败",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "事件版本冲突",
      detail,
      HttpStatus.CONFLICT,
      {
        currentVersion,
        expectedVersion,
        aggregateId,
        tenantId,
        retryCount,
      },
      errorCode || "EVENT_STORE_VERSION_CONFLICT",
      rootCause,
    );
  }
}

/**
 * @description 事件发布异常
 * @remarks 用于事件发布操作失败时的异常处理
 */
export class EventPublisherException extends GeneralInternalServerException {
  /**
   * @description 构造函数
   * @param detail - 错误详细信息（中文）
   * @param errorCode - 业务错误码
   * @param context - 错误上下文信息
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "事件发布操作失败",
    errorCode?: string,
    context?: Record<string, unknown>,
    rootCause?: unknown,
  ) {
    super(detail, errorCode || "EVENT_PUBLISHER_ERROR", rootCause);
    if (context) {
      Object.assign(this, context);
    }
  }
}

/**
 * @description 消息队列异常
 * @remarks 用于消息队列操作失败时的异常处理
 */
export class MessageBrokerException extends InternalServiceUnavailableException {
  /**
   * @description 构造函数
   * @param service - 消息队列服务名称
   * @param detail - 错误详细信息（中文）
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    service: string = "消息队列",
    detail: string = "消息队列服务不可用",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      service,
      detail,
      errorCode || "MESSAGE_BROKER_UNAVAILABLE",
      rootCause,
    );
  }
}

/**
 * @description 权限能力异常
 * @remarks 用于权限能力解析失败时的异常处理
 */
export class CaslAbilityException extends GeneralInternalServerException {
  /**
   * @description 构造函数
   * @param detail - 错误详细信息（中文）
   * @param errorCode - 业务错误码
   * @param context - 错误上下文信息
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "权限能力解析失败",
    errorCode?: string,
    context?: Record<string, unknown>,
    rootCause?: unknown,
  ) {
    super(detail, errorCode || "CASL_ABILITY_ERROR", rootCause);
    if (context) {
      Object.assign(this, context);
    }
  }
}

/**
 * @description 权限缓存异常
 * @remarks 用于权限缓存操作失败时的异常处理
 */
export class AbilityCacheException extends InternalServiceUnavailableException {
  /**
   * @description 构造函数
   * @param service - 缓存服务名称
   * @param detail - 错误详细信息（中文）
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    service: string = "权限缓存",
    detail: string = "权限缓存服务不可用，已降级到直接查询",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(service, detail, errorCode || "ABILITY_CACHE_UNAVAILABLE", rootCause);
  }
}

/**
 * @description 审计服务异常
 * @remarks 用于审计服务操作失败时的异常处理
 */
export class AuditServiceException extends GeneralInternalServerException {
  /**
   * @description 构造函数
   * @param detail - 错误详细信息（中文）
   * @param errorCode - 业务错误码
   * @param context - 错误上下文信息
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "审计服务操作失败",
    errorCode?: string,
    context?: Record<string, unknown>,
    rootCause?: unknown,
  ) {
    super(detail, errorCode || "AUDIT_SERVICE_ERROR", rootCause);
    if (context) {
      Object.assign(this, context);
    }
  }
}

/**
 * @description 配置服务异常
 * @remarks 用于配置服务操作失败时的异常处理
 */
export class ConfigurationException extends GeneralInternalServerException {
  /**
   * @description 构造函数
   * @param detail - 错误详细信息（中文）
   * @param errorCode - 业务错误码
   * @param context - 错误上下文信息
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "配置服务操作失败",
    errorCode?: string,
    context?: Record<string, unknown>,
    rootCause?: unknown,
  ) {
    super(detail, errorCode || "CONFIGURATION_ERROR", rootCause);
    if (context) {
      Object.assign(this, context);
    }
  }
}
