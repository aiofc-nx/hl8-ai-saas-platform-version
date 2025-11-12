import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { GeneralInternalServerException } from "@hl8/exceptions";
import { CacheClientProvider } from "./cache-client.provider.js";
import { CacheMetricsHook } from "../monitoring/cache-metrics.hook.js";
import {
  CacheReadService,
  type CacheReadOptions,
} from "./cache-read.service.js";

const createLoggerStub = () =>
  ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    child: jest.fn().mockReturnThis(),
  }) as const;

describe("CacheReadService", () => {
  let cacheClientProvider: CacheClientProvider;
  let cacheMetricsHook: CacheMetricsHook;
  let service: CacheReadService;
  let redisClient: any;
  let logger: ReturnType<typeof createLoggerStub>;

  beforeEach(() => {
    redisClient = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => "OK"),
    };

    cacheClientProvider = {
      getClient: jest.fn().mockReturnValue(redisClient),
    } as unknown as CacheClientProvider;

    cacheMetricsHook = {
      recordHit: jest.fn(),
      recordMiss: jest.fn(),
      recordOriginLatency: jest.fn(),
      recordLockWait: jest.fn(),
      recordFailure: jest.fn(),
    } as unknown as CacheMetricsHook;

    logger = createLoggerStub();

    service = new CacheReadService(
      cacheClientProvider,
      cacheMetricsHook,
      logger as unknown as any,
    );
  });

  const createOptions = <T>(override: Partial<CacheReadOptions<T>> = {}) => {
    const defaultLoader = async (): Promise<T> => {
      return {} as T;
    };
    return {
      domain: "tenant-config",
      key: "tenant-config:tenant-001:config",
      loader: defaultLoader,
      ...override,
    };
  };

  it("should return cached value when redis hit", async () => {
    redisClient.get.mockResolvedValueOnce(JSON.stringify({ cached: true }));
    const loader = jest.fn(async () => ({ cached: false }));
    const options = {
      ...createOptions<{ cached: boolean }>(),
      loader: loader as unknown as () => Promise<{ cached: boolean }>,
    };

    const result = await service.getOrLoad(options);

    expect(result).toEqual({ cached: true });
    expect(options.loader).not.toHaveBeenCalled();
    expect(cacheMetricsHook.recordHit).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "tenant-config",
        extra: { key: options.key },
      }),
    );
  });

  it("should call loader and persist value when cache miss", async () => {
    redisClient.get.mockResolvedValueOnce(null);
    const loader = jest.fn(async () => ({ config: "data" }));
    const options = {
      ...createOptions<{ config: string }>(),
      loader: loader as unknown as () => Promise<{ config: string }>,
      ttlSeconds: 120,
    };

    const result = await service.getOrLoad(options);

    expect(result).toEqual({ config: "data" });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redisClient.set).toHaveBeenCalledWith(
      options.key,
      JSON.stringify({ config: "data" }),
      "EX",
      120,
    );
    expect(cacheMetricsHook.recordMiss).toHaveBeenCalled();
    expect(cacheMetricsHook.recordOriginLatency).toHaveBeenCalled();
  });

  it("should propagate loader errors", async () => {
    redisClient.get.mockResolvedValueOnce(null);
    const error = new Error("loader failed");
    const loader = jest.fn(async () => {
      throw error;
    });
    const options = {
      ...createOptions<{ value: number }>(),
      loader: loader as unknown as () => Promise<{ value: number }>,
    };

    await expect(service.getOrLoad(options)).rejects.toThrow(error);
  });

  it("should wrap redis failures into internal exception", async () => {
    redisClient.get.mockRejectedValueOnce(new Error("redis down"));
    const options = createOptions();

    await expect(service.getOrLoad(options)).rejects.toThrow(
      GeneralInternalServerException,
    );
    expect(cacheMetricsHook.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: { key: options.key, stage: "unknown" },
      }),
    );
  });
});
