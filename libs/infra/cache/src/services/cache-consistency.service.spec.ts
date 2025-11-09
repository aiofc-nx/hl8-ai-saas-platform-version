import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  GeneralBadRequestException,
  GeneralInternalServerException,
  MissingConfigurationForFeatureException,
} from "@hl8/exceptions";
import { Logger } from "@hl8/logger";
import { CacheClientProvider } from "./cache-client.provider.js";
import { CacheNamespaceRegistry } from "../config/cache-namespace.registry.js";
import { CacheConsistencyService } from "./cache-consistency.service.js";
import {
  CacheEvictionPolicy,
  CacheNamespacePolicyConfig,
} from "../config/cache-namespace-policy.config.js";
import type Redlock from "redlock";
class MockResourceLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceLockedError";
  }
}
import type { Redis } from "ioredis";
import type { ModuleRef } from "@nestjs/core";
import { CacheNotificationService } from "./cache-notification.service.js";

describe("CacheConsistencyService", () => {
  let service: CacheConsistencyService;
  const redisDel = jest.fn(async () => 1);
  const redisClient = { del: redisDel } as unknown as Redis;

  const cacheClientProvider = {
    getClient: jest.fn(() => redisClient),
  } as unknown as CacheClientProvider;

  const createPolicy = () => ({
    domain: "tenant-config",
    keyPrefix: "tc",
    keySuffix: null,
    separator: ":",
    defaultTTL: 300,
    evictionPolicy: CacheEvictionPolicy.DoubleDelete,
    hitThresholdAlert: null,
  });

  const registry = {
    get: jest.fn(() => createPolicy()),
  } as unknown as CacheNamespaceRegistry;

  const redlockUsing = jest.fn(
    async (
      _resources: string[],
      _duration: number,
      routine: (signal: {
        aborted: boolean;
        error?: Error;
      }) => Promise<unknown>,
    ) => routine({ aborted: false }),
  );
  const redlockService = {
    using: redlockUsing,
  } as unknown as Redlock;

  const loggerStub = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as unknown as Logger;

  const moduleRef = {
    get: jest.fn().mockReturnValue(redlockService),
  } as unknown as ModuleRef;

  const notificationService = {
    publishInvalidation: jest.fn(async () => undefined),
    publishLockContention: jest.fn(async () => undefined),
    publishPrefetchRequested: jest.fn(async () => ({
      refreshed: 0,
      failures: [],
    })),
  } as unknown as CacheNotificationService;

  const resetStubs = () => {
    jest.clearAllMocks();
    (notificationService.publishInvalidation as jest.Mock).mockClear();
    (notificationService.publishLockContention as jest.Mock).mockClear();
    (notificationService.publishPrefetchRequested as jest.Mock).mockClear();
    redlockUsing.mockReset();
    redlockUsing.mockImplementation(async (_resources, _duration, routine) =>
      routine({ aborted: false }),
    );
    (cacheClientProvider.getClient as jest.Mock).mockReturnValue(redisClient);
    (moduleRef.get as jest.Mock).mockReturnValue(redlockService);
    (registry.get as jest.Mock).mockReset();
    (registry.get as jest.Mock).mockReturnValue(createPolicy());
  };

  beforeEach(() => {
    resetStubs();
    service = new CacheConsistencyService(
      cacheClientProvider,
      registry,
      moduleRef,
      loggerStub,
      notificationService,
    );
  });

  it("should execute double delete within lock", async () => {
    await service.invalidate({
      domain: "tenant-config",
      tenantId: "tenant-1",
      keys: ["tenant-config:tenant-1:profile"],
      reason: "写路径更新",
      delayMs: 0,
    });

    expect(redlockUsing).toHaveBeenCalled();
    expect(notificationService.publishInvalidation).toHaveBeenCalledWith({
      domain: "tenant-config",
      tenantId: "tenant-1",
      keys: ["tenant-config:tenant-1:profile"],
      reason: "写路径更新",
    });
    expect(redisDel).toHaveBeenCalledTimes(2);
  });

  it("should validate required fields", async () => {
    await expect(
      service.invalidate({
        domain: "",
        tenantId: "tenant-1",
        keys: ["k1"],
        reason: "test",
      }),
    ).rejects.toBeInstanceOf(GeneralBadRequestException);

    await expect(
      service.invalidate({
        domain: "tenant-config",
        tenantId: "",
        keys: ["k1"],
        reason: "test",
      }),
    ).rejects.toBeInstanceOf(GeneralBadRequestException);

    await expect(
      service.invalidate({
        domain: "tenant-config",
        tenantId: "tenant-1",
        keys: [],
        reason: "test",
      }),
    ).rejects.toBeInstanceOf(GeneralBadRequestException);
  });

  it("should throw when policy missing", async () => {
    (registry.get as jest.Mock).mockReturnValue(undefined);

    await expect(
      service.invalidate({
        domain: "unknown",
        tenantId: "tenant-1",
        keys: ["k1"],
        reason: "test",
      }),
    ).rejects.toBeInstanceOf(MissingConfigurationForFeatureException);
  });

  it("should wrap unexpected errors", async () => {
    redlockUsing.mockRejectedValueOnce(new Error("lock failed"));

    await expect(
      service.invalidate({
        domain: "tenant-config",
        tenantId: "tenant-1",
        keys: ["k1"],
        reason: "test",
      }),
    ).rejects.toBeInstanceOf(GeneralInternalServerException);
  });

  it("should propagate lock contention as conflict", async () => {
    redlockUsing.mockRejectedValueOnce(new MockResourceLockedError("busy"));

    await expect(
      service.invalidate({
        domain: "tenant-config",
        tenantId: "tenant-1",
        keys: ["k1"],
        reason: "test",
      }),
    ).rejects.toThrow("缓存锁正在使用中，请稍后重试");

    expect(notificationService.publishLockContention).toHaveBeenCalledWith({
      domain: "tenant-config",
      tenantId: "tenant-1",
      keys: ["k1"],
      lockResource: "lock:cache:tenant-config:tenant-1",
    });
  });
});
