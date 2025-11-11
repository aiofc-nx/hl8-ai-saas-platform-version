import { MikroORM, RequestContext } from "@mikro-orm/core";
import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import {
  getMikroORMToken,
  MIKRO_ORM_MODULE_OPTIONS,
} from "./mikro-orm.common.js";
import type { MikroOrmModuleOptions } from "./typings.js";

/**
 * @description 基于 MikroORM 的 Nest 中间件，负责创建请求级 EntityManager 上下文
 */
@Injectable()
export class MikroOrmMiddleware implements NestMiddleware {
  private orm?: MikroORM;

  constructor(
    /**
     * @description ORM 模块配置，包含上下文名称等信息
     */
    @Inject(MIKRO_ORM_MODULE_OPTIONS)
    private readonly options: MikroOrmModuleOptions,
    /**
     * @description Nest 模块引用，用于按需解析 MikroORM 实例
     */
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * @description 解析当前上下文对应的 MikroORM 实例
   * @returns MikroORM 实例
   * @throws Error 当指定上下文未注册时抛出中文异常
   */
  private resolveOrm(): MikroORM {
    if (this.orm) {
      return this.orm;
    }

    const token = this.options?.contextName
      ? getMikroORMToken(this.options.contextName)
      : MikroORM;

    const orm = this.moduleRef.get<MikroORM>(token, { strict: false });

    if (!orm) {
      throw new Error(
        `未能解析到名为 '${String(token)}' 的 MikroORM 实例，请确认模块已正确注册。`,
      );
    }

    this.orm = orm;
    return orm;
  }

  /**
   * @description 为当前请求创建 ORM 上下文后继续执行
   * @param req - 请求对象
   * @param res - 响应对象
   * @param next - 下一步回调
   * @returns void
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use(req: unknown, res: unknown, next: (...args: any[]) => void) {
    const orm = this.resolveOrm();
    RequestContext.create(orm.em, next);
  }
}
