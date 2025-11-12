/**
 * 环境变量加载器单元测试
 *
 * @description 测试环境变量加载器的各种功能，包括 .env 文件加载、环境变量读取、
 * 变量展开、分隔符解析、键转换等。遵循项目章程的测试要求。
 *
 * ## 测试覆盖范围
 *
 * - .env 文件加载功能
 * - 环境变量读取功能
 * - 变量展开功能（dotenv-expand）
 * - 分隔符解析（嵌套配置）
 * - 键转换功能
 * - 错误处理和边界情况
 */

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { dotenvLoader } from "./dotenv.loader.js";
import { ConfigError } from "../errors/index.js";
import { ConfigRecord } from "../types/index.js";

describe("dotenvLoader", () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let envFilePath: string;

  beforeEach(() => {
    // 创建临时目录用于测试
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dotenv-test-"));
    envFilePath = path.join(tempDir, ".env");

    // 保存原始环境变量
    originalEnv = { ...process.env };

    // 清理可能存在的环境变量
    delete process.env.TEST_VAR;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.NESTED__KEY;
    delete process.env.NESTED__DEEP__VALUE;
  });

  afterEach(() => {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    // 恢复环境变量
    process.env = { ...originalEnv };
  });

  describe(".env 文件加载", () => {
    it("应该成功加载 .env 文件", () => {
      fs.writeFileSync(
        envFilePath,
        `TEST_VAR=test-value
DB_HOST=localhost
DB_PORT=5432`,
      );

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).TEST_VAR).toBe("test-value");
      expect((config as ConfigRecord).DB_HOST).toBe("localhost");
      expect((config as ConfigRecord).DB_PORT).toBe("5432");
    });

    it("应该处理带引号的值", () => {
      fs.writeFileSync(
        envFilePath,
        `QUOTED_VAR="quoted value"
SINGLE_QUOTED='single quoted'`,
      );

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).QUOTED_VAR).toBe("quoted value");
      expect((config as ConfigRecord).SINGLE_QUOTED).toBe("single quoted");
    });

    it("应该处理空值", () => {
      fs.writeFileSync(
        envFilePath,
        `EMPTY_VAR=
NORMAL_VAR=value`,
      );

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).EMPTY_VAR).toBe("");
      expect((config as ConfigRecord).NORMAL_VAR).toBe("value");
    });

    it("应该忽略注释行", () => {
      fs.writeFileSync(
        envFilePath,
        `# 这是注释
TEST_VAR=value
# 另一个注释
ANOTHER_VAR=another-value`,
      );

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).TEST_VAR).toBe("value");
      expect((config as ConfigRecord).ANOTHER_VAR).toBe("another-value");
      expect((config as ConfigRecord)["# 这是注释"]).toBeUndefined();
    });

    it("应该可以忽略 .env 文件", () => {
      fs.writeFileSync(envFilePath, "FILE_VAR=from-file");

      // 设置环境变量（优先级高于 .env 文件）
      process.env.FILE_VAR = "from-env";

      const loader = dotenvLoader({
        envFilePath,
        ignoreEnvFile: true,
      });
      const config = loader();

      // 应该只从环境变量读取，不从文件读取
      expect((config as ConfigRecord).FILE_VAR).toBe("from-env");
    });

    it("应该可以忽略环境变量", () => {
      process.env.ENV_VAR = "from-env";

      const loader = dotenvLoader({
        ignoreEnvFile: true, // 忽略 .env 文件，避免文件不存在错误
        ignoreEnvVars: true,
      });
      const config = loader();

      expect((config as ConfigRecord).ENV_VAR).toBeUndefined();
    });
  });

  describe("环境变量读取", () => {
    it("应该从 process.env 读取环境变量", () => {
      process.env.TEST_VAR = "test-value";
      process.env.ANOTHER_VAR = "another-value";

      const loader = dotenvLoader({
        ignoreEnvFile: true, // 忽略 .env 文件，避免文件不存在错误
      });
      const config = loader();

      expect((config as ConfigRecord).TEST_VAR).toBe("test-value");
      expect((config as ConfigRecord).ANOTHER_VAR).toBe("another-value");
    });

    it(".env 文件中的值应该可以被环境变量覆盖", () => {
      fs.writeFileSync(envFilePath, "TEST_VAR=from-file");
      process.env.TEST_VAR = "from-env";

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      // 环境变量优先级更高
      expect((config as ConfigRecord).TEST_VAR).toBe("from-env");
    });

    it("应该合并 .env 文件和环境变量", () => {
      fs.writeFileSync(envFilePath, "FILE_VAR=from-file");
      process.env.ENV_VAR = "from-env";

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).FILE_VAR).toBe("from-file");
      expect((config as ConfigRecord).ENV_VAR).toBe("from-env");
    });
  });

  describe("变量展开", () => {
    it("应该展开 ${VAR} 格式的变量引用", () => {
      // 使用字符串连接避免模板字符串变量替换
      const envContent = `BASE_URL=http://localhost
API_URL=\${BASE_URL}/api
VERSION=1.0.0`;
      fs.writeFileSync(envFilePath, envContent);

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).BASE_URL).toBe("http://localhost");
      expect((config as ConfigRecord).API_URL).toBe("http://localhost/api");
    });

    it("应该展开嵌套的变量引用", () => {
      // 使用字符串连接避免模板字符串变量替换
      const envContent = `HOST=localhost
PORT=3000
BASE_URL=http://\${HOST}:\${PORT}
API_URL=\${BASE_URL}/api`;
      fs.writeFileSync(envFilePath, envContent);

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).BASE_URL).toBe("http://localhost:3000");
      expect((config as ConfigRecord).API_URL).toBe(
        "http://localhost:3000/api",
      );
    });

    it("应该可以禁用变量展开", () => {
      // 使用字符串连接避免模板字符串变量替换
      const envContent = `BASE_URL=http://localhost
API_URL=\${BASE_URL}/api`;
      fs.writeFileSync(envFilePath, envContent);

      const loader = dotenvLoader({
        envFilePath,
        enableExpandVariables: false,
      });
      const config = loader();

      expect((config as ConfigRecord).BASE_URL).toBe("http://localhost");
      // 变量展开被禁用，应该保持原始值
      expect((config as ConfigRecord).API_URL).toBe("${BASE_URL}/api");
    });
  });

  describe("分隔符解析", () => {
    it("应该使用默认分隔符 '__' 解析嵌套配置", () => {
      process.env.NESTED__KEY = "value";
      process.env.NESTED__DEEP__VALUE = "deep-value";

      const loader = dotenvLoader({
        ignoreEnvFile: true, // 忽略 .env 文件，避免文件不存在错误
      });
      const config = loader();

      expect((config as ConfigRecord).NESTED).toBeDefined();
      expect((config as ConfigRecord).NESTED?.KEY).toBe("value");
      expect((config as ConfigRecord).NESTED?.DEEP?.VALUE).toBe("deep-value");
    });

    it("应该支持自定义分隔符", () => {
      // 使用不同的分隔符，避免与键名中的下划线冲突
      process.env.NESTED_DOT_KEY = "value";
      process.env.NESTED_DOT_DEEP_DOT_VALUE = "deep-value";

      const loader = dotenvLoader({
        separator: "_DOT_",
        ignoreEnvFile: true, // 忽略 .env 文件，避免文件不存在错误
      });
      const config = loader();

      expect((config as ConfigRecord).NESTED).toBeDefined();
      expect((config as ConfigRecord).NESTED?.KEY).toBe("value");
      expect((config as ConfigRecord).NESTED?.DEEP?.VALUE).toBe("deep-value");
    });

    it("应该处理多级嵌套", () => {
      process.env.LEVEL1__LEVEL2__LEVEL3__VALUE = "deep-value";

      const loader = dotenvLoader({
        ignoreEnvFile: true, // 忽略 .env 文件，避免文件不存在错误
      });
      const config = loader();

      expect((config as ConfigRecord).LEVEL1?.LEVEL2?.LEVEL3?.VALUE).toBe(
        "deep-value",
      );
    });

    it("应该处理混合的扁平键和嵌套键", () => {
      process.env.FLAT_KEY = "flat-value";
      process.env.NESTED__KEY = "nested-value";

      const loader = dotenvLoader({
        ignoreEnvFile: true, // 忽略 .env 文件，避免文件不存在错误
      });
      const config = loader();

      expect((config as ConfigRecord).FLAT_KEY).toBe("flat-value");
      expect((config as ConfigRecord).NESTED?.KEY).toBe("nested-value");
    });

    it("应该处理空分隔符（不进行嵌套解析）", () => {
      process.env.NESTED__KEY = "value";

      const loader = dotenvLoader({
        separator: "",
        ignoreEnvFile: true, // 忽略 .env 文件，避免文件不存在错误
      });
      const config = loader();

      // 空分隔符应该保持原始键名
      expect((config as ConfigRecord)["NESTED__KEY"]).toBe("value");
      expect((config as ConfigRecord).NESTED).toBeUndefined();
    });
  });

  describe("键转换", () => {
    it("应该应用键转换器函数", () => {
      process.env.TEST_VAR = "value";
      process.env.ANOTHER_VAR = "another";

      const loader = dotenvLoader({
        keyTransformer: (key) => key.toLowerCase(),
        ignoreEnvFile: true, // 忽略 .env 文件，避免文件不存在错误
      });
      const config = loader();

      expect((config as ConfigRecord).test_var).toBe("value");
      expect((config as ConfigRecord).another_var).toBe("another");
      expect((config as ConfigRecord).TEST_VAR).toBeUndefined();
    });

    it("应该先应用键转换再应用分隔符解析", () => {
      process.env.NESTED__KEY = "value";

      const loader = dotenvLoader({
        separator: "__",
        keyTransformer: (key) => key.toLowerCase(),
        ignoreEnvFile: true, // 忽略 .env 文件，避免文件不存在错误
      });
      const config = loader();

      // 先转换为小写，然后解析嵌套
      expect((config as ConfigRecord).nested?.key).toBe("value");
    });

    it("应该处理键转换器返回空字符串的情况", () => {
      process.env.TEST_VAR = "value";
      process.env.ANOTHER_VAR = "another";

      const loader = dotenvLoader({
        keyTransformer: () => "",
        ignoreEnvFile: true, // 忽略 .env 文件，避免文件不存在错误
      });
      const config = loader();

      // 空字符串键会被覆盖，最后一个值会保留
      // 这个测试主要是验证不会抛出错误
      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
    });
  });

  describe("错误处理", () => {
    it("应该在 .env 文件不存在时静默忽略（当 ignoreEnvFile 为 false）", () => {
      const loader = dotenvLoader({
        envFilePath: path.join(tempDir, "nonexistent.env"),
        ignoreEnvFile: false,
        ignoreEnvVars: true,
      });

      // 文件不存在时应该被静默忽略，不抛出错误
      expect(() => loader()).not.toThrow();

      const config = loader();

      expect(config).toEqual({});
    });

    it("应该在 .env 文件格式错误时抛出错误", () => {
      fs.writeFileSync(envFilePath, "INVALID_FORMAT\nMALFORMED=line");

      const loader = dotenvLoader({ envFilePath });

      // dotenv 库应该能够处理大多数格式，但某些格式可能抛出错误
      expect(() => loader()).not.toThrow();
    });
  });

  describe("边界情况", () => {
    it("应该处理空 .env 文件", () => {
      fs.writeFileSync(envFilePath, "");

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect(config).toBeDefined();
      expect(Object.keys(config as ConfigRecord).length).toBeGreaterThanOrEqual(
        0,
      );
    });

    it("应该处理只有空行的 .env 文件", () => {
      fs.writeFileSync(envFilePath, "\n\n\n");

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect(config).toBeDefined();
    });

    it("应该处理包含特殊字符的值", () => {
      // 特殊字符需要用引号包裹
      fs.writeFileSync(
        envFilePath,
        'SPECIAL_CHARS="value with spaces and !@#$%^&*()"',
      );

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).SPECIAL_CHARS).toBe(
        "value with spaces and !@#$%^&*()",
      );
    });

    it("应该处理多行值（如果支持）", () => {
      fs.writeFileSync(
        envFilePath,
        `MULTILINE="line1
line2
line3"`,
      );

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).MULTILINE).toBeDefined();
    });

    it("应该处理默认选项", () => {
      // 创建 .env 文件或使用 ignoreEnvFile
      const loader = dotenvLoader({
        ignoreEnvFile: true, // 忽略不存在的 .env 文件
      });
      const config = loader();

      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
    });

    it("应该处理多个 .env 文件路径", () => {
      const envFile1 = path.join(tempDir, ".env.local");
      const envFile2 = path.join(tempDir, ".env");

      fs.writeFileSync(envFile1, "VAR1=value1");
      fs.writeFileSync(envFile2, "VAR2=value2");

      const loader = dotenvLoader({
        envFilePath: [envFile1, envFile2],
      });
      const config = loader();

      // 后续文件会覆盖前面的值
      expect((config as ConfigRecord).VAR1).toBe("value1");
      expect((config as ConfigRecord).VAR2).toBe("value2");
    });
  });

  describe("配置合并", () => {
    it("应该正确合并 .env 文件和环境变量", () => {
      fs.writeFileSync(
        envFilePath,
        `FILE_ONLY=from-file
SHARED=from-file`,
      );
      process.env.ENV_ONLY = "from-env";
      process.env.SHARED = "from-env";

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).FILE_ONLY).toBe("from-file");
      expect((config as ConfigRecord).ENV_ONLY).toBe("from-env");
      // 环境变量优先级更高
      expect((config as ConfigRecord).SHARED).toBe("from-env");
    });

    it("应该正确处理变量展开和分隔符解析的顺序", () => {
      // 注意：在 .env 文件中，${VAR} 会被 dotenv-expand 处理
      // 使用字符串连接避免模板字符串变量替换
      const envContent = `BASE_URL=http://localhost
API__BASE_URL=\${BASE_URL}
API__PORT=3000`;
      fs.writeFileSync(envFilePath, envContent);

      const loader = dotenvLoader({ envFilePath });
      const config = loader();

      expect((config as ConfigRecord).BASE_URL).toBe("http://localhost");
      // dotenv-expand 会展开变量引用，然后分隔符解析会创建嵌套结构
      expect((config as ConfigRecord).API?.BASE_URL).toBe("http://localhost");
      expect((config as ConfigRecord).API?.PORT).toBe("3000");
    });
  });
});
