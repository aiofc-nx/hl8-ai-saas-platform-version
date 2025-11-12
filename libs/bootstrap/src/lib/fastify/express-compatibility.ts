import type { FastifyInstance, FastifyReply } from "fastify";
import type { Socket } from "node:net";

/**
 * @description 应用 Fastify 官方推荐的 Express 兼容性设置，提升中间件复用能力
 * @param fastify Fastify 实例对象
 * @returns void
 * @throws 无显式抛出异常
 * @example
 * ```typescript
 * applyExpressCompatibilityRecommendations(app.getHttpAdapter().getInstance());
 * ```
 */
export function applyExpressCompatibilityRecommendations(
  fastify: unknown,
): void {
  const instance = fastify as FastifyInstance | undefined;

  if (!instance?.addHook || !instance.decorateReply) {
    return;
  }

  instance
    .addHook("onRequest", async (req) => {
      const socket = req.socket as Socket & {
        encrypted?: boolean;
      };
      socket.encrypted = process.env.NODE_ENV === "production";
    })
    .decorateReply(
      "setHeader",
      function (this: FastifyReply, name: string, value: unknown) {
        this.header(name, value);
      },
    )
    .decorateReply("end", function (this: FastifyReply) {
      this.send("");
    });
}
