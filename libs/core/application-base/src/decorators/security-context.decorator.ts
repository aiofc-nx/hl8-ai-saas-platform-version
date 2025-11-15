/**
 * @fileoverview SecurityContext 参数装饰器
 * @description 用于在控制器方法中注入 SecurityContext
 *
 * ## 业务规则
 *
 * ### 使用规则
 * - 装饰器从请求对象中提取 SecurityContext
 * - 支持从 `request.securityContext` 或 `request.user?.securityContext` 获取
 * - 如果 SecurityContext 不存在，抛出异常
 *
 * ## 使用示例
 *
 * ```typescript
 * @Controller("tenants")
 * export class TenantController {
 *   @Post()
 *   async createTenant(
 *     @Body() dto: CreateTenantDto,
 *     @SecurityContextParam() securityContext: SecurityContext,
 *   ): Promise<void> {
 *     // 使用 securityContext
 *   }
 * }
 * ```
 */

import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { GeneralBadRequestException } from "@hl8/exceptions";
import type { SecurityContext } from "../interfaces/security-context.js";

/**
 * SecurityContext 参数装饰器
 *
 * @description 从请求对象中提取 SecurityContext 并注入到控制器方法参数中
 *
 * @returns 参数装饰器函数
 *
 * @throws {GeneralBadRequestException} 当 SecurityContext 不存在时抛出
 *
 * @example
 * ```typescript
 * import { SecurityContextParam } from '@hl8/application-base';
 * import type { SecurityContext } from '@hl8/application-base';
 *
 * @Post()
 * async createTenant(
 *   @Body() dto: CreateTenantDto,
 *   @SecurityContextParam() securityContext: SecurityContext,
 * ): Promise<void> {
 *   // 使用 securityContext
 * }
 * ```
 */
export const SecurityContextParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SecurityContext => {
    const request = ctx.switchToHttp().getRequest<{
      securityContext?: SecurityContext;
      user?: { securityContext?: SecurityContext };
    }>();

    // 优先从 request.securityContext 获取
    // 如果不存在，尝试从 request.user?.securityContext 获取
    const securityContext =
      request?.securityContext ?? request?.user?.securityContext;

    if (!securityContext) {
      throw new GeneralBadRequestException({
        field: "securityContext",
        message: "安全上下文缺失，禁止执行操作",
      });
    }

    // 验证必填字段
    if (!securityContext.tenantId) {
      throw new GeneralBadRequestException({
        field: "securityContext.tenantId",
        message: "安全上下文缺少租户标识",
      });
    }

    if (!securityContext.userId) {
      throw new GeneralBadRequestException({
        field: "securityContext.userId",
        message: "安全上下文缺少用户标识",
      });
    }

    return securityContext;
  },
);
