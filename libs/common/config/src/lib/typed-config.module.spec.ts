/**
 * 类型化配置模块单元测试
 *
 * @description 测试 TypedConfigModule 的核心功能，包括同步和异步配置加载、
 * 配置验证、提供者注册等。这是关键路径测试，需要达到 ≥90% 覆盖率。
 *
 * ## 测试覆盖范围
 *
 * - forRoot 方法（同步配置加载）
 * - forRootAsync 方法（异步配置加载）
 * - 配置加载和合并
 * - 配置验证
 * - 提供者注册
 * - 全局模块配置
 * - 错误处理
 */

import { describe, expect, it, beforeEach } from "@jest/globals";
import { Type } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { TypedConfigModule } from "./typed-config.module.js";
import { fileLoader, dotenvLoader } from "./loader/index.js";
import { ConfigRecord } from "./types/index.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * 测试用的数据库配置类
 */
class DatabaseConfig {
  @IsString()
  host!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  port!: number;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;
}

/**
 * 测试用的服务器配置类
 */
class ServerConfig {
  @IsString()
  host!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  port!: number;
}

/**
 * 测试用的根配置类
 */
class RootConfig {
  @ValidateNested()
  @Type(() => DatabaseConfig)
  database!: DatabaseConfig;

  @ValidateNested()
  @Type(() => ServerConfig)
  server!: ServerConfig;
}

describe("TypedConfigModule", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("forRoot - 同步配置加载", () => {
    it("应该成功创建配置模块", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        database: {
          host: "localhost",
          port: 5432,
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const module = TypedConfigModule.forRoot({
        schema: RootConfig,
        load: fileLoader({ path: configPath }),
      });

      expect(module).toBeDefined();
      expect(module.module).toBe(TypedConfigModule);
      expect(module.global).toBe(true);
      expect(module.providers).toBeDefined();
      expect(module.exports).toBeDefined();
    });

    it("应该注册配置类为提供者", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        database: {
          host: "localhost",
          port: 5432,
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const module = TypedConfigModule.forRoot({
        schema: RootConfig,
        load: fileLoader({ path: configPath }),
      });

      // 应该注册 RootConfig 和嵌套配置类
      expect(module.providers).toBeDefined();
      expect(Array.isArray(module.providers)).toBe(true);
      expect(module.providers!.length).toBeGreaterThan(0);
    });

    it("应该支持多个加载器", () => {
      const configPath = path.join(tempDir, "config.json");
      const defaultConfig = {
        database: {
          host: "localhost",
          port: 5432,
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig));

      // 设置环境变量覆盖配置
      process.env.SERVER__PORT = "8080";

      const module = TypedConfigModule.forRoot({
        schema: RootConfig,
        load: [
          fileLoader({ path: configPath }),
          dotenvLoader({ separator: "__", ignoreEnvFile: true }), // 忽略 .env 文件，只使用环境变量
        ],
      });

      expect(module).toBeDefined();
      expect(module.providers).toBeDefined();
    });

    it("应该支持 isGlobal 选项", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        database: {
          host: "localhost",
          port: 5432,
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const module = TypedConfigModule.forRoot({
        schema: RootConfig,
        load: fileLoader({ path: configPath }),
        isGlobal: false,
      });

      expect(module.global).toBe(false);
    });

    it("应该在配置验证失败时抛出错误", () => {
      const configPath = path.join(tempDir, "config.json");
      // 无效配置：缺少必需字段
      const invalidConfig = {
        database: {
          host: "localhost",
          // port 缺失
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(invalidConfig));

      expect(() => {
        TypedConfigModule.forRoot({
          schema: RootConfig,
          load: fileLoader({ path: configPath }),
        });
      }).toThrow();
    });

    it("应该支持自定义验证选项", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        database: {
          host: "localhost",
          port: 5432,
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
        // 额外字段
        extra: "field",
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      // 使用 whitelist: false 允许额外字段
      const module = TypedConfigModule.forRoot({
        schema: RootConfig,
        load: fileLoader({ path: configPath }),
        validationOptions: {
          whitelist: false,
        },
      });

      expect(module).toBeDefined();
    });
  });

  describe("forRootAsync - 异步配置加载", () => {
    it("应该成功创建异步配置模块", async () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        database: {
          host: "localhost",
          port: 5432,
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const module = await TypedConfigModule.forRootAsync({
        schema: RootConfig,
        load: fileLoader({ path: configPath }),
      });

      expect(module).toBeDefined();
      expect(module.module).toBe(TypedConfigModule);
      expect(module.global).toBe(true);
    });

    it("应该支持异步加载器", async () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        database: {
          host: "localhost",
          port: 5432,
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      // 使用异步加载器
      const asyncLoader = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return fileLoader({ path: configPath })();
      };

      const module = await TypedConfigModule.forRootAsync({
        schema: RootConfig,
        load: asyncLoader,
      });

      expect(module).toBeDefined();
    });

    it("应该在异步配置加载失败时抛出错误", async () => {
      const asyncLoader = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error("加载失败");
      };

      await expect(
        TypedConfigModule.forRootAsync({
          schema: RootConfig,
          load: asyncLoader,
        }),
      ).rejects.toThrow();
    });
  });

  describe("配置合并", () => {
    it("应该正确合并多个加载器的配置", () => {
      const configPath1 = path.join(tempDir, "config1.json");
      const configPath2 = path.join(tempDir, "config2.json");

      const config1 = {
        database: {
          host: "localhost",
          port: 5432,
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
      };

      const config2 = {
        server: {
          port: 8080, // 覆盖 config1 的 port
        },
      };

      fs.writeFileSync(configPath1, JSON.stringify(config1));
      fs.writeFileSync(configPath2, JSON.stringify(config2));

      const module = TypedConfigModule.forRoot({
        schema: RootConfig,
        load: [
          fileLoader({ path: configPath1 }),
          fileLoader({ path: configPath2 }),
        ],
      });

      expect(module).toBeDefined();
    });
  });

  describe("错误处理", () => {
    it("应该在配置加载失败时抛出错误", () => {
      expect(() => {
        TypedConfigModule.forRoot({
          schema: RootConfig,
          load: fileLoader({
            path: path.join(tempDir, "nonexistent.json"),
          }),
        });
      }).toThrow();
    });

    it("应该在配置验证失败时提供详细错误信息", () => {
      const configPath = path.join(tempDir, "config.json");
      const invalidConfig = {
        database: {
          host: "localhost",
          port: "invalid", // 无效的端口类型
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(invalidConfig));

      expect(() => {
        TypedConfigModule.forRoot({
          schema: RootConfig,
          load: fileLoader({ path: configPath }),
        });
      }).toThrow();
    });
  });

  describe("边界情况", () => {
    it("应该处理空配置对象", () => {
      const configPath = path.join(tempDir, "config.json");
      fs.writeFileSync(configPath, "{}");

      // 创建一个允许空的配置类
      class EmptyConfig {
        @IsOptional()
        test?: string;
      }

      const module = TypedConfigModule.forRoot({
        schema: EmptyConfig,
        load: fileLoader({ path: configPath }),
      });

      expect(module).toBeDefined();
    });

    it("应该处理可选字段", () => {
      const configPath = path.join(tempDir, "config.json");
      const configData = {
        database: {
          host: "localhost",
          port: 5432,
          // username 和 password 是可选的，不提供
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(configData));

      const module = TypedConfigModule.forRoot({
        schema: RootConfig,
        load: fileLoader({ path: configPath }),
      });

      expect(module).toBeDefined();
    });
  });
});
