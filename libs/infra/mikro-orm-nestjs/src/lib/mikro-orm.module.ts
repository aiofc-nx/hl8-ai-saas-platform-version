import { Utils, type AnyEntity } from "@mikro-orm/core";
import { Module, type DynamicModule } from "@nestjs/common";
import { MikroOrmCoreModule } from "./mikro-orm-core.module.js";
import { MikroOrmMiddlewareModule } from "./mikro-orm-middleware.module.js";
import { MikroOrmEntitiesStorage } from "./mikro-orm.entities.storage.js";
import { createMikroOrmRepositoryProviders } from "./mikro-orm.providers.js";
import type {
  EntityName,
  MikroOrmModuleAsyncOptions,
  MikroOrmModuleFeatureOptions,
  MikroOrmModuleSyncOptions,
  MikroOrmMiddlewareModuleOptions,
  MaybePromise,
} from "./typings.js";

@Module({})
export class MikroOrmModule {
  /**
   * 清空实体存储
   *
   * @description
   * 重置 `MikroOrmEntitiesStorage`，避免跨测试共享实体定义。
   * 适用于保持上下文存活的测试运行器（如禁用线程的 Vitest）。
   *
   * @param contextName - 指定上下文名称，缺省时清空全部上下文
   * @returns void
   */
  static clearStorage(contextName?: string) {
    MikroOrmEntitiesStorage.clear(contextName);
  }

  /**
   * @description 同步注册 MikroORM 上下文
   * @param options - 单个或多个同步配置
   * @returns 动态模块或模块数组（多上下文场景）
   */
  static forRoot(
    options?: MikroOrmModuleSyncOptions,
  ): MaybePromise<DynamicModule>;
  static forRoot(
    options?: MikroOrmModuleSyncOptions[],
  ): MaybePromise<DynamicModule>[];
  static forRoot(
    options?: MikroOrmModuleSyncOptions | MikroOrmModuleSyncOptions[],
  ): MaybePromise<DynamicModule> | MaybePromise<DynamicModule>[] {
    if (Array.isArray(options)) {
      return options.map((o) => MikroOrmCoreModule.forRoot(o));
    }

    return MikroOrmCoreModule.forRoot(options);
  }

  /**
   * @description 异步注册 MikroORM 上下文
   * @param options - 单个或多个异步配置
   * @returns 动态模块或模块数组
   */
  static forRootAsync(
    options: MikroOrmModuleAsyncOptions,
  ): MaybePromise<DynamicModule>;
  static forRootAsync(
    options: MikroOrmModuleAsyncOptions[],
  ): MaybePromise<DynamicModule>[];
  static forRootAsync(
    options: MikroOrmModuleAsyncOptions | MikroOrmModuleAsyncOptions[],
  ): MaybePromise<DynamicModule> | MaybePromise<DynamicModule>[] {
    if (Array.isArray(options)) {
      return options.map((o) => MikroOrmCoreModule.forRootAsync(o));
    }

    return MikroOrmCoreModule.forRootAsync(options);
  }

  /**
   * @description 注册实体仓储 Provider
   * @param options - 实体名称数组或功能配置
   * @param contextName - 可选上下文名称
   * @returns 动态模块，导出仓储 Provider
   */
  static forFeature(
    options: EntityName<AnyEntity>[] | MikroOrmModuleFeatureOptions,
    contextName?: string,
  ): DynamicModule {
    const entities = Array.isArray(options) ? options : options.entities || [];
    const name =
      Array.isArray(options) || contextName ? contextName : options.contextName;
    const providers = createMikroOrmRepositoryProviders(entities, name);

    for (const e of entities) {
      if (!Utils.isString(e)) {
        MikroOrmEntitiesStorage.addEntity(e, name);
      }
    }

    return {
      module: MikroOrmModule,
      providers: [...providers],
      exports: [...providers],
    };
  }

  /**
   * @description 注册 MikroORM 中间件模块
   * @param options - 中间件配置
   * @returns 动态模块
   */
  static forMiddleware(
    options?: MikroOrmMiddlewareModuleOptions,
  ): DynamicModule {
    return MikroOrmMiddlewareModule.forRoot(options);
  }
}
