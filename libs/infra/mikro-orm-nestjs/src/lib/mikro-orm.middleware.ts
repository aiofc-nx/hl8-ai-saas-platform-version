import { MikroORM, RequestContext } from "@mikro-orm/core";
import { Injectable, type NestMiddleware } from "@nestjs/common";

/**
 * @description 基于 MikroORM 的 Nest 中间件，负责创建请求级 EntityManager 上下文
 */
@Injectable()
export class MikroOrmMiddleware implements NestMiddleware {
  constructor(private readonly orm: MikroORM) {}

  /**
   * @description 为当前请求创建 ORM 上下文后继续执行
   * @param req - 请求对象
   * @param res - 响应对象
   * @param next - 下一步回调
   * @returns void
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use(req: unknown, res: unknown, next: (...args: any[]) => void) {
    RequestContext.create(this.orm.em, next);
  }
}
