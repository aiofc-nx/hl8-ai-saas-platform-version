import {
  GeneralBadRequestException,
  GeneralForbiddenException,
} from "@hl8/exceptions";

/**
 * @public
 * @description 应用层安全上下文，封装执行命令或查询时的多租户身份信息。
 */
export interface SecurityContext {
  /**
   * @description 当前操作所属租户标识。
   */
  readonly tenantId: string;
  /**
   * @description 当前操作所属组织标识列表，允许为空表示跨组织资源。
   */
  readonly organizationIds?: readonly string[];
  /**
   * @description 当前操作所属部门标识列表，允许为空表示跨部门资源。
   */
  readonly departmentIds?: readonly string[];
  /**
   * @description 当前操作的用户标识。
   */
  readonly userId: string;
  /**
   * @description 额外上下文信息，供审计或扩展逻辑使用。
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * @public
 * @description 校验安全上下文是否包含必填字段。
 * @param context - 待校验的安全上下文。
 * @throws {GeneralBadRequestException} 当上下文缺失租户或用户信息时抛出。
 */
export const assertSecurityContext = (
  context: SecurityContext | null | undefined,
): SecurityContext => {
  if (!context) {
    throw new GeneralBadRequestException({
      field: "securityContext",
      message: "安全上下文缺失，禁止执行操作",
    });
  }

  const { tenantId, userId } = context;
  if (!tenantId) {
    throw new GeneralBadRequestException({
      field: "securityContext.tenantId",
      message: "安全上下文缺少租户标识",
    });
  }
  if (!userId) {
    throw new GeneralBadRequestException({
      field: "securityContext.userId",
      message: "安全上下文缺少用户标识",
    });
  }
  return context;
};

/**
 * @public
 * @description 校验当前上下文是否允许访问指定租户。
 * @param context - 当前安全上下文。
 * @param tenantId - 目标租户标识。
 * @param message - 自定义错误文案。
 * @throws {GeneralForbiddenException} 当上下文与目标租户不一致时抛出。
 */
export const assertTenantScope = (
  context: SecurityContext,
  tenantId: string,
  message = "禁止跨租户访问资源",
): void => {
  const { tenantId: currentTenantId } = assertSecurityContext(context);
  if (currentTenantId !== tenantId) {
    throw new GeneralForbiddenException(message);
  }
};

/**
 * @public
 * @description 校验当前上下文是否允许访问指定组织。
 * @param context - 当前安全上下文。
 * @param organizationId - 目标组织标识。
 * @param message - 自定义错误文案。
 * @throws {GeneralForbiddenException} 当上下文未声明组织或不包含指定组织时抛出。
 */
export const assertOrganizationScope = (
  context: SecurityContext,
  organizationId: string,
  message = "禁止跨组织访问资源",
): void => {
  const { organizationIds } = assertSecurityContext(context);
  if (!organizationIds || !organizationIds.includes(organizationId)) {
    throw new GeneralForbiddenException(message);
  }
};

/**
 * @public
 * @description 校验当前上下文是否允许访问指定部门。
 * @param context - 当前安全上下文。
 * @param departmentId - 目标部门标识。
 * @param message - 自定义错误文案。
 * @throws {GeneralForbiddenException} 当上下文未声明部门或不包含指定部门时抛出。
 */
export const assertDepartmentScope = (
  context: SecurityContext,
  departmentId: string,
  message = "禁止跨部门访问资源",
): void => {
  const { departmentIds } = assertSecurityContext(context);
  if (!departmentIds || !departmentIds.includes(departmentId)) {
    throw new GeneralForbiddenException(message);
  }
};
