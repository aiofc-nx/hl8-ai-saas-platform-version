import {
  Global,
  Inject,
  Module,
  RequestMethod,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import type { MikroORM } from "@mikro-orm/core";

import { forRoutesPath } from "./middleware.helper.js";
import {
  CONTEXT_NAMES,
  getMikroORMToken,
  MIKRO_ORM_MODULE_OPTIONS,
} from "./mikro-orm.common.js";
import { MultipleMikroOrmMiddleware } from "./multiple-mikro-orm.middleware.js";
import type { MikroOrmMiddlewareModuleOptions } from "./typings.js";

/**
 * @description MikroORM 中间件模块，负责批量注册请求上下文中间件
 */
@Global()
@Module({})
export class MikroOrmMiddlewareModule implements NestModule {
  constructor(
    @Inject(MIKRO_ORM_MODULE_OPTIONS)
    private readonly options: MikroOrmMiddlewareModuleOptions,
  ) {}

  /**
   * @description 构建中间件模块
   * @param options - 中间件配置项
   * @returns 动态模块定义
   */
  static forRoot(options?: MikroOrmMiddlewareModuleOptions) {
    const inject = CONTEXT_NAMES.map((name) => getMikroORMToken(name));
    return {
      module: MikroOrmMiddlewareModule,
      providers: [
        { provide: MIKRO_ORM_MODULE_OPTIONS, useValue: options || {} },
        {
          provide: "MikroORMs",
          useFactory: (...args: MikroORM[]) => args,
          inject,
        },
      ],
      exports: ["MikroORMs"],
    };
  }

  /**
   * @description 为所有路由注册多上下文 ORM 中间件
   * @param consumer - 中间件消费者
   * @returns void
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MultipleMikroOrmMiddleware).forRoutes({
      path: forRoutesPath(this.options, consumer),
      method: RequestMethod.ALL,
    });
  }
}
