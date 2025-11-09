/**
 * 身份函数工具
 *
 * @description 提供身份函数工具
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

/**
 * 身份函数
 * @description 返回输入值的身份函数
 * @param value 输入值
 * @returns 输入值本身
 * @example
 * ```typescript
 * const result = identity('test'); // 'test'
 * ```
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */
export const identity = <T>(value: T): T => value;
