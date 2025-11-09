/**
 * @description 注册进程级错误处理器，确保未捕获异常与未处理拒绝被统一记录
 * @param onError 错误回调函数，负责输出或记录消息
 * @returns void
 * @throws 无显式抛出异常
 * @example
 * ```typescript
 * registerProcessErrorHandlers((message) => logger.error(message));
 * ```
 */
export function registerProcessErrorHandlers(
  onError: (message: string) => void,
): void {
  process.on("uncaughtException", (error) => {
    onError(`未捕获异常: ${(error as Error).message}`);
  });

  process.on("unhandledRejection", (reason) => {
    onError(`未处理的 Promise 拒绝: ${String(reason)}`);
  });
}
