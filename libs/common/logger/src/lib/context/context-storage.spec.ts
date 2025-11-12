/**
 * ContextStorage 单元测试
 *
 * @description 测试上下文存储服务的功能
 */

import { describe, it, expect } from "@jest/globals";
import { ContextStorage } from "./context-storage.js";
import type { RequestContext } from "./request-context.types.js";

describe("ContextStorage", () => {
  describe("getContext", () => {
    it("应该在没有上下文时返回 undefined", () => {
      const context = ContextStorage.getContext();
      expect(context).toBeUndefined();
    });

    it("应该在上下文中返回存储的上下文", () => {
      const testContext: RequestContext = {
        requestId: "test-123",
        method: "GET",
        url: "/test",
      };

      ContextStorage.run(testContext, () => {
        const context = ContextStorage.getContext();
        expect(context).toEqual(testContext);
        expect(context?.requestId).toBe("test-123");
        expect(context?.method).toBe("GET");
      });
    });
  });

  describe("run", () => {
    it("应该在上下文中执行同步函数", () => {
      const testContext: RequestContext = {
        requestId: "test-456",
      };

      const result = ContextStorage.run(testContext, () => {
        const context = ContextStorage.getContext();
        return context?.requestId;
      });

      expect(result).toBe("test-456");
    });

    it("应该在函数执行后清理上下文", () => {
      const testContext: RequestContext = {
        requestId: "test-789",
      };

      ContextStorage.run(testContext, () => {
        // 上下文应该存在
        expect(ContextStorage.getContext()?.requestId).toBe("test-789");
      });

      // 函数执行后，上下文应该被清理
      expect(ContextStorage.getContext()).toBeUndefined();
    });

    it("应该支持嵌套上下文", () => {
      const outerContext: RequestContext = {
        requestId: "outer-123",
        method: "GET",
      };

      const innerContext: RequestContext = {
        requestId: "inner-456",
        method: "POST",
      };

      ContextStorage.run(outerContext, () => {
        expect(ContextStorage.getContext()?.requestId).toBe("outer-123");

        ContextStorage.run(innerContext, () => {
          expect(ContextStorage.getContext()?.requestId).toBe("inner-456");
        });

        // 内层上下文结束后，应该恢复外层上下文
        expect(ContextStorage.getContext()?.requestId).toBe("outer-123");
      });
    });
  });

  describe("runAsync", () => {
    it("应该在上下文中执行异步函数", async () => {
      const testContext: RequestContext = {
        requestId: "async-123",
      };

      const result = await ContextStorage.runAsync(testContext, async () => {
        const context = ContextStorage.getContext();
        return context?.requestId;
      });

      expect(result).toBe("async-123");
    });

    it("应该在异步函数执行后清理上下文", async () => {
      const testContext: RequestContext = {
        requestId: "async-456",
      };

      await ContextStorage.runAsync(testContext, async () => {
        // 上下文应该存在
        expect(ContextStorage.getContext()?.requestId).toBe("async-456");
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(ContextStorage.getContext()?.requestId).toBe("async-456");
      });

      // 异步函数执行后，上下文应该被清理
      expect(ContextStorage.getContext()).toBeUndefined();
    });

    it("应该在异步调用链中传播上下文", async () => {
      const testContext: RequestContext = {
        requestId: "async-chain-123",
      };

      await ContextStorage.runAsync(testContext, async () => {
        const context1 = ContextStorage.getContext();
        expect(context1?.requestId).toBe("async-chain-123");

        await new Promise<void>((resolve) => {
          setTimeout(() => {
            const context2 = ContextStorage.getContext();
            expect(context2?.requestId).toBe("async-chain-123");
            resolve();
          }, 10);
        });

        const result = await Promise.resolve().then(() => {
          return ContextStorage.getContext()?.requestId;
        });

        expect(result).toBe("async-chain-123");
      });
    });
  });
});
