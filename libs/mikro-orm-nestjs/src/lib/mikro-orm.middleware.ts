import { MikroORM, RequestContext } from "@mikro-orm/core";
import {
  Inject,
  Injectable,
  Optional,
  type NestMiddleware,
} from "@nestjs/common";
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
    @Optional() private readonly moduleRef?: ModuleRef,
    /**
     * @description 直接注入的默认 MikroORM 实例（优先使用，用于无上下文名称的场景）
     */
    @Optional()
    @Inject(MikroORM)
    private readonly injectedOrm?: MikroORM,
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

    // 优先使用直接注入的 ORM 实例
    if (this.injectedOrm) {
      this.orm = this.injectedOrm;
      return this.orm;
    }

    // 回退到通过 ModuleRef 解析
    if (!this.moduleRef) {
      throw new Error(
        "ModuleRef 未注入且未直接注入 MikroORM 实例，无法解析。请确保 MikroOrmMiddleware 在正确的模块上下文中使用。",
      );
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
