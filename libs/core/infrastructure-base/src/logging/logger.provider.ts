/**
 * @fileoverview 日志提供者
 * @description 集成 @hl8/logger 提供统一日志输出，支持依赖注入
 *
 * ## 业务规则
 *
 * ### 日志输出规则
 * - 使用 @hl8/logger 提供的日志服务
 * - 支持结构化日志输出
 * - 支持日志级别控制
 * - 支持日志上下文传递
 *
 * ### 日志格式规则
 * - 统一日志格式，包含时间戳、级别、消息、上下文等信息
 * - 支持日志脱敏，自动过滤敏感信息
 * - 支持日志聚合，便于日志分析和审计
 *
 * ### 日志级别规则
 * - error：错误日志，记录系统错误和异常
 * - warn：警告日志，记录警告信息
 * - info：信息日志，记录重要业务信息
 * - debug：调试日志，记录调试信息
 * - trace：跟踪日志，记录详细跟踪信息
 */

import { Logger } from "@hl8/logger";
import { Global, Module, Provider } from "@nestjs/common";

/**
 * @description 日志提供者
 * @remarks 提供日志服务的依赖注入支持
 */
export const LoggerProvider: Provider = {
  provide: Logger,
  useExisting: Logger,
};

/**
 * @description 日志模块
 * @remarks 注册日志服务为全局模块，支持依赖注入
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [LoggingModule],
 * })
 * export class AppModule {}
 *
 * // 使用日志服务
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly logger: Logger) {}
 *
 *   doSomething() {
 *     this.logger.info("执行某个操作", { context: "MyService" });
 *   }
 * }
 * ```
 */
@Global()
@Module({
  providers: [LoggerProvider],
  exports: [LoggerProvider],
})
export class LoggingModule {}
