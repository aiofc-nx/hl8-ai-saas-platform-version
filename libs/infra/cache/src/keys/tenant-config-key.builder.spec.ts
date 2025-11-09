import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { GeneralBadRequestException } from "@hl8/exceptions";
import {
  TenantConfigKeyBuilder,
  type TenantConfigKeyPayload,
} from "./tenant-config-key.builder.js";

describe("TenantConfigKeyBuilder", () => {
  let builder: TenantConfigKeyBuilder;
  let logger: ReturnType<typeof createLoggerStub>;

  const createLoggerStub = () => {
    const stub = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      child: jest.fn().mockReturnThis(),
    };
    return stub as unknown as ReturnType<typeof createLoggerStub> & {
      log: jest.Mock;
      error: jest.Mock;
      warn: jest.Mock;
      debug: jest.Mock;
      verbose: jest.Mock;
      child: jest.Mock;
    };
  };

  beforeEach(() => {
    logger = createLoggerStub();
    builder = new TenantConfigKeyBuilder(logger as unknown as any);
  });

  it("should build default key structure", () => {
    const payload: TenantConfigKeyPayload = {
      tenantId: "tenant-001",
    };

    const key = builder.build(payload);

    expect(key).toBe("tenant-config:tenant-001:config");
  });

  it("should include config key and variant, trimming extra spaces", () => {
    const payload: TenantConfigKeyPayload = {
      tenantId: " tenant-002 ",
      configKey: "profile beta",
      variant: " 2025 ",
    };

    const key = builder.build(payload);

    expect(key).toBe("tenant-config:tenant-002:profilebeta:2025");
    expect(logger.warn).toHaveBeenCalledWith(
      "缓存键片段包含空格，已自动去除空白",
      expect.objectContaining({ segment: "profile beta" }),
    );
  });

  it("should throw when tenant id is empty", () => {
    const payload: TenantConfigKeyPayload = {
      tenantId: "   ",
    };

    expect(() => builder.build(payload)).toThrow(GeneralBadRequestException);
  });

  it("should support buildFromSegments utility", () => {
    const key = builder.buildFromSegments([
      "tenant-config",
      "tenant-003",
      "custom",
    ]);

    expect(key).toBe("tenant-config:tenant-003:custom");
  });
});
