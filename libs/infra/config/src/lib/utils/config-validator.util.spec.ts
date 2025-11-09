/**
 * 配置验证器工具类单元测试
 *
 * @description 测试 ConfigValidator 的配置验证功能，包括类型转换、
 * 验证错误处理等。遵循项目章程的测试要求。
 *
 * ## 测试覆盖范围
 *
 * - 配置验证和类型转换
 * - 验证错误格式化
 * - 嵌套配置验证
 * - 边界情况和错误处理
 */

import { describe, expect, it } from "@jest/globals";
import { Type } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsEmail,
  IsOptional,
  ValidateNested,
  Min,
  Max,
  IsArray,
} from "class-validator";
import { ConfigValidator } from "./config-validator.util.js";

/**
 * 测试用的简单配置类
 */
class SimpleConfig {
  @IsString()
  name!: string;

  @IsNumber()
  @Type(() => Number)
  port!: number;
}

/**
 * 测试用的嵌套配置类
 */
class NestedConfig {
  @IsString()
  value!: string;
}

class ParentConfig {
  @ValidateNested()
  @Type(() => NestedConfig)
  nested!: NestedConfig;

  @IsString()
  name!: string;
}

/**
 * 测试用的可选字段配置类
 */
class OptionalConfig {
  @IsString()
  required!: string;

  @IsString()
  @IsOptional()
  optional?: string;
}

/**
 * 测试用的验证约束配置类
 */
class ConstrainedConfig {
  @IsString()
  @IsEmail()
  email!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  score!: number;
}

/**
 * 测试用的数组配置类
 */
class ArrayConfig {
  @IsArray()
  @IsString({ each: true })
  items!: string[];
}

describe("ConfigValidator", () => {
  describe("validate - 配置验证", () => {
    it("应该成功验证简单配置", () => {
      const rawConfig = {
        name: "test-app",
        port: "3000", // 字符串，应该转换为数字
      };

      const config = ConfigValidator.validate(SimpleConfig, rawConfig);

      expect(config).toBeInstanceOf(SimpleConfig);
      expect(config.name).toBe("test-app");
      expect(typeof config.port).toBe("number");
      expect(config.port).toBe(3000);
    });

    it("应该自动进行类型转换", () => {
      const rawConfig = {
        name: "test",
        port: "8080", // 字符串应该转换为数字
      };

      const config = ConfigValidator.validate(SimpleConfig, rawConfig);

      expect(typeof config.port).toBe("number");
      expect(config.port).toBe(8080);
    });

    it("应该验证嵌套配置", () => {
      const rawConfig = {
        name: "parent",
        nested: {
          value: "nested-value",
        },
      };

      const config = ConfigValidator.validate(ParentConfig, rawConfig);

      expect(config).toBeInstanceOf(ParentConfig);
      expect(config.name).toBe("parent");
      expect(config.nested).toBeInstanceOf(NestedConfig);
      expect(config.nested.value).toBe("nested-value");
    });

    it("应该处理可选字段", () => {
      const rawConfig1 = {
        required: "value",
        optional: "optional-value",
      };

      const config1 = ConfigValidator.validate(OptionalConfig, rawConfig1);
      expect(config1.required).toBe("value");
      expect(config1.optional).toBe("optional-value");

      const rawConfig2 = {
        required: "value",
        // optional 字段缺失
      };

      const config2 = ConfigValidator.validate(OptionalConfig, rawConfig2);
      expect(config2.required).toBe("value");
      expect(config2.optional).toBeUndefined();
    });

    it("应该验证约束条件", () => {
      const rawConfig = {
        email: "test@example.com",
        score: "85",
      };

      const config = ConfigValidator.validate(ConstrainedConfig, rawConfig);

      expect(config).toBeInstanceOf(ConstrainedConfig);
      expect(config.email).toBe("test@example.com");
      expect(typeof config.score).toBe("number");
      expect(config.score).toBe(85);
    });

    it("应该验证数组配置", () => {
      const rawConfig = {
        items: ["item1", "item2", "item3"],
      };

      const config = ConfigValidator.validate(ArrayConfig, rawConfig);

      expect(config).toBeInstanceOf(ArrayConfig);
      expect(Array.isArray(config.items)).toBe(true);
      expect(config.items.length).toBe(3);
      expect(config.items[0]).toBe("item1");
    });
  });

  describe("错误处理", () => {
    it("应该在缺少必需字段时抛出错误", () => {
      const rawConfig = {
        name: "test",
        // port 字段缺失
      };

      expect(() => {
        ConfigValidator.validate(SimpleConfig, rawConfig);
      }).toThrow("Configuration validation failed");
    });

    it("应该在类型验证失败时抛出错误", () => {
      const rawConfig = {
        name: "test",
        port: "invalid-number", // 无法转换为数字
      };

      expect(() => {
        ConfigValidator.validate(SimpleConfig, rawConfig);
      }).toThrow("Configuration validation failed");
    });

    it("应该在约束验证失败时抛出错误", () => {
      const rawConfig = {
        email: "invalid-email", // 无效的邮箱格式
        score: "85",
      };

      expect(() => {
        ConfigValidator.validate(ConstrainedConfig, rawConfig);
      }).toThrow("Configuration validation failed");
    });

    it("应该在数值约束失败时抛出错误", () => {
      const rawConfig = {
        email: "test@example.com",
        score: "150", // 超出最大值 100
      };

      expect(() => {
        ConfigValidator.validate(ConstrainedConfig, rawConfig);
      }).toThrow("Configuration validation failed");
    });

    it("应该在嵌套配置验证失败时抛出错误", () => {
      const rawConfig = {
        name: "parent",
        nested: {
          // value 字段缺失
        },
      };

      expect(() => {
        ConfigValidator.validate(ParentConfig, rawConfig);
      }).toThrow("Configuration validation failed");
    });

    it("应该在数组验证失败时抛出错误", () => {
      const rawConfig = {
        items: ["item1", 123, "item3"], // 数组中包含非字符串元素
      };

      expect(() => {
        ConfigValidator.validate(ArrayConfig, rawConfig);
      }).toThrow("Configuration validation failed");
    });

    it("应该提供详细的错误信息", () => {
      const rawConfig = {
        name: "test",
        // port 缺失
      };

      try {
        ConfigValidator.validate(SimpleConfig, rawConfig);
        fail("应该抛出错误");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain("Configuration validation failed");
        expect(errorMessage).toContain("port"); // 应该包含字段名
      }
    });
  });

  describe("边界情况", () => {
    it("应该处理空对象", () => {
      class EmptyConfig {
        @IsOptional()
        test?: string;
      }

      const rawConfig = {};

      const config = ConfigValidator.validate(EmptyConfig, rawConfig);

      expect(config).toBeInstanceOf(EmptyConfig);
      expect(config.test).toBeUndefined();
    });

    it("应该处理空数组", () => {
      const rawConfig = {
        items: [],
      };

      const config = ConfigValidator.validate(ArrayConfig, rawConfig);

      expect(config).toBeInstanceOf(ArrayConfig);
      expect(Array.isArray(config.items)).toBe(true);
      expect(config.items.length).toBe(0);
    });

    it("应该处理 null 值（如果允许）", () => {
      class NullableConfig {
        @IsOptional()
        @IsString()
        value?: string | null;
      }

      const rawConfig = {
        value: null,
      };

      const config = ConfigValidator.validate(NullableConfig, rawConfig);

      expect(config).toBeInstanceOf(NullableConfig);
      // 注意：class-validator 的默认行为可能不接受 null
      // 这取决于具体的验证规则
    });

    it("应该处理数字 0", () => {
      const rawConfig = {
        name: "test",
        port: "0",
      };

      const config = ConfigValidator.validate(SimpleConfig, rawConfig);

      expect(config.port).toBe(0);
      expect(typeof config.port).toBe("number");
    });

    it("应该处理负数", () => {
      const rawConfig = {
        email: "test@example.com",
        score: "-10", // 负数，但可能违反 Min 约束
      };

      expect(() => {
        ConfigValidator.validate(ConstrainedConfig, rawConfig);
      }).toThrow("Configuration validation failed");
    });
  });

  describe("类型转换", () => {
    it("应该将字符串数字转换为数字", () => {
      const rawConfig = {
        name: "test",
        port: "3000",
      };

      const config = ConfigValidator.validate(SimpleConfig, rawConfig);

      expect(typeof config.port).toBe("number");
      expect(config.port).toBe(3000);
    });

    it("应该处理布尔值的转换", () => {
      class BooleanConfig {
        @IsOptional()
        enabled?: boolean;
      }

      const rawConfig = {
        enabled: "true",
      };

      // 注意：class-transformer 可能需要额外的配置来转换布尔值
      // 这里只是测试基本功能
      const config = ConfigValidator.validate(BooleanConfig, rawConfig);

      expect(config).toBeInstanceOf(BooleanConfig);
    });

    it("应该保持字符串类型不变", () => {
      const rawConfig = {
        name: "test-string",
        port: "3000",
      };

      const config = ConfigValidator.validate(SimpleConfig, rawConfig);

      expect(typeof config.name).toBe("string");
      expect(config.name).toBe("test-string");
    });
  });
});
