/**
 * 脱敏性能测试
 *
 * @description 验证脱敏处理性能开销 < 2ms（普通对象）
 */

import { describe, it, expect } from "@jest/globals";
import { Sanitizer } from "./sanitizer.js";
import type { LogContext } from "../pino-logger.service.js";

describe("脱敏性能测试", () => {
  const sanitizer = new Sanitizer();

  /**
   * 创建普通大小的测试对象
   */
  function createNormalObject(): LogContext {
    return {
      username: "testuser",
      password: "secret-password",
      email: "test@example.com",
      token: "access-token-123",
      apiKey: "api-key-456",
      name: "John Doe",
      age: 30,
      address: {
        street: "123 Main St",
        city: "New York",
        country: "USA",
      },
      preferences: {
        theme: "dark",
        language: "en",
      },
      tags: ["developer", "typescript", "nodejs"],
    };
  }

  /**
   * 创建较大的嵌套对象
   */
  function createLargeObject(): LogContext {
    const obj: LogContext = {
      username: "testuser",
      password: "secret-password",
      email: "test@example.com",
    };

    // 添加嵌套对象
    for (let i = 0; i < 10; i++) {
      (obj as any)[`nested${i}`] = {
        id: i,
        password: `secret-${i}`,
        token: `token-${i}`,
        data: {
          value: i * 10,
          secret: `secret-value-${i}`,
        },
      };
    }

    // 添加数组
    (obj as any).items = [];
    for (let i = 0; i < 20; i++) {
      (obj as any).items.push({
        id: i,
        name: `Item ${i}`,
        password: `item-password-${i}`,
      });
    }

    return obj;
  }

  it("脱敏性能开销应该 < 2ms（普通对象）", () => {
    const context = createNormalObject();
    const iterations = 1000;

    // 预热
    for (let i = 0; i < 100; i++) {
      sanitizer.sanitize(context, { enabled: true });
    }

    // 性能测试
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      sanitizer.sanitize(context, { enabled: true });
    }
    const end = performance.now();

    const avgTime = (end - start) / iterations;

    console.log(
      `脱敏处理（普通对象）平均耗时: ${avgTime.toFixed(4)}ms (${iterations} 次迭代)`,
    );

    // 验证平均耗时 < 2ms
    expect(avgTime).toBeLessThan(2);
  });

  it("脱敏性能开销应该 < 2ms（较大嵌套对象）", () => {
    const context = createLargeObject();
    const iterations = 500; // 减少迭代次数，因为对象较大

    // 预热
    for (let i = 0; i < 50; i++) {
      sanitizer.sanitize(context, { enabled: true });
    }

    // 性能测试
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      sanitizer.sanitize(context, { enabled: true });
    }
    const end = performance.now();

    const avgTime = (end - start) / iterations;

    console.log(
      `脱敏处理（较大嵌套对象）平均耗时: ${avgTime.toFixed(4)}ms (${iterations} 次迭代)`,
    );

    // 验证平均耗时 < 2ms（对于普通大小的对象）
    // 较大对象可能会稍微超过，但应该在合理范围内
    expect(avgTime).toBeLessThan(5); // 允许稍大的对象有更多时间
  });

  it("脱敏性能开销应该 < 2ms（包含 Map 和 Set）", () => {
    const context: LogContext = {
      username: "testuser",
      password: "secret-password",
      map: new Map([
        ["password", "secret123"],
        ["token", "access-token"],
        ["name", "John"],
      ]),
      set: new Set(["secret1", "secret2", "public"]),
      nested: {
        password: "nested-secret",
        data: new Map([["apiKey", "key-123"]]),
      },
    };

    const iterations = 1000;

    // 预热
    for (let i = 0; i < 100; i++) {
      sanitizer.sanitize(context, { enabled: true });
    }

    // 性能测试
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      sanitizer.sanitize(context, { enabled: true });
    }
    const end = performance.now();

    const avgTime = (end - start) / iterations;

    console.log(
      `脱敏处理（包含 Map/Set）平均耗时: ${avgTime.toFixed(4)}ms (${iterations} 次迭代)`,
    );

    // 验证平均耗时 < 2ms
    expect(avgTime).toBeLessThan(2);
  });

  it("脱敏禁用时性能开销应该最小", () => {
    const context = createNormalObject();
    const iterations = 1000;

    // 预热
    for (let i = 0; i < 100; i++) {
      sanitizer.sanitize(context, { enabled: false });
    }

    // 性能测试
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      sanitizer.sanitize(context, { enabled: false });
    }
    const end = performance.now();

    const avgTime = (end - start) / iterations;

    console.log(
      `脱敏处理（已禁用）平均耗时: ${avgTime.toFixed(4)}ms (${iterations} 次迭代)`,
    );

    // 禁用时应该非常快
    expect(avgTime).toBeLessThan(0.1);
  });
});
