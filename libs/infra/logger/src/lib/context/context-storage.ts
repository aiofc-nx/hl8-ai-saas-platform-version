/**
 * 上下文存储服务
 *
 * @description 使用 AsyncLocalStorage 管理请求上下文
 *
 * ## 业务规则
 *
 * ### 上下文生命周期
 * - 在 onRequest 钩子中设置上下文
 * - 在异步调用链中自动传播
 * - 请求结束后自动清理（AsyncLocalStorage 自动处理）
 *
 * ### 性能要求
 * - 获取上下文开销 < 0.1ms
 * - 存储上下文开销 < 0.1ms
 * - 不应造成内存泄漏
 *
 * @since 1.0.0
 */

import { AsyncLocalStorage } from "async_hooks";
import type { RequestContext } from "./request-context.types.js";

/**
 * 上下文存储服务
 *
 * @description 使用 AsyncLocalStorage 存储和获取请求上下文
 * 提供类型安全的访问方法
 *
 * @class ContextStorage
 */
export class ContextStorage {
  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  /**
   * 获取当前请求上下文
   *
   * @description 从 AsyncLocalStorage 获取当前异步上下文中的请求上下文
   *
   * @returns 请求上下文或 undefined（如果不在请求上下文中）
   *
   * @example
   * ```typescript
   * const context = ContextStorage.getContext();
   * if (context) {
   *   console.log(context.requestId);
   * }
   * ```
   */
  static getContext(): RequestContext | undefined {
    return this.storage.getStore();
  }

  /**
   * 在上下文中运行函数
   *
   * @description 在指定的请求上下文中执行函数
   * 函数执行完成后上下文自动清理
   *
   * @param context - 请求上下文
   * @param fn - 要运行的函数
   * @returns 函数返回值
   *
   * @example
   * ```typescript
   * const result = ContextStorage.run(
   *   { requestId: '123', method: 'GET' },
   *   () => {
   *     // 在此函数中，可以通过 getContext() 获取上下文
   *     const ctx = ContextStorage.getContext();
   *     return ctx?.requestId;
   *   }
   * );
   * ```
   */
  static run<T>(context: RequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /**
   * 在上下文中运行异步函数
   *
   * @description 在指定的请求上下文中执行异步函数
   * 函数执行完成后上下文自动清理
   * 上下文在异步调用链中自动传播
   *
   * @param context - 请求上下文
   * @param fn - 要运行的异步函数
   * @returns Promise<T>
   *
   * @example
   * ```typescript
   * const result = await ContextStorage.runAsync(
   *   { requestId: '123', method: 'GET' },
   *   async () => {
   *     // 在此异步函数中，可以通过 getContext() 获取上下文
   *     const ctx = ContextStorage.getContext();
   *     return await someAsyncOperation(ctx?.requestId);
   *   }
   * );
   * ```
   */
  static async runAsync<T>(
    context: RequestContext,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.storage.run(context, fn);
  }

  /**
   * 在当前异步上下文中设置上下文
   *
   * @description 使用 AsyncLocalStorage.enterWith 方法在当前异步上下文中设置上下文
   * 与 run() 和 runAsync() 不同，enterWith() 不会在函数返回时自动清理上下文
   * 上下文会在后续的异步操作中自动传播
   *
   * ## 使用场景
   *
   * - 在 Fastify 钩子中设置上下文，确保路由处理函数可以访问
   * - 在中间件中设置上下文，确保后续处理可以访问
   *
   * ## 注意事项
   *
   * - 使用 enterWith() 后，上下文不会自动清理，需要手动管理生命周期
   * - 建议在请求开始时调用 enterWith()，在请求结束时清理
   *
   * @param context - 请求上下文
   *
   * @example
   * ```typescript
   * // 在 Fastify onRequest 钩子中
   * fastify.addHook('onRequest', async (request, reply) => {
   *   const context = extractContext(request);
   *   ContextStorage.enterWith(context);
   *   // 后续的异步操作（包括路由处理函数）都可以访问上下文
   * });
   *
   * // 在路由处理函数中
   * app.get('/test', async () => {
   *   const context = ContextStorage.getContext(); // 可以获取上下文
   *   return { requestId: context?.requestId };
   * });
   * ```
   */
  static enterWith(context: RequestContext): void {
    this.storage.enterWith(context);
  }
}
