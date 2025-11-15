import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Logger } from "@hl8/logger";
import type { StructuredLogContext } from "@hl8/logger";
import { EntityManager } from "@mikro-orm/core";
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
    private readonly em: EntityManager, // 注入 EntityManager 用于数据库连接测试（单数据源场景直接注入）
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

  /**
   * @description 数据库连接测试端点，用于验证数据库连接状态
   * @returns 数据库连接状态信息
   */
  @Get("db/health")
  @ApiOperation({
    summary: "数据库连接测试",
    description: "测试数据库连接是否正常",
  })
  @ApiResponse({
    status: 200,
    description: "数据库连接正常",
    schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          example: "connected",
        },
        database: {
          type: "string",
          example: "hl8-platform",
        },
        version: {
          type: "string",
          example: "PostgreSQL 15.0",
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: "数据库连接失败",
  })
  async getDbHealth(): Promise<{
    status: string;
    database?: string;
    version?: string;
    error?: string;
  }> {
    this.logger.log("数据库连接测试请求", {
      business: {
        operation: "dbHealthCheck",
        resource: "Database",
        action: "check",
      },
    } satisfies StructuredLogContext);

    try {
      // 执行简单的 SQL 查询来测试连接
      const result = await this.em
        .getConnection()
        .execute("SELECT version(), current_database() as db_name");

      const version = result[0]?.version as string | undefined;
      const dbName = result[0]?.db_name as string | undefined;

      const response = {
        status: "connected",
        database: dbName,
        version: version?.split(",")[0], // 只取版本号部分
      };

      this.logger.log("数据库连接测试成功", {
        business: {
          operation: "dbHealthCheck",
          resource: "Database",
          action: "completed",
        },
        database: dbName,
      } satisfies StructuredLogContext);

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      this.logger.error(errorObj, {
        business: {
          operation: "dbHealthCheck",
          resource: "Database",
          action: "failed",
        },
        error: errorMessage,
      } satisfies StructuredLogContext);

      return {
        status: "disconnected",
        error: errorMessage,
      };
    }
  }
}
