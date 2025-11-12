/**
 * 文件加载器单元测试
 *
 * @description 测试文件加载器的各种功能，包括文件加载、格式解析、环境变量替换等。
 * 遵循项目章程的测试要求：单元测试与源代码同目录，使用 .spec.ts 后缀。
 *
 * ## 测试覆盖范围
 *
 * - 文件加载功能（JSON、YAML 格式）
 * - 文件查找机制（自动查找配置文件）
 * - 环境变量替换功能
 * - 错误处理（文件不存在、格式错误、解析错误等）
 * - 边界条件和异常情况
 */

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileLoader } from "./file.loader.js";
import { ConfigError } from "../errors/index.js";
import { ConfigRecord } from "../types/index.js";

describe("fileLoader", () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 创建临时目录用于测试
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    // 恢复环境变量
    process.env = { ...originalEnv };
  });

  describe("JSON 文件加载", () => {
    it("应该成功加载 JSON 配置文件", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        database: {
          host: "localhost",
          port: 5432,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual(configData);
    });

    it("应该正确处理嵌套的 JSON 配置", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
        database: {
          host: "localhost",
          port: 5432,
          connection: {
            pool: {
              min: 2,
              max: 10,
            },
          },
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual(configData);
      expect((config as ConfigRecord).database).toBeDefined();
      expect((config as ConfigRecord).database?.connection?.pool).toBeDefined();
    });
  });

  describe("YAML 文件加载", () => {
    it("应该成功加载 .yml 配置文件", () => {
      const configPath = path.join(tempDir, "config.yml");
      const yamlContent = `
database:
  host: localhost
  port: 5432
`;
      fs.writeFileSync(configPath, yamlContent);

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect((config as ConfigRecord).database).toBeDefined();
      expect((config as ConfigRecord).database?.host).toBe("localhost");
      expect((config as ConfigRecord).database?.port).toBe(5432);
    });

    it("应该成功加载 .yaml 配置文件", () => {
      const configPath = path.join(tempDir, "config.yaml");
      const yamlContent = `
server:
  host: 0.0.0.0
  port: 3000
`;
      fs.writeFileSync(configPath, yamlContent);

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect((config as ConfigRecord).server).toBeDefined();
      expect((config as ConfigRecord).server?.host).toBe("0.0.0.0");
      expect((config as ConfigRecord).server?.port).toBe(3000);
    });
  });

  describe("文件自动查找", () => {
    it("应该自动查找 JSON 配置文件", () => {
      const configPath = path.join(tempDir, "app.json");
      const configData = { test: "value" };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const loader = fileLoader({
        searchFrom: tempDir,
        basename: "app",
      });
      const config = loader();

      expect(config).toEqual(configData);
    });

    it("应该优先查找 .json 文件", () => {
      // 创建多个格式的文件
      fs.writeFileSync(path.join(tempDir, "config.json"), '{"type": "json"}');
      fs.writeFileSync(path.join(tempDir, "config.yml"), "type: yml");

      const loader = fileLoader({
        searchFrom: tempDir,
        basename: "config",
      });
      const config = loader();

      expect((config as ConfigRecord).type).toBe("json");
    });

    it("应该按顺序查找 .json -> .yml -> .yaml", () => {
      // 创建 .yml 文件（.json 不存在）
      const configPath = path.join(tempDir, "config.yml");
      fs.writeFileSync(configPath, "type: yml");

      const loader = fileLoader({
        searchFrom: tempDir,
        basename: "config",
      });
      const config = loader();

      expect((config as ConfigRecord).type).toBe("yml");
    });
  });

  describe("环境变量替换", () => {
    it("应该替换 ${VAR} 格式的环境变量", () => {
      process.env.TEST_HOST = "test-host";
      process.env.TEST_PORT = "8080";

      const configPath = path.join(tempDir, "config.json");
      const configData = {
        host: "${TEST_HOST}",
        port: "${TEST_PORT}",
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect((config as ConfigRecord).host).toBe("test-host");
      expect((config as ConfigRecord).port).toBe("8080");
    });

    it("应该支持 ${VAR:-DEFAULT} 默认值语法", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        host: "${MISSING_VAR:-localhost}",
        port: "${MISSING_PORT:-3000}",
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect((config as ConfigRecord).host).toBe("localhost");
      expect((config as ConfigRecord).port).toBe("3000");
    });

    it("应该使用环境变量值而不是默认值（当环境变量存在时）", () => {
      process.env.CUSTOM_HOST = "custom-host";

      const configPath = path.join(tempDir, "config.json");
      const configData = {
        host: "${CUSTOM_HOST:-default-host}",
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect((config as ConfigRecord).host).toBe("custom-host");
    });

    it("应该替换嵌套对象中的环境变量", () => {
      process.env.DB_HOST = "db-host";

      const configPath = path.join(tempDir, "config.json");
      const configData = {
        database: {
          host: "${DB_HOST}",
          port: 5432,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect((config as ConfigRecord).database?.host).toBe("db-host");
      expect((config as ConfigRecord).database?.port).toBe(5432);
    });

    it("应该替换数组中的环境变量", () => {
      process.env.ITEM1 = "value1";
      process.env.ITEM2 = "value2";

      const configPath = path.join(tempDir, "config.json");
      const configData = {
        items: ["${ITEM1}", "${ITEM2}", "static"],
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const loader = fileLoader({ path: configPath });
      const config = loader();

      const items = (config as ConfigRecord).items as string[];
      expect(items[0]).toBe("value1");
      expect(items[1]).toBe("value2");
      expect(items[2]).toBe("static");
    });

    it("应该可以禁用环境变量替换", () => {
      process.env.TEST_VAR = "should-not-be-used";

      const configPath = path.join(tempDir, "config.json");
      const configData = {
        value: "${TEST_VAR}",
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const loader = fileLoader({
        path: configPath,
        ignoreEnvironmentVariableSubstitution: true,
      });
      const config = loader();

      expect((config as ConfigRecord).value).toBe("${TEST_VAR}");
    });
  });

  describe("错误处理", () => {
    it("应该在文件不存在时抛出 FileNotFoundError", () => {
      const loader = fileLoader({
        path: path.join(tempDir, "nonexistent.json"),
      });

      expect(() => loader()).toThrow(ConfigError);
    });

    it("应该在自动查找时找不到文件时抛出错误", () => {
      const loader = fileLoader({
        searchFrom: tempDir,
        basename: "nonexistent",
      });

      expect(() => loader()).toThrow(ConfigError);
    });

    it("应该在文件格式不支持时抛出 FileFormatError", () => {
      const configPath = path.join(tempDir, "config.txt");
      fs.writeFileSync(configPath, "plain text");

      const loader = fileLoader({ path: configPath });

      expect(() => loader()).toThrow(ConfigError);
    });

    it("应该在 JSON 解析失败时抛出 ParseError", () => {
      const configPath = path.join(tempDir, "config.json");
      fs.writeFileSync(configPath, "invalid json content {");

      const loader = fileLoader({ path: configPath });

      expect(() => loader()).toThrow(ConfigError);
    });

    it("应该在 YAML 解析失败时抛出 ParseError", () => {
      const configPath = path.join(tempDir, "config.yml");
      fs.writeFileSync(configPath, "invalid: yaml: content: [");

      const loader = fileLoader({ path: configPath });

      expect(() => loader()).toThrow(ConfigError);
    });
  });

  describe("边界情况", () => {
    it("应该处理空 JSON 对象", () => {
      const configPath = path.join(tempDir, "config.json");
      fs.writeFileSync(configPath, "{}");

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual({});
    });

    it("应该处理空 YAML 文件", () => {
      const configPath = path.join(tempDir, "config.yml");
      fs.writeFileSync(configPath, "");

      const loader = fileLoader({ path: configPath });
      const config = loader();

      // 空 YAML 文件会返回 null 或 undefined（js-yaml 的行为）
      expect(
        config === null || config === undefined || typeof config === "object",
      ).toBe(true);
    });

    it("应该处理包含特殊字符的配置值", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        special: "value with spaces and symbols: !@#$%",
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect((config as ConfigRecord).special).toBe(
        "value with spaces and symbols: !@#$%",
      );
    });

    it("应该处理数字类型的配置值", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        port: 3000,
        count: 100,
        ratio: 0.5,
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect((config as ConfigRecord).port).toBe(3000);
      expect((config as ConfigRecord).count).toBe(100);
      expect((config as ConfigRecord).ratio).toBe(0.5);
    });

    it("应该处理布尔类型的配置值", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        enabled: true,
        debug: false,
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const loader = fileLoader({ path: configPath });
      const config = loader();

      expect((config as ConfigRecord).enabled).toBe(true);
      expect((config as ConfigRecord).debug).toBe(false);
    });
  });
});
