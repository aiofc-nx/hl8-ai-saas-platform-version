/**
 * Sanitizer 单元测试
 *
 * @description 测试敏感信息脱敏服务的功能
 */

import { describe, it, expect } from "@jest/globals";
import { Sanitizer } from "./sanitizer.js";
import type { SanitizerConfig } from "../../config/logging.config.js";

describe("Sanitizer", () => {
  let sanitizer: Sanitizer;

  beforeEach(() => {
    sanitizer = new Sanitizer();
  });

  describe("sanitize", () => {
    it("应该脱敏默认敏感字段", () => {
      const context = {
        password: "secret123",
        token: "abc123",
        name: "John",
      };

      const result = sanitizer.sanitize(context, { enabled: true });

      expect(result.password).toBe("***");
      expect(result.token).toBe("***");
      expect(result.name).toBe("John");
    });

    it("应该在 enabled 为 false 时返回原上下文", () => {
      const context = {
        password: "secret123",
        name: "John",
      };

      const result = sanitizer.sanitize(context, { enabled: false });

      expect(result).toBe(context);
      expect(result.password).toBe("secret123");
    });

    it("应该支持自定义占位符", () => {
      const context = {
        password: "secret123",
      };

      const result = sanitizer.sanitize(context, {
        enabled: true,
        placeholder: "[REDACTED]",
      });

      expect(result.password).toBe("[REDACTED]");
    });

    it("应该支持自定义敏感字段列表", () => {
      const context = {
        password: "secret123",
        customSecret: "custom123",
        name: "John",
      };

      const result = sanitizer.sanitize(context, {
        enabled: true,
        sensitiveFields: ["customSecret"],
      });

      expect(result.password).toBe("secret123"); // 不在自定义列表中
      expect(result.customSecret).toBe("***");
      expect(result.name).toBe("John");
    });

    it("应该支持正则表达式匹配", () => {
      const context = {
        password: "secret123",
        Password: "secret456",
        PASSWORD: "secret789",
        name: "John",
      };

      const result = sanitizer.sanitize(context, {
        enabled: true,
        sensitiveFields: [/password/i],
      });

      expect(result.password).toBe("***");
      expect(result.Password).toBe("***");
      expect(result.PASSWORD).toBe("***");
      expect(result.name).toBe("John");
    });

    it("应该支持自定义脱敏函数", () => {
      const context = {
        password: "secret123",
      };

      const customSanitizer = (fieldName: string, value: unknown) => {
        if (fieldName === "password") {
          return "******";
        }
        return value;
      };

      const result = sanitizer.sanitize(context, {
        enabled: true,
        customSanitizer,
      });

      expect(result.password).toBe("******");
    });

    it("应该处理嵌套对象", () => {
      const context = {
        user: {
          name: "John",
          password: "secret123",
        },
        token: "abc123",
      };

      const result = sanitizer.sanitize(context, { enabled: true });

      expect(result.user.name).toBe("John");
      expect(result.user.password).toBe("***");
      expect(result.token).toBe("***");
    });

    it("应该处理数组", () => {
      const context = {
        users: [
          { name: "John", password: "secret1" },
          { name: "Jane", password: "secret2" },
        ],
      };

      const result = sanitizer.sanitize(context, { enabled: true });

      expect(result.users[0].name).toBe("John");
      expect(result.users[0].password).toBe("***");
      expect(result.users[1].name).toBe("Jane");
      expect(result.users[1].password).toBe("***");
    });

    it("应该处理 Map", () => {
      const context = {
        map: new Map([
          ["password", "secret123"],
          ["name", "John"],
        ]),
      };

      const result = sanitizer.sanitize(context, { enabled: true });

      expect(result.map).toBeInstanceOf(Map);
      expect(result.map.get("password")).toBe("***");
      expect(result.map.get("name")).toBe("John");
    });

    it("应该处理 Set", () => {
      const context = {
        set: new Set(["secret123", "public456"]),
      };

      const result = sanitizer.sanitize(context, { enabled: true });

      expect(result.set).toBeInstanceOf(Set);
      // Set 中的值不会被脱敏（因为 Set 没有字段名）
      expect(result.set.has("secret123")).toBe(true);
    });

    it("应该处理循环引用", () => {
      const context: any = {
        password: "secret123",
        nested: {},
      };
      context.nested.parent = context;

      const result = sanitizer.sanitize(context, { enabled: true });

      expect(result.password).toBe("***");
      expect(result.nested).toBeDefined();
      // 循环引用应该被正确处理，不会导致无限递归
    });

    it("应该跳过函数和 Symbol 字段", () => {
      const context: any = {
        password: "secret123",
        fn: () => {},
        [Symbol("test")]: "symbol-value",
      };

      const result = sanitizer.sanitize(context, { enabled: true });

      expect(result.password).toBe("***");
      expect(result.fn).toBeUndefined(); // 函数被跳过
    });

    it("应该保持日期对象不变", () => {
      const date = new Date();
      const context = {
        password: "secret123",
        createdAt: date,
      };

      const result = sanitizer.sanitize(context, { enabled: true });

      expect(result.password).toBe("***");
      expect(result.createdAt).toBe(date);
      expect(result.createdAt instanceof Date).toBe(true);
    });

    it("应该处理 null 和 undefined", () => {
      const context = {
        password: null,
        token: undefined,
        name: "John",
      };

      const result = sanitizer.sanitize(context, { enabled: true });

      expect(result.password).toBeNull();
      expect(result.token).toBeUndefined();
      expect(result.name).toBe("John");
    });

    it("应该处理空对象", () => {
      const context = {};

      const result = sanitizer.sanitize(context, { enabled: true });

      expect(result).toEqual({});
    });

    it("应该处理非对象值", () => {
      const result1 = sanitizer.sanitize(null as any, { enabled: true });
      expect(result1).toBeNull();

      const result2 = sanitizer.sanitize(undefined as any, { enabled: true });
      expect(result2).toBeUndefined();

      const result3 = sanitizer.sanitize("string" as any, { enabled: true });
      expect(result3).toBe("string");
    });
  });
});
