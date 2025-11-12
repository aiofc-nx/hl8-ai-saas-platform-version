import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { mergeMap } from "rxjs/operators";
import { Observable } from "rxjs";
import type { SecurityContext } from "../interfaces/security-context.js";
import { AuditCoordinator } from "./audit-coordinator.js";

/**
 * @public
 * @description 命令执行审计拦截器，适用于基于控制器触发的命令请求。
 */
@Injectable()
export class AuditCommandInterceptor implements NestInterceptor {
  public constructor(private readonly auditCoordinator: AuditCoordinator) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      body?: Record<string, unknown>;
      securityContext?: SecurityContext;
      user?: { securityContext?: SecurityContext };
    }>();
    const securityContext =
      request?.securityContext ?? request?.user?.securityContext;
    if (!securityContext) {
      return next.handle();
    }

    const action = context.getHandler()?.name ?? "UnknownCommand";
    return next.handle().pipe(
      mergeMap(async (result) => {
        await this.auditCoordinator.record(securityContext, {
          tenantId: securityContext.tenantId,
          userId: securityContext.userId,
          action,
          payload: request?.body,
          result,
          metadata: { channel: "command" },
        });
        return result;
      }),
    );
  }
}
