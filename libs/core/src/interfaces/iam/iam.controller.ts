import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { TenantProvisionRequestDto } from "./dto/tenant-provision.request.dto.js";

/**
 * @zh
 * @description IAM 控制器占位实现，后续将调用应用层命令处理器。
 */
@Controller({
  path: "iam",
  version: "1",
})
export class IamController {
  /**
   * @zh
   * @description 租户开户接口占位实现。
   * @param payload 租户开户入参
   * @returns 当前仅返回占位响应
   */
  @Post("tenants")
  @HttpCode(HttpStatus.ACCEPTED)
  public async provisionTenant(
    @Body() payload: TenantProvisionRequestDto,
  ): Promise<{ accepted: boolean }> {
    void payload;
    // TODO: 调用应用层命令处理器并返回领域结果
    return { accepted: true };
  }
}

