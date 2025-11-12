/**
 * 深度遍历工具
 *
 * @description 提供深度遍历对象的工具函数
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

/**
 * 深度遍历对象
 * @description 深度遍历对象，对每个值执行回调函数
 * @param obj 要遍历的对象
 * @param callback 回调函数
 * @example
 * ```typescript
 * forEachDeep(config, (value, key, path) => {
 *   console.log(`${path}: ${value}`);
 * });
 * ```
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 *
 * @remarks
 * 使用 any 符合宪章 IX 允许场景：通用工具函数必须支持任意对象结构。
 */

export const forEachDeep = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (value: any, key: string, path: string) => void,
  path: string = "",
): void => {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        value.constructor !== Object
      ) {
        callback(value, key, currentPath);
      }

      forEachDeep(value, callback, currentPath);
    }
  }
};
