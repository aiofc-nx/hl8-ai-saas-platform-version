import { RequestContext, type MikroORM } from "@mikro-orm/core";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import { InjectMikroORMs } from "./mikro-orm.common.js";

/**
 * @description 多上下文 MikroORM 中间件，支持同一请求绑定多个 ORM 实例
 */
@Injectable()
export class MultipleMikroOrmMiddleware implements NestMiddleware {
  constructor(@InjectMikroORMs() private readonly orm: MikroORM[]) {}

  /**
   * @description 创建多个 EntityManager 的请求上下文
   * @param req - 请求对象
   * @param res - 响应对象
   * @param next - 下一步回调
   * @returns void
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use(req: unknown, res: unknown, next: (...args: any[]) => void) {
    RequestContext.create(
      this.orm.map((orm) => orm.em),
      next,
    );
  }
}
