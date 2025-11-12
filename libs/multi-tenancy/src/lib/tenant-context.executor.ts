import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { Logger } from "@hl8/logger";
import { GeneralUnauthorizedException } from "@hl8/exceptions";
import type { TenantClsStore } from "./tenant-cls-store.js";

/**
 * @description 租户上下文执行器，负责统一校验与设置 CLS 中的租户信息
 */
@Injectable()
export class TenantContextExecutor {
  constructor(
    private readonly cls: ClsService<TenantClsStore>,
    private readonly logger: Logger,
  ) {}

  /**
   * @description 获取当前请求的租户标识，缺失时抛出中文异常
   * @returns 当前租户 ID
   * @throws GeneralUnauthorizedException 当 CLS 未写入租户信息时抛出
   */
  public getTenantIdOrFail(): string {
    const tenantId = this.cls.get("tenantId");
    if (!tenantId) {
      this.logger.error("缺少租户上下文，无法解析请求所属租户");
      throw new GeneralUnauthorizedException("缺少租户上下文");
    }
    return tenantId;
  }

  /**
   * @description 在新的 CLS 作用域下执行回调，并预先写入租户标识
   * @param tenantId 要注入的租户 ID
   * @param handler 业务回调
   * @returns 回调函数的执行结果
   */
  public async runWithTenantContext<T>(
    tenantId: string,
    handler: () => Promise<T>,
    extras?: Partial<TenantClsStore>,
  ): Promise<T> {
    return this.cls.run(async () => {
      this.cls.set("tenantId", tenantId);
      if (extras?.userId) {
        this.cls.set("userId", extras.userId);
      }
      if (extras?.tenantSnapshot) {
        this.cls.set("tenantSnapshot", extras.tenantSnapshot);
      }
      return handler();
    });
  }
}
