import type {
  AnyEntity,
  Constructor,
  EntityName as CoreEntityName,
  EntitySchema,
  ForkOptions,
  IDatabaseDriver,
  Options,
} from "@mikro-orm/core";
import type {
  MiddlewareConsumer,
  ModuleMetadata,
  Scope,
  Type,
} from "@nestjs/common";

/**
 * @description Promise 或同步返回值联合类型
 */
export type MaybePromise<T> = T | Promise<T>;

type MikroOrmNestScopeOptions = {
  /**
   * @description EntityManager 的 Provider 作用域，影响仓储等下游依赖
   *
   * @see [NestJS Scope Hierarchy](https://docs.nestjs.com/fundamentals/injection-scopes#scope-hierarchy)
   */
  scope?: Scope;
  /**
   * @description 当作用域非默认值时，用于 fork EntityManager 的附加参数
   *
   * @see https://mikro-orm.io/api/core/interface/ForkOptions
   */
  forkOptions?: ForkOptions;
};

export type MikroOrmMiddlewareModuleOptions = {
  /**
   * @description 中间件生效的路由匹配表达式，默认在 Fastify 环境下使用 `(.*)` 匹配所有路由
   */
  forRoutesPath?: string;
};

export type MikroOrmModuleOptions<D extends IDatabaseDriver = IDatabaseDriver> =
  {
    /**
     * @description 是否自动注册请求上下文中间件
     */
    registerRequestContext?: boolean;
    /**
     * @description 是否根据 `forFeature` 调用自动收集实体
     *
     * @see [MikroOrm - NestJS - Load Entities Automatically](https://mikro-orm.io/docs/usage-with-nestjs#load-entities-automatically)
     *
     * @default false
     */
    autoLoadEntities?: boolean;
  } & Options<D> &
    MikroOrmMiddlewareModuleOptions;

export interface MikroOrmModuleFeatureOptions {
  /**
   * @description 需要生成实体仓储的实体列表
   *
   * @see [MikroOrm - NestJS - Repositories](https://mikro-orm.io/docs/usage-with-nestjs#repositories)
   */
  entities?: EntityName<AnyEntity>[];
  /**
   * @description 仓储对应的数据源上下文名称
   *
   * @see [MikroOrm - NestJS - Multiple Database Connections](https://mikro-orm.io/docs/usage-with-nestjs#multiple-database-connections)
   */
  contextName?: string;
}

export interface MikroOrmOptionsFactory<
  D extends IDatabaseDriver = IDatabaseDriver,
> {
  /**
   * @description 创建 MikroORM 模块配置
   * @param contextName - 上下文名称
   */
  createMikroOrmOptions(
    contextName?: string,
  ): Promise<MikroOrmModuleOptions<D>> | MikroOrmModuleOptions<D>;
}

export interface MikroOrmModuleSyncOptions
  extends MikroOrmModuleOptions,
    MikroOrmNestScopeOptions {}

export interface MikroOrmModuleAsyncOptions<
  D extends IDatabaseDriver = IDatabaseDriver,
> extends Pick<ModuleMetadata, "imports" | "providers">,
    MikroOrmNestScopeOptions {
  /**
   * @description 对应的数据源上下文名称，多数据源场景必填
   *
   * @see [MikroOrm - NestJS - Multiple Database Connections](https://mikro-orm.io/docs/usage-with-nestjs#multiple-database-connections)
   */
  contextName?: string;
  useExisting?: Type<MikroOrmOptionsFactory<D>>;
  useClass?: Type<MikroOrmOptionsFactory<D>>;
  /**
   * @description 自定义配置工厂方法
   * @param args - 注入参数
   */
  useFactory?: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) =>
    | Promise<Omit<MikroOrmModuleOptions<D>, "contextName">>
    | Omit<MikroOrmModuleOptions<D>, "contextName">;
  driver?: Constructor<D>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
}

export declare type EntityName<T extends AnyEntity<T>> =
  | CoreEntityName<T>
  | EntitySchema;
