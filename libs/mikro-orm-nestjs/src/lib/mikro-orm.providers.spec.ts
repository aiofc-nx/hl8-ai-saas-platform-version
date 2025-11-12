import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { Scope } from "@nestjs/common";
import {
  MikroORM,
  ConfigurationLoader,
  EntityManager,
  MetadataStorage,
} from "@mikro-orm/core";
import { MikroOrmEntitiesStorage } from "./mikro-orm.entities.storage.js";
import {
  createAsyncProviders,
  createEntityManagerProvider,
  createMikroOrmProvider,
  createMikroOrmRepositoryProviders,
} from "./mikro-orm.providers.js";
import {
  MIKRO_ORM_MODULE_OPTIONS,
  getEntityManagerToken,
  getMikroORMToken,
  getRepositoryToken,
} from "./mikro-orm.common.js";
import type {
  MikroOrmModuleAsyncOptions,
  MikroOrmModuleOptions,
} from "./typings.js";

class DemoEntity {}

describe("mikro-orm providers", () => {
  beforeEach(() => {
    MikroOrmEntitiesStorage.clear("default");
    MikroOrmEntitiesStorage.clear("orders");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("createMikroOrmProvider 应合并 autoLoadEntities 并调用 MikroORM.init", async () => {
    MikroOrmEntitiesStorage.addEntity(DemoEntity, "orders");

    const initSpy = jest
      .spyOn(MikroORM, "init")
      .mockResolvedValue({} as unknown as MikroORM);

    const provider = createMikroOrmProvider("orders");
    const loggerStub = { debug: jest.fn() } as unknown as {
      debug: (message: string, context?: Record<string, unknown>) => void;
    };

    const options: MikroOrmModuleOptions = {
      autoLoadEntities: true,
      entities: [],
      entitiesTs: [],
      registerRequestContext: true,
    };

    await provider.useFactory!(options, loggerStub);

    expect(initSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: expect.arrayContaining([DemoEntity]),
        entitiesTs: expect.arrayContaining([DemoEntity]),
      }),
    );
  });

  it("createMikroOrmProvider 应在缺省配置时加载 Configuration 并接入日志", async () => {
    const setSpy = jest.fn();
    const getAllSpy = jest.fn().mockReturnValue({ driver: "postgresql" });
    type LoaderReturn = Awaited<
      ReturnType<typeof ConfigurationLoader.getConfiguration>
    >;
    jest.spyOn(ConfigurationLoader, "getConfiguration").mockResolvedValue({
      set: setSpy,
      getAll: getAllSpy,
    } as unknown as LoaderReturn);

    const initSpy = jest
      .spyOn(MikroORM, "init")
      .mockResolvedValue({} as unknown as MikroORM);

    const provider = createMikroOrmProvider("analytics");
    const loggerStub = { debug: jest.fn() } as unknown as {
      debug: (message: string, context?: Record<string, unknown>) => void;
    };

    await provider.useFactory!(undefined, loggerStub);

    expect(setSpy).toHaveBeenCalledWith("logger", expect.any(Function));
    const [, registeredLogger] = setSpy.mock.calls.find(
      ([key]) => key === "logger",
    )!;

    registeredLogger("配置日志");
    expect(loggerStub.debug).toHaveBeenCalledWith("MikroORM 调试日志", {
      message: "配置日志",
      contextName: "analytics",
    });

    expect(initSpy).toHaveBeenCalledWith({ driver: "postgresql" });
  });

  it("createEntityManagerProvider 在请求作用域下应 fork EntityManager", async () => {
    const provider = createEntityManagerProvider(
      Scope.REQUEST,
      EntityManager,
      "orders",
      { useContext: true },
    );

    const forkMock = jest.fn().mockReturnValue({ forked: true });
    const ormMock = {
      em: { fork: forkMock },
    } as unknown as MikroORM;

    const result = await provider.useFactory!(ormMock);

    expect(forkMock).toHaveBeenCalledWith({ useContext: true });
    expect(result).toEqual({ forked: true });
    expect(provider.inject).toEqual([getMikroORMToken("orders")]);
  });

  it("createMikroOrmRepositoryProviders 应返回仓储 Provider 并绑定 EntityManager", () => {
    const repositoryToken = Symbol("demoRepository");
    jest.spyOn(MetadataStorage, "getMetadata").mockReturnValue({
      demo: {
        class: DemoEntity,
        repository: () => repositoryToken,
      },
    } as unknown as Record<string, unknown>);

    const providers = createMikroOrmRepositoryProviders([DemoEntity], "orders");

    expect(providers).toHaveLength(2);

    const customRepository = providers.find(
      (provider) => provider.provide === repositoryToken,
    );
    expect(customRepository?.inject).toEqual([getEntityManagerToken("orders")]);

    const tokenProvider = providers.find(
      (provider) =>
        provider.provide === getRepositoryToken(DemoEntity, "orders"),
    );

    const emMock = { getRepository: jest.fn().mockReturnValue("repo") };
    const repoInstance = tokenProvider?.useFactory?.(emMock);
    expect(emMock.getRepository).toHaveBeenCalledWith(DemoEntity);
    expect(repoInstance).toBe("repo");
  });

  it("createAsyncProviders 应针对 useFactory 返回正确 Provider", () => {
    const options: MikroOrmModuleAsyncOptions = {
      useFactory: async () => ({ registerRequestContext: true }),
    };

    const providers = createAsyncProviders(options);

    expect(providers).toHaveLength(1);
    expect(providers[0].provide).toBe(MIKRO_ORM_MODULE_OPTIONS);
  });
});
