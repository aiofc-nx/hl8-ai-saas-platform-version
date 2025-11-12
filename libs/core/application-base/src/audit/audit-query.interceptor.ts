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
 * @description 查询执行审计拦截器，适用于读操作的 API。
 */
@Injectable()
export class AuditQueryInterceptor implements NestInterceptor {
  public constructor(private readonly auditCoordinator: AuditCoordinator) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      query?: Record<string, unknown>;
      securityContext?: SecurityContext;
      user?: { securityContext?: SecurityContext };
    }>();
    const securityContext =
      request?.securityContext ?? request?.user?.securityContext;
    if (!securityContext) {
      return next.handle();
    }

    const action = context.getHandler()?.name ?? "UnknownQuery";
    return next.handle().pipe(
      mergeMap(async (result) => {
        await this.auditCoordinator.record(securityContext, {
          tenantId: securityContext.tenantId,
          userId: securityContext.userId,
          action,
          payload: request?.query,
          result,
          metadata: { channel: "query" },
        });
        return result;
      }),
    );
  }
}
