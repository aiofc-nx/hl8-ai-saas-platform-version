/**
 * @description 执行传入函数并捕获异常，若出现错误则返回 undefined，避免引导流程被中断
 * @typeParam TResult 函数执行后的返回值类型
 * @param executor 待执行的函数，通常用于获取配置、依赖或执行非关键流程
 * @returns 成功时返回函数执行结果，失败时返回 undefined
 * @throws 无显式抛出异常，所有异常在内部被捕获
 * @example
 * ```typescript
 * const config = callOrUndefinedIfException(() => app.get(AppConfig));
 * if (!config) {
 *   logger.warn("配置加载失败，已采用默认配置");
 * }
 * ```
 */
export function callOrUndefinedIfException<TResult>(
  executor: () => TResult,
): TResult | undefined {
  try {
    return executor();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Bootstrap] 捕获到初始化异常", error);
    }
    return undefined;
  }
}
