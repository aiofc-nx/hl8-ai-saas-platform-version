import type { MikroOrmMiddlewareModuleOptions } from "./typings.js";
import { type MiddlewareConsumer } from "@nestjs/common";

/**
 * @description 计算 Fastify 环境下中间件适用的路由匹配路径
 * @param options - 中间件配置
 * @param consumer - Nest 中间件消费者（保留以兼容调用签名）
 * @returns 路由匹配表达式
 */
export function forRoutesPath(
  options: MikroOrmMiddlewareModuleOptions,
  consumer: MiddlewareConsumer,
) {
  if (options.forRoutesPath) {
    return options.forRoutesPath;
  }

  return "(.*)";
}
