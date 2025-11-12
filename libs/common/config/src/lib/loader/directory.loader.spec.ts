/**
 * 目录加载器单元测试
 *
 * @description 测试目录加载器的批量配置文件加载功能，包括文件匹配、
 * 配置合并、环境变量替换等。遵循项目章程的测试要求。
 *
 * ## 测试覆盖范围
 *
 * - 目录批量加载
 * - 文件匹配模式
 * - 配置合并
 * - 环境变量替换
 * - 错误处理
 */

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { directoryLoader } from "./directory.loader.js";
import { ConfigRecord } from "../types/index.js";

describe("directoryLoader", () => {
  let tempDir: string;
  let configDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "directory-test-"));
    configDir = path.join(tempDir, "config");
    fs.mkdirSync(configDir);

    originalEnv = { ...process.env };
    delete process.env.TEST_HOST;
    delete process.env.TEST_PORT;
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    process.env = { ...originalEnv };
  });

  describe("目录加载", () => {
    it("应该加载目录中的所有配置文件", () => {
      // 创建多个配置文件
      fs.writeFileSync(
        path.join(configDir, "database.json"),
        JSON.stringify({ host: "localhost", port: 5432 }),
      );
      fs.writeFileSync(
        path.join(configDir, "server.json"),
        JSON.stringify({ host: "0.0.0.0", port: 3000 }),
      );

      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      expect((config as ConfigRecord).database).toBeDefined();
      expect((config as ConfigRecord).server).toBeDefined();
      expect((config as ConfigRecord).database?.host).toBe("localhost");
      expect((config as ConfigRecord).server?.port).toBe(3000);
    });

    it("应该支持 JSON 和 YAML 格式", () => {
      fs.writeFileSync(
        path.join(configDir, "app.json"),
        JSON.stringify({ name: "app" }),
      );
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        "name: config\nversion: 1.0.0",
      );

      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      expect((config as ConfigRecord).app).toBeDefined();
      expect((config as ConfigRecord).config).toBeDefined();
      expect((config as ConfigRecord).app?.name).toBe("app");
      expect((config as ConfigRecord).config?.name).toBe("config");
    });

    it("应该使用文件名（不含扩展名）作为配置键", () => {
      fs.writeFileSync(
        path.join(configDir, "database.json"),
        JSON.stringify({ host: "localhost" }),
      );
      fs.writeFileSync(path.join(configDir, "server.yml"), "host: 0.0.0.0");

      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      expect((config as ConfigRecord).database).toBeDefined();
      expect((config as ConfigRecord).server).toBeDefined();
      expect((config as ConfigRecord).database_json).toBeUndefined();
      expect((config as ConfigRecord).server_yml).toBeUndefined();
    });
  });

  describe("文件匹配", () => {
    it("应该使用默认的文件匹配模式", () => {
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ value: "json" }),
      );
      fs.writeFileSync(path.join(configDir, "config.yml"), "value: yml");
      fs.writeFileSync(path.join(configDir, "ignore.txt"), "ignore this file");

      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      expect((config as ConfigRecord).config).toBeDefined();
      expect((config as ConfigRecord).ignore).toBeUndefined();
    });

    it("应该支持自定义文件匹配模式", () => {
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ value: "json" }),
      );
      fs.writeFileSync(path.join(configDir, "config.yml"), "value: yml");
      fs.writeFileSync(path.join(configDir, "config.txt"), "value: txt");

      // 只匹配 .json 文件
      const loader = directoryLoader({
        directory: configDir,
        include: /\.json$/,
      });
      const config = loader();

      expect((config as ConfigRecord).config).toBeDefined();
      // .yml 和 .txt 文件应该被忽略
    });

    it("应该忽略不匹配的文件", () => {
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ value: "json" }),
      );
      fs.writeFileSync(path.join(configDir, "readme.md"), "# Readme");
      fs.writeFileSync(
        path.join(configDir, "script.js"),
        "console.log('test');",
      );

      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      expect((config as ConfigRecord).config).toBeDefined();
      expect((config as ConfigRecord).readme).toBeUndefined();
      expect((config as ConfigRecord).script).toBeUndefined();
    });
  });

  describe("环境变量替换", () => {
    it("应该替换配置中的环境变量", () => {
      process.env.TEST_HOST = "env-host";
      process.env.TEST_PORT = "8080";

      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({
          host: "${TEST_HOST}",
          port: "${TEST_PORT}",
        }),
      );

      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      expect((config as ConfigRecord).config?.host).toBe("env-host");
      expect((config as ConfigRecord).config?.port).toBe("8080");
    });

    it("应该可以禁用环境变量替换", () => {
      process.env.TEST_VAR = "env-value";

      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({
          value: "${TEST_VAR}",
        }),
      );

      const loader = directoryLoader({
        directory: configDir,
        ignoreEnvironmentVariableSubstitution: true,
      });
      const config = loader();

      expect((config as ConfigRecord).config?.value).toBe("${TEST_VAR}");
    });

    it("应该在未定义环境变量时抛出错误（默认行为）", () => {
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({
          value: "${UNDEFINED_VAR}",
        }),
      );

      const loader = directoryLoader({
        directory: configDir,
        disallowUndefinedEnvironmentVariables: true,
      });

      expect(() => loader()).toThrow();
    });

    it("应该允许未定义的环境变量（如果配置允许）", () => {
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({
          value: "${UNDEFINED_VAR}",
        }),
      );

      const loader = directoryLoader({
        directory: configDir,
        disallowUndefinedEnvironmentVariables: false,
      });
      const config = loader();

      // 应该保留原始值
      expect((config as ConfigRecord).config?.value).toBe("${UNDEFINED_VAR}");
    });

    it("应该替换嵌套对象中的环境变量", () => {
      process.env.DB_HOST = "db-host";

      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({
          database: {
            host: "${DB_HOST}",
            port: 5432,
          },
        }),
      );

      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      expect((config as ConfigRecord).config?.database?.host).toBe("db-host");
      expect((config as ConfigRecord).config?.database?.port).toBe(5432);
    });

    it("应该替换数组中的环境变量", () => {
      process.env.ITEM1 = "value1";
      process.env.ITEM2 = "value2";

      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({
          items: ["${ITEM1}", "${ITEM2}", "static"],
        }),
      );

      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      const items = (config as ConfigRecord).config?.items as string[];
      expect(items[0]).toBe("value1");
      expect(items[1]).toBe("value2");
      expect(items[2]).toBe("static");
    });
  });

  describe("错误处理", () => {
    it("应该在目录不存在时返回空对象", () => {
      const loader = directoryLoader({
        directory: path.join(tempDir, "nonexistent"),
      });

      expect(() => loader()).not.toThrow();

      const config = loader();

      expect(config).toEqual({});
    });

    it("应该在 JSON 解析失败时抛出错误", () => {
      fs.writeFileSync(
        path.join(configDir, "invalid.json"),
        "invalid json content {",
      );

      const loader = directoryLoader({ directory: configDir });

      expect(() => loader()).toThrow();
    });

    it("应该在 YAML 解析失败时抛出错误", () => {
      fs.writeFileSync(
        path.join(configDir, "invalid.yml"),
        "invalid: yaml: content: [",
      );

      const loader = directoryLoader({ directory: configDir });

      expect(() => loader()).toThrow();
    });
  });

  describe("边界情况", () => {
    it("应该处理空目录", () => {
      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      expect(config).toBeDefined();
      expect(Object.keys(config as ConfigRecord).length).toBe(0);
    });

    it("应该处理只有不匹配文件的目录", () => {
      fs.writeFileSync(path.join(configDir, "readme.md"), "# Readme");
      fs.writeFileSync(
        path.join(configDir, "script.js"),
        "console.log('test');",
      );

      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      expect(config).toBeDefined();
      expect(Object.keys(config as ConfigRecord).length).toBe(0);
    });

    it("应该处理包含空文件的目录", () => {
      fs.writeFileSync(path.join(configDir, "empty.json"), "");

      const loader = directoryLoader({ directory: configDir });

      expect(() => loader()).toThrow(); // JSON 解析空文件会失败
    });

    it("应该处理包含多个同名但不同扩展名的文件", () => {
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ format: "json" }),
      );
      fs.writeFileSync(path.join(configDir, "config.yml"), "format: yml");

      const loader = directoryLoader({ directory: configDir });
      const config = loader();

      // 后加载的文件会覆盖前面的
      expect((config as ConfigRecord).config).toBeDefined();
    });
  });
});
