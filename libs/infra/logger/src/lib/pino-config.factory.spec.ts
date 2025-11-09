/**
 * Pino 配置工厂测试
 *
 * @description 验证 Pino 配置工厂的正确性和一致性
 *
 * @since 0.1.0
 */

import {
  createDevelopmentPinoConfig,
  createFastifyLoggerConfig,
  createPinoConfig,
  createProductionPinoConfig,
  DEFAULT_SERIALIZERS,
} from "./pino-config.factory.js";

describe("Pino 配置工厂", () => {
  describe("DEFAULT_SERIALIZERS", () => {
    it("应该包含正确的序列化器", () => {
      expect(DEFAULT_SERIALIZERS).toHaveProperty("err");
      expect(DEFAULT_SERIALIZERS).toHaveProperty("req");
      expect(DEFAULT_SERIALIZERS).toHaveProperty("res");
    });

    it("err 序列化器应该正确序列化 Error 对象", () => {
      const error = new Error("测试错误");
      const serialized = DEFAULT_SERIALIZERS.err(error);

      expect(serialized).toEqual({
        type: "Error",
        message: "测试错误",
        stack: error.stack,
      });
    });

    it("req 序列化器应该正确序列化请求对象", () => {
      const req = {
        method: "GET",
        url: "/test",
        headers: { "content-type": "application/json" },
      };
      const serialized = DEFAULT_SERIALIZERS.req(req);

      expect(serialized).toEqual({
        method: "GET",
        url: "/test",
        headers: { "content-type": "application/json" },
      });
    });

    it("res 序列化器应该正确序列化响应对象", () => {
      const res = { statusCode: 200 };
      const serialized = DEFAULT_SERIALIZERS.res(res);

      expect(serialized).toEqual({
        statusCode: 200,
      });
    });
  });

  describe("createDevelopmentPinoConfig", () => {
    it("应该创建开发环境配置", () => {
      const config = createDevelopmentPinoConfig();

      expect(config.level).toBe("debug");
      expect(config.transport).toBeDefined();
      expect((config.transport as any)?.target).toBe("pino-pretty");
      expect(config.serializers).toEqual(DEFAULT_SERIALIZERS);
    });

    it("应该支持自定义选项", () => {
      const config = createDevelopmentPinoConfig({
        level: "info",
        colorize: false,
      });

      expect(config.level).toBe("info");
      expect(config.transport?.options?.colorize).toBe(false);
    });
  });

  describe("createProductionPinoConfig", () => {
    it("应该创建生产环境配置", () => {
      const config = createProductionPinoConfig();

      expect(config.level).toBe("info");
      expect(config.transport).toBeUndefined();
      expect(config.serializers).toEqual(DEFAULT_SERIALIZERS);
    });

    it("应该支持自定义选项", () => {
      const config = createProductionPinoConfig({
        level: "warn",
      });

      expect(config.level).toBe("warn");
    });
  });

  describe("createPinoConfig", () => {
    beforeEach(() => {
      // 保存原始环境变量
      process.env.NODE_ENV = "test";
    });

    afterEach(() => {
      // 恢复环境变量
      delete process.env.NODE_ENV;
    });

    it("在开发环境应该返回开发配置", () => {
      process.env.NODE_ENV = "development";
      const config = createPinoConfig();

      expect(config.transport).toBeDefined();
      expect((config.transport as any)?.target).toBe("pino-pretty");
    });

    it("在生产环境应该返回生产配置", () => {
      process.env.NODE_ENV = "production";
      const config = createPinoConfig();

      expect(config.transport).toBeUndefined();
    });

    it("应该支持自定义选项", () => {
      const config = createPinoConfig({
        level: "error",
      });

      expect(config.level).toBe("error");
    });
  });

  describe("createFastifyLoggerConfig", () => {
    it("应该创建 Fastify 日志配置", () => {
      const config = createFastifyLoggerConfig();

      expect(config.serializers).toEqual(DEFAULT_SERIALIZERS);
    });

    it("应该支持自定义选项", () => {
      // 设置开发环境以启用 transport 配置
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const config = createFastifyLoggerConfig({
        level: "debug",
        prettyPrint: true,
      });

      expect(config.level).toBe("debug");
      expect(config.transport?.options).toBeDefined();

      // 恢复原始环境变量
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("配置一致性", () => {
    it("所有配置都应该包含相同的序列化器", () => {
      const devConfig = createDevelopmentPinoConfig();
      const prodConfig = createProductionPinoConfig();
      const autoConfig = createPinoConfig();
      const fastifyConfig = createFastifyLoggerConfig();

      expect(devConfig.serializers).toEqual(DEFAULT_SERIALIZERS);
      expect(prodConfig.serializers).toEqual(DEFAULT_SERIALIZERS);
      expect(autoConfig.serializers).toEqual(DEFAULT_SERIALIZERS);
      expect(fastifyConfig.serializers).toEqual(DEFAULT_SERIALIZERS);
    });

    it("序列化器应该正确处理各种错误类型", () => {
      const errorTypes = [
        new Error("普通错误"),
        new TypeError("类型错误"),
        new ReferenceError("引用错误"),
        new SyntaxError("语法错误"),
      ];

      errorTypes.forEach((error) => {
        const serialized = DEFAULT_SERIALIZERS.err(error);

        expect(serialized).toHaveProperty("type");
        expect(serialized).toHaveProperty("message");
        expect(serialized).toHaveProperty("stack");
        expect(serialized.type).toBe(error.constructor.name);
        expect(serialized.message).toBe(error.message);
        expect(serialized.stack).toBe(error.stack);
      });
    });
  });
});
