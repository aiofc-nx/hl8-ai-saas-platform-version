import { randomUUID } from "node:crypto";
import { createFastifyLoggerConfig } from "@hl8/logger";
import { FastifyAdapter } from "@nestjs/platform-fastify";

/**
 * @description 构建 FastifyAdapter，统一日志配置、请求 ID 策略与网络安全选项
 * @param options 适配器构建配置选项，支持自定义日志、请求 ID、代理与请求体限制
 * @returns FastifyAdapter 实例，供 NestFactory 创建 Fastify 应用时复用
 * @throws 无显式抛出异常
 * @example
 * ```typescript
 * const adapter = buildFastifyAdapter({
 *   nodeEnv: "production",
 *   requestIdHeader: "x-request-id",
 * });
 * ```
 */
export function buildFastifyAdapter(
  options: BuildFastifyAdapterOptions = {},
): FastifyAdapter {
  const {
    nodeEnv = process.env.NODE_ENV ?? "development",
    logLevel = process.env.LOG_LEVEL ?? process.env.LOGGING__LEVEL ?? "info",
    requestIdHeader,
    trustProxy = true,
    bodyLimit = 10_485_760,
    developmentLoggerConfig,
    productionLoggerConfig,
  } = options;

  const isDevelopment = nodeEnv === "development";
  const headerName = requestIdHeader ?? "x-request-id";
  const resolvedGenReqId =
    options.genReqId ??
    ((req: { headers?: Record<string, unknown> }) =>
      (req.headers?.[headerName] as string | undefined) ?? randomUUID());

  return new FastifyAdapter({
    logger: isDevelopment
      ? createFastifyLoggerConfig({
          level: logLevel,
          prettyPrint: developmentLoggerConfig?.prettyPrint ?? true,
          colorize: developmentLoggerConfig?.colorize ?? true,
          translateTime:
            developmentLoggerConfig?.translateTime ?? "SYS:standard",
          ignore: developmentLoggerConfig?.ignore ?? "pid,hostname",
        })
      : createFastifyLoggerConfig({
          level: logLevel,
          prettyPrint: productionLoggerConfig?.prettyPrint ?? false,
          colorize: productionLoggerConfig?.colorize,
          translateTime: productionLoggerConfig?.translateTime,
          ignore: productionLoggerConfig?.ignore,
        }),
    genReqId: resolvedGenReqId,
    trustProxy,
    bodyLimit,
  });
}

/**
 * @description FastifyAdapter 构建参数定义，列举适配器支持的全部可配置能力
 */
export interface BuildFastifyAdapterOptions {
  /**
   * @description 当前运行环境，默认读取 `process.env.NODE_ENV`
   */
  nodeEnv?: string;
  /**
   * @description 日志级别，默认从 `LOG_LEVEL` 或 `LOGGING__LEVEL` 环境变量读取
   */
  logLevel?: string;
  /**
   * @description 请求头中的请求 ID 字段名，默认使用 `x-request-id`
   */
  requestIdHeader?: string;
  /**
   * @description 自定义请求 ID 生成函数，可接入链路追踪方案
   */
  genReqId?: (req: { headers?: Record<string, unknown> }) => string;
  /**
   * @description 是否信任上游代理，默认开启以兼容反向代理与负载均衡
   */
  trustProxy?: boolean;
  /**
   * @description 请求体大小上限（单位字节），默认 10 MB
   */
  bodyLimit?: number;
  /**
   * @description 开发环境日志配置，覆盖默认 Pretty Print 预设
   */
  developmentLoggerConfig?: LoggerPresetOptions;
  /**
   * @description 生产环境日志配置，覆盖默认 JSON 输出预设
   */
  productionLoggerConfig?: LoggerPresetOptions;
}

/**
 * @description Fastify 日志预设配置，精细化控制 Pino 输出表现
 */
export interface LoggerPresetOptions {
  /**
   * @description 是否开启美化输出（仅建议在开发环境启用）
   */
  prettyPrint?: boolean;
  /**
   * @description 是否开启颜色化输出
   */
  colorize?: boolean;
  /**
   * @description 时间格式化配置
   */
  translateTime?: string;
  /**
   * @description 忽略的字段列表，使用逗号分隔
   */
  ignore?: string;
}
