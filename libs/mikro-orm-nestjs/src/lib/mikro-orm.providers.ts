import {
  ConfigurationLoader,
  EntityManager,
  MetadataStorage,
  MikroORM,
  type AnyEntity,
  type EntityClass,
  type EntityClassGroup,
  type EntitySchema,
  type ForkOptions,
} from "@mikro-orm/core";
import {
  MIKRO_ORM_MODULE_OPTIONS,
  getEntityManagerToken,
  getMikroORMToken,
  getRepositoryToken,
} from "./mikro-orm.common.js";

import {
  Scope,
  type InjectionToken,
  type Provider,
  type Type,
} from "@nestjs/common";
import { MikroOrmEntitiesStorage } from "./mikro-orm.entities.storage.js";
import type {
  EntityName,
  MikroOrmModuleAsyncOptions,
  MikroOrmModuleOptions,
  MikroOrmOptionsFactory,
} from "./typings.js";
import { Logger } from "@hl8/logger";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description 创建 MikroORM Provider，支持自动加载实体并接入平台日志
 * @param contextName - 上下文名称，缺省时表示主上下文
 * @param type - 自定义 MikroORM 类
 * @returns MikroORM 对应的 Nest Provider 定义
 */
export function createMikroOrmProvider(
  contextName?: string,
  type: Type = MikroORM,
): Provider {
  if (!contextName && type !== MikroORM) {
    return {
      provide: type,
      useFactory: (orm) => orm, // 简单别名，依赖核心包导出的 ORM
      inject: [MikroORM], // 依赖核心包暴露的默认 ORM 实例
    };
  }

  return {
    provide: contextName ? getMikroORMToken(contextName) : type,
    useFactory: async (
      options: MikroOrmModuleOptions | undefined,
      logger: LoggerService,
    ) => {
      options = { ...options };

      if (options?.autoLoadEntities) {
        options.entities = [
          ...(options.entities || []),
          ...MikroOrmEntitiesStorage.getEntities(contextName),
        ] as (
          | string
          | EntityClass<AnyEntity>
          | EntityClassGroup<AnyEntity>
          | EntitySchema
        )[];
        options.entitiesTs = [
          ...(options.entitiesTs || []),
          ...MikroOrmEntitiesStorage.getEntities(contextName),
        ] as (
          | string
          | EntityClass<AnyEntity>
          | EntityClassGroup<AnyEntity>
          | EntitySchema
        )[];
        delete options.autoLoadEntities;
      }

      if (!options || Object.keys(options).length === 0) {
        const config = await ConfigurationLoader.getConfiguration();
        config.set("logger", (message: string) => {
          logger.debug("MikroORM 调试日志", {
            message,
            contextName: contextName ?? "default",
          });
        });
        options = config.getAll();
      }

      return MikroORM.init(options);
    },
    inject: [MIKRO_ORM_MODULE_OPTIONS, Logger],
  };
}

/**
 * @description 创建 EntityManager Provider，支持请求级 fork
 * @param scope - Provider 作用域
 * @param entityManager - EntityManager 构造函数
 * @param contextName - 上下文名称
 * @param forkOptions - Fork 配置选项
 * @returns EntityManager Provider 定义
 */
export function createEntityManagerProvider(
  scope = Scope.DEFAULT,
  entityManager: Type = EntityManager,
  contextName?: string,
  forkOptions?: ForkOptions,
): Provider<EntityManager> {
  if (!contextName && entityManager !== EntityManager) {
    return {
      provide: entityManager,
      scope,
      useFactory: (em: EntityManager) => em, // 简单别名，兼容请求作用域
      inject: [EntityManager], // 依赖核心包暴露的默认 EntityManager
    };
  }

  return {
    provide: contextName ? getEntityManagerToken(contextName) : entityManager,
    scope,
    useFactory: (orm: MikroORM) =>
      scope === Scope.DEFAULT ? orm.em : orm.em.fork(forkOptions),
    inject: [contextName ? getMikroORMToken(contextName) : MikroORM],
  };
}

/**
 * @description 创建异步配置 Provider
 * @param options - 异步配置选项
 * @returns MikroORM 模块选项 Provider
 */
export function createMikroOrmAsyncOptionsProvider(
  options: MikroOrmModuleAsyncOptions,
): Provider {
  if (options.useFactory) {
    return {
      provide: MIKRO_ORM_MODULE_OPTIONS,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFactory: async (...args: any[]) => {
        const factoryOptions = await options.useFactory!(...args);
        return options.contextName
          ? { contextName: options.contextName, ...factoryOptions }
          : factoryOptions;
      },
      inject: options.inject || [],
    };
  }

  const inject = [];

  if (options.useClass || options.useExisting) {
    inject.push(options.useClass ?? options.useExisting!);
  }

  return {
    provide: MIKRO_ORM_MODULE_OPTIONS,
    useFactory: async (optionsFactory: MikroOrmOptionsFactory) =>
      await optionsFactory.createMikroOrmOptions(options.contextName),
    inject,
  };
}

/**
 * @description 生成异步 Provider 列表
 * @param options - 异步配置选项
 * @returns Provider 数组
 */
export function createAsyncProviders(
  options: MikroOrmModuleAsyncOptions,
): Provider[] {
  if (options.useExisting || options.useFactory) {
    return [createMikroOrmAsyncOptionsProvider(options)];
  }

  if (options.useClass) {
    return [
      createMikroOrmAsyncOptionsProvider(options),
      { provide: options.useClass, useClass: options.useClass },
    ];
  }

  throw new Error(
    "MikroORM 异步配置无效：必须提供 useClass、useExisting 或 useFactory 其中之一。",
  );
}

/**
 * @description 根据实体列表创建仓储 Provider
 * @param entities - 实体数组
 * @param contextName - 上下文名称
 * @returns 对应的实体仓储 Provider 数组
 */
export function createMikroOrmRepositoryProviders(
  entities: EntityName<AnyEntity>[],
  contextName?: string,
): Provider[] {
  const metadata = Object.values(MetadataStorage.getMetadata());
  const providers: Provider[] = [];
  const inject = contextName
    ? getEntityManagerToken(contextName)
    : EntityManager;

  (entities || []).forEach((entity) => {
    const meta = metadata.find((meta) => meta.class === entity);
    const repository = meta?.repository as unknown as
      | (() => InjectionToken)
      | undefined;

    if (repository) {
      providers.push({
        provide: repository(),
        useFactory: (em) => em.getRepository(entity),
        inject: [inject],
      });
    }

    providers.push({
      provide: getRepositoryToken(entity, contextName),
      useFactory: (em) => em.getRepository(entity),
      inject: [inject],
    });
  });

  return providers;
}
