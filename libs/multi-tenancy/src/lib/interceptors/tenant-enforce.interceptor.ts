import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  SetMetadata,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { Logger } from "@hl8/logger";
import { ClsService } from "nestjs-cls";
import {
  GeneralForbiddenException,
  GeneralUnauthorizedException,
} from "@hl8/exceptions";
import type { TenantClsStore } from "../tenant-cls-store.js";
import { TenantContextExecutor } from "../tenant-context.executor.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description Metadata Key：用于标记当前处理器可跳过租户校验
 */
export const SKIP_TENANT_KEY = "skipTenant";

/**
 * @description 装饰器：在控制器或处理器上声明可跳过租户过滤
 */
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);

/**
 * @description 多租户拦截器，负责在进入业务逻辑前校验并注入租户上下文
 */
@Injectable()
export class TenantEnforceInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService<TenantClsStore>,
    private readonly tenantExecutor: TenantContextExecutor,
    private readonly logger: LoggerService,
  ) {}

  /**
   * @description 拦截 HTTP 请求，确保租户上下文存在并写入 CLS
   * @param context NestJS 执行上下文
   * @param next 调用链处理器
   * @returns 继续执行的可观察对象
   */
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const handler = context.getHandler();
    const targetClass = context.getClass();
    const skipTenant = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_KEY,
      [handler, targetClass],
    );

    if (skipTenant) {
      this.logger.warn("当前请求被标记为跳过租户拦截", {
        controller: targetClass.name,
        handler: handler.name,
      });
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    if (!request) {
      this.logger.error("非 HTTP 请求上下文无法解析租户信息");
      throw new InternalServerErrorException("无法解析租户上下文");
    }

    const headerTenant = request.headers?.["x-tenant-id"];
    const headerTenantId = Array.isArray(headerTenant)
      ? headerTenant[0]
      : headerTenant;
    const tenantId =
      request.tenantId ?? headerTenantId ?? request.user?.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      this.logger.error("缺少租户上下文，拒绝继续处理请求");
      throw new GeneralUnauthorizedException("缺少租户上下文");
    }

    const clsTenantId = this.cls.get("tenantId");
    if (clsTenantId && clsTenantId !== tenantId) {
      this.logger.error("检测到跨租户访问尝试", undefined, {
        expectedTenantId: clsTenantId,
        incomingTenantId: tenantId,
      });
      throw new GeneralForbiddenException("禁止跨租户访问");
    }

    this.cls.set("tenantId", tenantId);
    if (request.user?.id) {
      this.cls.set("userId", request.user.id);
    }

    this.logger.log("已注入租户上下文", {
      tenantId,
      controller: targetClass.name,
      handler: handler.name,
    });

    this.tenantExecutor.getTenantIdOrFail();

    return next.handle();
  }
}
