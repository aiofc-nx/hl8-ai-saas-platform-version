/**
 * @fileoverview 配置服务单元测试
 * @description 测试配置服务的核心功能，包括配置获取和检查
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { ConfigurationServiceImpl } from "./configuration.service.js";
import { InfrastructureConfig } from "./schemas/infrastructure-config.schema.js";
import { ConfigurationException } from "../exceptions/infrastructure-exception.js";

describe("ConfigurationServiceImpl", () => {
  let configService: ConfigurationServiceImpl;
  let mockConfig: InfrastructureConfig;

  beforeEach(() => {
    // 创建模拟配置对象
    mockConfig = {
      eventStore: {
        connectionString: "postgresql://localhost:5432/events",
        optimisticLockRetryCount: 3,
        enableSnapshots: true,
      },
      eventPublisher: {
        enableInternalBus: true,
        enableExternalBroker: false,
      },
      cache: {
        ttl: 3600,
        maxSize: 1000,
      },
    } as InfrastructureConfig;

    configService = new ConfigurationServiceImpl(mockConfig);
  });

  describe("get", () => {
    it("应该能够获取顶层配置值", () => {
      // 执行
      const value = configService.get<string>("eventStore.connectionString");

      // 验证
      expect(value).toBe("postgresql://localhost:5432/events");
    });

    it("应该能够获取嵌套配置值", () => {
      // 执行
      const value = configService.get<number>(
        "eventStore.optimisticLockRetryCount",
      );

      // 验证
      expect(value).toBe(3);
    });

    it("应该能够获取布尔配置值", () => {
      // 执行
      const value = configService.get<boolean>("eventStore.enableSnapshots");

      // 验证
      expect(value).toBe(true);
    });

    it("应该能够获取配置值（带默认值）", () => {
      // 执行
      const value = configService.get<string>(
        "eventStore.nonexistent",
        "default-value",
      );

      // 验证
      expect(value).toBe("default-value");
    });

    it("应该在配置不存在且没有默认值时抛出异常", () => {
      // 执行和验证
      expect(() => {
        configService.get<string>("eventStore.nonexistent");
      }).toThrow(ConfigurationException);
      expect(() => {
        configService.get<string>("eventStore.nonexistent");
      }).toThrow('配置项 "eventStore.nonexistent" 不存在且没有默认值');
    });

    it("应该能够获取深层嵌套配置值", () => {
      // 准备
      const deepConfig = {
        level1: {
          level2: {
            level3: {
              value: "deep-value",
            },
          },
        },
      } as unknown as InfrastructureConfig;

      const service = new ConfigurationServiceImpl(deepConfig);

      // 执行
      const value = service.get<string>("level1.level2.level3.value");

      // 验证
      expect(value).toBe("deep-value");
    });

    it("应该能够处理数字类型的配置值", () => {
      // 执行
      const value = configService.get<number>("cache.ttl");

      // 验证
      expect(value).toBe(3600);
    });
  });

  describe("has", () => {
    it("应该能够检查存在的配置", () => {
      // 执行
      const exists = configService.has("eventStore.connectionString");

      // 验证
      expect(exists).toBe(true);
    });

    it("应该能够检查不存在的配置", () => {
      // 执行
      const exists = configService.has("eventStore.nonexistent");

      // 验证
      expect(exists).toBe(false);
    });

    it("应该能够检查嵌套配置", () => {
      // 执行
      const exists = configService.has("eventStore.optimisticLockRetryCount");

      // 验证
      expect(exists).toBe(true);
    });

    it("应该能够检查深层嵌套配置", () => {
      // 准备
      const deepConfig = {
        level1: {
          level2: {
            level3: {
              value: "deep-value",
            },
          },
        },
      } as unknown as InfrastructureConfig;

      const service = new ConfigurationServiceImpl(deepConfig);

      // 执行
      const exists = service.has("level1.level2.level3.value");

      // 验证
      expect(exists).toBe(true);
    });

    it("应该能够检查不存在的深层嵌套配置", () => {
      // 准备
      const deepConfig = {
        level1: {
          level2: {
            level3: {
              value: "deep-value",
            },
          },
        },
      } as unknown as InfrastructureConfig;

      const service = new ConfigurationServiceImpl(deepConfig);

      // 执行
      const exists = service.has("level1.level2.level3.nonexistent");

      // 验证
      expect(exists).toBe(false);
    });
  });

  describe("getNestedValue", () => {
    it("应该能够处理 null 配置对象", () => {
      // 准备
      const nullConfig = null as unknown as InfrastructureConfig;
      const service = new ConfigurationServiceImpl(nullConfig);

      // 执行和验证
      expect(() => {
        service.get<string>("any.key");
      }).toThrow(ConfigurationException);
    });

    it("应该能够处理 undefined 配置对象", () => {
      // 准备
      const undefinedConfig = undefined as unknown as InfrastructureConfig;
      const service = new ConfigurationServiceImpl(undefinedConfig);

      // 执行和验证
      expect(() => {
        service.get<string>("any.key");
      }).toThrow(ConfigurationException);
    });

    it("应该能够处理非对象类型的配置值", () => {
      // 准备
      const stringConfig = "string" as unknown as InfrastructureConfig;
      const service = new ConfigurationServiceImpl(stringConfig);

      // 执行和验证
      expect(() => {
        service.get<string>("any.key");
      }).toThrow(ConfigurationException);
    });

    it("应该能够处理配置获取时的非配置异常", () => {
      // 准备
      const configWithError = {
        get value() {
          throw new Error("非配置异常");
        },
      } as unknown as InfrastructureConfig;

      const service = new ConfigurationServiceImpl(configWithError);

      // 执行和验证
      expect(() => {
        service.get<string>("value");
      }).toThrow(ConfigurationException);
      expect(() => {
        service.get<string>("value");
      }).toThrow("配置值获取失败");
    });

    it("应该能够处理 has 方法中的异常", () => {
      // 准备
      const configWithError = {
        get value() {
          throw new Error("测试异常");
        },
      } as unknown as InfrastructureConfig;

      const service = new ConfigurationServiceImpl(configWithError);

      // 执行
      const result = service.has("value");

      // 验证（应该返回 false，不抛出异常）
      expect(result).toBe(false);
    });
  });
});
