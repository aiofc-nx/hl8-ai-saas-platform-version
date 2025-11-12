import { Inject, Injectable, Optional } from "@nestjs/common";
import { isObservable, firstValueFrom } from "rxjs";
import { MissingConfigurationForFeatureException } from "@hl8/exceptions";
import type {
  AuditService,
  AuditRecord,
} from "../interfaces/audit-service.interface.js";
import type { SecurityContext } from "../interfaces/security-context.js";
import { AUDIT_SERVICE_TOKEN } from "../interfaces/tokens.js";
import { AuditRecordException } from "./audit-record.exception.js";

/**
 * @public
 * @description 审计协调器，统一聚合审计记录并调用底层审计服务。
 */
@Injectable()
export class AuditCoordinator {
  public constructor(
    @Optional()
    @Inject(AUDIT_SERVICE_TOKEN)
    private readonly auditService?: AuditService,
  ) {}

  /**
   * @description 记录命令或查询的执行结果。
   * @param context - 安全上下文。
   * @param record - 审计记录内容。
   * @throws {MissingConfigurationForFeatureException} 当未提供审计服务实现时抛出。
   * @throws {AuditRecordException} 当审计写入失败时抛出。
   */
  public async record<TResult>(
    context: SecurityContext,
    record: AuditRecord<TResult>,
  ): Promise<void> {
    const service = this.getAuditService();
    const mergedRecord: AuditRecord<TResult> = {
      tenantId: context.tenantId,
      userId: context.userId,
      action: record.action,
      payload: record.payload,
      result: record.result,
      metadata: {
        ...context.metadata,
        ...record.metadata,
      },
    };

    try {
      const appendResult = service.append(context, mergedRecord);
      if (isObservable(appendResult)) {
        await firstValueFrom(appendResult);
      } else {
        await appendResult;
      }
    } catch (error) {
      throw new AuditRecordException("审计写入失败", error);
    }
  }

  private getAuditService(): AuditService {
    if (!this.auditService) {
      throw new MissingConfigurationForFeatureException(
        "@hl8/application-base 缺少 AuditService 提供者，请通过 ApplicationCoreModule.register 提供实现",
      );
    }
    return this.auditService;
  }
}
