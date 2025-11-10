import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Logger } from "@hl8/logger";
import type { StructuredLogContext } from "@hl8/logger";
import { AppConfig } from "./config/app.config.js";

/**
 * @description 应用根控制器，提供健康检查与基础信息查询接口
 * @example
 * ```typescript
 * // 健康检查
 * const result = await httpClient.get('/');
 * // 应用信息
 * const info = await httpClient.get('/info');
 * ```
 */
@ApiTags("健康检查")
@Controller()
export class AppController {
  private readonly logger: Logger;

  constructor(
    logger: Logger,
    private readonly config: AppConfig, // 注入配置服务
  ) {
    // 创建子日志器，自动继承请求上下文
    this.logger = logger.child({
      module: "AppController",
      component: "health-check",
    });
  }
  /**
   * @description 健康检查端点，供负载均衡器或监控系统探测应用存活状态
   * @returns 应用状态信息
   */
  @Get()
  @ApiOperation({
    summary: "健康检查",
    description: "返回应用的健康状态，用于负载均衡器和监控系统",
  })
  @ApiResponse({
    status: 200,
    description: "应用运行正常",
    schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          example: "ok",
        },
        timestamp: {
          type: "string",
          format: "date-time",
          example: "2025-10-12T04:00:00.000Z",
        },
      },
    },
  })
  getHealth(): { status: string; timestamp: string } {
    this.logger.log("健康检查请求", {
      business: {
        operation: "healthCheck",
        resource: "Application",
        action: "check",
      },
    } satisfies StructuredLogContext);

    const result = {
      status: "ok",
      timestamp: new Date().toISOString(),
    };

    this.logger.log("健康检查完成", {
      business: {
        operation: "healthCheck",
        resource: "Application",
        action: "completed",
      },
      status: result.status,
    } satisfies StructuredLogContext);

    return result;
  }

  /**
   * @description 应用信息端点，返回版本、环境等基础信息
   * @returns API 基本信息
   */
  @Get("info")
  @ApiOperation({
    summary: "获取应用信息",
    description: "返回应用的版本、名称和运行环境等基本信息",
  })
  @ApiResponse({
    status: 200,
    description: "成功返回应用信息",
    schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          example: "Fastify API",
        },
        version: {
          type: "string",
          example: "1.0.0",
        },
        environment: {
          type: "string",
          example: "development",
        },
        port: {
          type: "number",
          example: 3000,
        },
      },
    },
  })
  getInfo(): {
    name: string;
    version: string;
    environment: string;
    port: number;
  } {
    this.logger.log("获取应用信息请求", {
      business: {
        operation: "getInfo",
        resource: "Application",
        action: "read",
      },
    } satisfies StructuredLogContext);

    const result = {
      name: "Fastify API",
      version: "1.0.0",
      environment: this.config.NODE_ENV || "development",
      port: this.config.PORT,
    };

    this.logger.log("应用信息获取完成", {
      business: {
        operation: "getInfo",
        resource: "Application",
        action: "completed",
      },
      appName: result.name,
      version: result.version,
      environment: result.environment,
    } satisfies StructuredLogContext);

    return result;
  }
}
