/**
 * 调试工具
 *
 * @description 提供调试工具
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

import debugLib from "debug";

/**
 * 调试函数
 * @description 创建调试函数
 * @param namespace 调试命名空间
 * @returns 调试函数
 * @example
 * ```typescript
 * const debug = createDebug('hl8:config');
 * debug('配置加载完成');
 * ```
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */
export const createDebug = (namespace: string) => debugLib(namespace);

/**
 * 默认调试函数
 * @description 默认的调试函数
 */
export const debug = createDebug("hl8:config");
