import {
  Configuration,
  ConfigurationLoader,
  EntityManager,
  MikroORM,
  type Dictionary,
} from "@mikro-orm/core";
import {
  Global,
  Inject,
  Optional,
  Module,
  RequestMethod,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
  type OnApplicationShutdown,
  type Type,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { forRoutesPath } from "./middleware.helper.js";
import {
  CONTEXT_NAMES,
  getEntityManagerToken,
  getMikroORMToken,
  MIKRO_ORM_MODULE_OPTIONS,
} from "./mikro-orm.common.js";
import { MikroOrmEntitiesStorage } from "./mikro-orm.entities.storage.js";
import { MikroOrmMiddleware } from "./mikro-orm.middleware.js";
import {
  createAsyncProviders,
  createEntityManagerProvider,
  createMikroOrmProvider,
} from "./mikro-orm.providers.js";
import * as typings from "./typings.js";

async function tryRequire(name: string): Promise<Dictionary | undefined> {
  try {
    return await import(name);
  } catch {
    return undefined; // 忽略可选依赖加载失败的情况
  }
}

// 待办：后续通过平台能力动态传入包名，避免维护静态映射
const PACKAGES = {
  MongoDriver: "@mikro-orm/mongodb",
  MySqlDriver: "@mikro-orm/mysql",
  MsSqlDriver: "@mikro-orm/mssql",
  MariaDbDriver: "@mikro-orm/mariadb",
  PostgreSqlDriver: "@mikro-orm/postgresql",
  SqliteDriver: "@mikro-orm/sqlite",
  LibSqlDriver: "@mikro-orm/libsql",
  BetterSqliteDriver: "@mikro-orm/better-sqlite",
} as const;

/**
 * @description MikroORM 核心模块，负责多数据源上下文的 Provider 注册与生命周期管理
 */
@Global()
@Module({})
export class MikroOrmCoreModule implements NestModule, OnApplicationShutdown {
  constructor(
    @Inject(MIKRO_ORM_MODULE_OPTIONS)
    private readonly options: typings.MikroOrmModuleOptions,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  /**
   * @description 注册单数据源上下文
   * @param options - 同步配置项
   * @returns 动态模块定义
   */
  static async forRoot(
    options?: typings.MikroOrmModuleSyncOptions,
  ): Promise<DynamicModule> {
    const contextName = this.setContextName(options?.contextName);

    if (options?.driver && !contextName) {
      const packageName =
        PACKAGES[options.driver.name as keyof typeof PACKAGES];
      const driverPackage = await tryRequire(packageName);

      if (driverPackage) {
        return {
          module: MikroOrmCoreModule,
          providers: [
            { provide: MIKRO_ORM_MODULE_OPTIONS, useValue: options || {} },
            createMikroOrmProvider(contextName),
            createMikroOrmProvider(contextName, driverPackage.MikroORM),
            createEntityManagerProvider(options?.scope, EntityManager),
            createEntityManagerProvider(
              options?.scope,
              driverPackage.EntityManager,
            ),
          ],
          exports: [
            MikroORM,
            EntityManager,
            driverPackage.EntityManager,
            driverPackage.MikroORM,
          ],
        };
      }
    }

    const knex = await tryRequire("@mikro-orm/knex");
    const mongo = await tryRequire("@mikro-orm/mongodb");
    const em = await this.createEntityManager(options);

    if (em && !contextName) {
      const packageName =
        PACKAGES[em.getDriver().constructor.name as keyof typeof PACKAGES];
      const driverPackage = await tryRequire(packageName);

      if (driverPackage) {
        return {
          module: MikroOrmCoreModule,
          providers: [
            { provide: MIKRO_ORM_MODULE_OPTIONS, useValue: options || {} },
            createMikroOrmProvider(contextName),
            createMikroOrmProvider(contextName, driverPackage.MikroORM),
            createEntityManagerProvider(options?.scope, EntityManager),
            createEntityManagerProvider(
              options?.scope,
              driverPackage.EntityManager,
            ),
          ],
          exports: [
            MikroORM,
            EntityManager,
            driverPackage.EntityManager,
            driverPackage.MikroORM,
          ],
        };
      }
    }

    return {
      module: MikroOrmCoreModule,
      providers: [
        { provide: MIKRO_ORM_MODULE_OPTIONS, useValue: options || {} },
        createMikroOrmProvider(contextName),
        ...(mongo ? [createMikroOrmProvider(contextName, mongo.MikroORM)] : []),
        createEntityManagerProvider(options?.scope, EntityManager, contextName),
        ...(em
          ? [
              createEntityManagerProvider(
                options?.scope,
                em.constructor as Type,
                contextName,
              ),
            ]
          : []),
        ...(knex
          ? [
              createEntityManagerProvider(
                options?.scope,
                knex.EntityManager,
                contextName,
              ),
            ]
          : []),
        ...(mongo
          ? [
              createEntityManagerProvider(
                options?.scope,
                mongo.EntityManager,
                contextName,
              ),
            ]
          : []),
      ],
      exports: [
        contextName ? getMikroORMToken(contextName) : MikroORM,
        contextName ? getEntityManagerToken(contextName) : EntityManager,
        ...(em && !contextName ? [em.constructor] : []),
        ...(knex && !contextName ? [knex.EntityManager] : []),
        ...(mongo && !contextName ? [mongo.EntityManager, mongo.MikroORM] : []),
      ],
    };
  }

  /**
   * @description 注册异步数据源上下文
   * @param options - 异步配置选项
   * @returns 动态模块定义
   */
  static async forRootAsync(
    options: typings.MikroOrmModuleAsyncOptions,
  ): Promise<DynamicModule> {
    const contextName = this.setContextName(options?.contextName);

    if (options?.driver && !contextName) {
      const packageName =
        PACKAGES[options.driver.name as keyof typeof PACKAGES];
      const driverPackage = await tryRequire(packageName);

      if (driverPackage) {
        return {
          module: MikroOrmCoreModule,
          imports: options.imports || [],
          providers: [
            ...(options.providers || []),
            ...createAsyncProviders({
              ...options,
              contextName: options.contextName,
            }),
            createMikroOrmProvider(contextName),
            createMikroOrmProvider(contextName, driverPackage.MikroORM),
            createEntityManagerProvider(options?.scope, EntityManager),
            createEntityManagerProvider(
              options?.scope,
              driverPackage.EntityManager,
            ),
          ],
          exports: [
            MikroORM,
            EntityManager,
            driverPackage.EntityManager,
            driverPackage.MikroORM,
          ],
        };
      }
    }

    const knex = await tryRequire("@mikro-orm/knex");
    const mongo = await tryRequire("@mikro-orm/mongodb");
    const em = await this.createEntityManager(options);

    if (em && !contextName) {
      const packageName =
        PACKAGES[em.getDriver().constructor.name as keyof typeof PACKAGES];
      const driverPackage = await tryRequire(packageName);

      if (driverPackage) {
        return {
          module: MikroOrmCoreModule,
          imports: options.imports || [],
          providers: [
            ...(options.providers || []),
            ...createAsyncProviders({
              ...options,
              contextName: options.contextName,
            }),
            createMikroOrmProvider(contextName),
            createMikroOrmProvider(contextName, driverPackage.MikroORM),
            createEntityManagerProvider(options?.scope, EntityManager),
            createEntityManagerProvider(
              options?.scope,
              driverPackage.EntityManager,
            ),
          ],
          exports: [
            MikroORM,
            EntityManager,
            driverPackage.EntityManager,
            driverPackage.MikroORM,
          ],
        };
      }
    }

    return {
      module: MikroOrmCoreModule,
      imports: options.imports || [],
      providers: [
        ...(options.providers || []),
        ...createAsyncProviders({
          ...options,
          contextName: options.contextName,
        }),
        createMikroOrmProvider(contextName),
        ...(mongo ? [createMikroOrmProvider(contextName, mongo.MikroORM)] : []),
        createEntityManagerProvider(options.scope, EntityManager, contextName),
        ...(em
          ? [
              createEntityManagerProvider(
                options?.scope,
                em.constructor as Type,
                contextName,
              ),
            ]
          : []),
        ...(knex
          ? [
              createEntityManagerProvider(
                options?.scope,
                knex.EntityManager,
                contextName,
              ),
            ]
          : []),
        ...(mongo
          ? [
              createEntityManagerProvider(
                options?.scope,
                mongo.EntityManager,
                contextName,
              ),
            ]
          : []),
      ],
      exports: [
        contextName ? getMikroORMToken(contextName) : MikroORM,
        contextName ? getEntityManagerToken(contextName) : EntityManager,
        ...(em && !contextName ? [em.constructor] : []),
        ...(knex && !contextName ? [knex.EntityManager] : []),
        ...(mongo && !contextName ? [mongo.EntityManager, mongo.MikroORM] : []),
      ],
    };
  }

  /**
   * @description 创建驱动 EntityManager，用于依赖注入解析
   * @param options - 同步或异步配置
   * @returns 对应驱动的 EntityManager 实例
   */
  private static async createEntityManager(
    options?:
      | typings.MikroOrmModuleSyncOptions
      | typings.MikroOrmModuleAsyncOptions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    if (options?.contextName) {
      return undefined;
    }

    try {
      let config;

      if (!options || Object.keys(options).length === 0) {
        config = await ConfigurationLoader.getConfiguration(false);
      }

      if (!config && "useFactory" in options!) {
        config = new Configuration(await options.useFactory!(), false);
      }

      if (!config && options instanceof Configuration) {
        config = options;
      }

      if (
        !config &&
        typeof options === "object" &&
        options &&
        "driver" in options
      ) {
        config = new Configuration(options, false);
      }

      return config?.getDriver().createEntityManager();
    } catch {
      // 忽略驱动推断失败，在未声明驱动的异步配置场景下不强制输出日志
    }
  }

  /**
   * @description 应用关闭时释放 ORM 资源
   * @returns Promise<void>
   */
  async onApplicationShutdown() {
    if (!this.moduleRef) {
      return;
    }

    const token = this.options.contextName
      ? getMikroORMToken(this.options.contextName)
      : MikroORM;
    const orm = this.moduleRef.get(token);

    if (orm) {
      await orm.close();
      MikroOrmEntitiesStorage.clearLater();
    }

    CONTEXT_NAMES.length = 0;
  }

  /**
   * @description 配置路由中间件，用于自动注册请求上下文
   * @param consumer - 中间件消费者
   * @returns void
   */
  configure(consumer: MiddlewareConsumer): void {
    if (this.options.registerRequestContext === false) {
      return;
    }

    // 使用工厂函数注入 ModuleRef 和 MikroORM 实例，确保中间件可以正确解析
    const token = this.options.contextName
      ? getMikroORMToken(this.options.contextName)
      : MikroORM;

    consumer
      .apply((moduleRef: ModuleRef, orm: MikroORM) => {
        const middleware = new MikroOrmMiddleware(this.options, moduleRef, orm);
        return middleware.use.bind(middleware);
      })
      .forRoutes({
        path: forRoutesPath(this.options, consumer),
        method: RequestMethod.ALL,
      });
  }

  /**
   * @description 记录上下文名称，避免重复注册
   * @param contextName - 上下文名称
   * @returns 最终确定的上下文名称
   * @throws Error 当上下文重复注册时抛出
   */
  private static setContextName(contextName?: string) {
    if (!contextName) {
      return;
    }

    if (CONTEXT_NAMES.includes(contextName)) {
      throw new Error(`数据库上下文 '${contextName}' 已存在，请勿重复注册`);
    }

    CONTEXT_NAMES.push(contextName);

    return contextName;
  }
}
