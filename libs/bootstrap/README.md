# @hl8/config

**类型安全的配置管理模块** - 适用于任何 Node.js 和 NestJS 应用

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/hl8/config)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-red.svg)](https://nestjs.com/)

---

## ⚠️ 重要说明

### 模块职责划分

**⚠️ 重要提示**：

`@hl8/config` **并不知道使用者的配置需求**，它只是一个通用的配置管理工具。因此：

- ✅ **使用者必须自己定义配置类** - 根据业务需求定义配置结构
- ✅ **使用者必须自己定义验证规则** - 使用 class-validator 装饰器定义验证规则
- ✅ **使用者必须遵循技术规范** - 使用 TypeScript 类和装饰器，遵循 class-validator 规范

**`@hl8/config` 的职责**：

- ✅ **读取配置文件** - 从文件系统、环境变量、远程服务等加载配置
- ✅ **配置验证** - 使用 class-validator 验证配置完整性（基于使用者定义的规则）
- ✅ **配置合并** - 深度合并多个配置源
- ✅ **配置注入** - 将配置注册为 NestJS 提供者，支持依赖注入
- ✅ **配置缓存** - 内置缓存机制，提升性能

**使用者的职责**：

- ✅ **定义配置类** - 使用 TypeScript 类和装饰器定义配置结构
- ✅ **定义验证规则** - 使用 class-validator 装饰器定义验证规则
- ✅ **遵循技术规范** - 遵循 TypeScript 类和 class-validator 的技术规范
- ✅ **使用配置** - 通过依赖注入使用配置，享受类型安全

**职责分离示例**：

```typescript
// 使用者定义配置类（应用层）
export class AppConfig {
  @IsString()
  public readonly name!: string;

  @IsNumber()
  @Type(() => Number)
  public readonly port!: number;
}

// @hl8/config 负责读取和验证（基础设施层）
TypedConfigModule.forRoot({
  schema: AppConfig, // 使用者定义的配置类
  load: [
    fileLoader({ path: "./config/app.yml" }), // @hl8/config 读取配置文件
    dotenvLoader(), // @hl8/config 读取环境变量
  ],
});
```

### 本模块的缓存功能

本模块内置了**配置缓存机制**（CacheManager），用于缓存配置加载结果，提升性能。

**关键点**：

- ✅ 本模块的缓存是**配置缓存**（缓存 AppConfig 实例）
- ✅ 缓存实现**独立完成**，不依赖任何外部缓存库
- ✅ 对使用者**完全透明**，自动管理
- ❌ **与 `@hl8/caching` 模块无关**

### 与 @hl8/caching 的区别

| 模块             | 用途         | 缓存对象             | 使用方式   |
| ---------------- | ------------ | -------------------- | ---------- |
| **@hl8/config**  | 配置管理     | AppConfig 实例       | 自动、透明 |
| **@hl8/caching** | 业务数据缓存 | 用户数据、查询结果等 | 手动调用   |

**两者完全独立，互不依赖，职责不同！**

---

## ⚡ 特性

### 完全类型安全 ✅

- TypeScript 类型推断和自动补全
- 编译时类型检查
- 运行时类型验证

### 多格式支持 📦

- `.env` 环境变量
- `.json` JSON 配置
- `.yml/.yaml` YAML 配置
- 远程配置服务

### 强大的验证 🛡️

- 基于 `class-validator`
- 自定义验证规则
- 详细的错误信息

### 灵活的加载器 🔧

- File Loader - 文件加载
- Directory Loader - 目录批量加载（目录不存在时优雅处理）
- Remote Loader - 远程配置
- Dotenv Loader - 环境变量（智能 fallback）

### 变量扩展 🔄

- `${VAR}` 环境变量替换
- `${VAR:-DEFAULT}` 默认值语法
- 嵌套对象变量引用

### 缓存支持 💾

- **多种缓存策略** - 内存缓存、文件缓存
- **自动过期管理** - TTL（过期时间）支持
- **缓存统计** - 命中率、访问时间等统计信息
- **事件监听** - 缓存命中、未命中、过期等事件
- **完全透明** - 对使用者完全透明，自动管理

---

## 🚀 快速开始

### 安装

```bash
pnpm add @hl8/config
```

### 基础使用

```typescript
import { TypedConfigModule, fileLoader, dotenvLoader } from "@hl8/config";
import { Module, Injectable } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsString, IsNumber, ValidateNested } from "class-validator";

// 1. 定义配置类
export class DatabaseConfig {
  @IsString()
  host!: string;

  @IsNumber()
  @Type(() => Number)
  port!: number;
}

export class AppConfig {
  @ValidateNested()
  @Type(() => DatabaseConfig)
  database!: DatabaseConfig;
}

// 2. 配置模块
@Module({
  imports: [
    TypedConfigModule.forRoot({
      schema: AppConfig,
      load: [
        // 1. 配置文件（优先）
        fileLoader({ path: "./config/app.yml" }),
        // 2. 环境变量（作为 fallback）
        dotenvLoader({ separator: "__", ignoreEnvFile: true }),
      ],
    }),
  ],
})
export class AppModule {}

// 3. 使用配置 - 完全类型安全
@Injectable()
export class DatabaseService {
  constructor(private readonly config: AppConfig) {}

  connect() {
    // 完整的类型推断和自动补全 ✅
    console.log(`${this.config.database.host}:${this.config.database.port}`);
  }
}
```

---

## 📖 核心概念

### TypedConfigModule

核心配置模块，提供类型安全的配置管理。

```typescript
TypedConfigModule.forRoot({
  schema: RootConfig,        // 配置类型
  load: [...],               // 加载器列表
  validate: true,            // 启用验证
  cache: true,               // 启用缓存
})
```

### 配置加载顺序

配置加载器按顺序执行，**后面的配置会覆盖前面的**。推荐按照以下顺序加载：

```typescript
load: [
  // 1. 配置文件（优先）
  directoryLoader({ directory: "./config" }),
  // 2. 远程配置（如果需要）
  // remoteLoader('https://config-server.com/api/config'),
  // 3. 环境变量（作为 fallback）
  dotenvLoader({ separator: "__", ignoreEnvFile: true }),
];
```

**加载优先级**（从高到低）：

1. **配置文件**（JSON/YAML）- 优先加载，目录不存在时返回空对象
2. **远程配置源** - 如果配置了远程配置服务
3. **进程环境变量** - 作为最后的 fallback
4. **.env 文件** - 仅在无法获得其他配置源时使用

**重要提示**：

- 配置文件不存在时不会报错，会继续尝试其他配置源
- `.env` 文件不存在时静默忽略，不会影响应用启动

### 加载器 (Loaders)

#### fileLoader - 文件加载器

```typescript
fileLoader({
  path: "./config/app.yml", // 文件路径（可选）
  searchFrom: process.cwd(), // 搜索起始目录（可选）
  basename: "config", // 文件名基础名（可选）
  ignoreEnvironmentVariableSubstitution: false, // 是否忽略变量替换
});
```

**支持格式**：`.json`, `.yml`, `.yaml`

**使用场景**：

- 指定路径：`fileLoader({ path: "./config/app.yml" })`
- 自动查找：`fileLoader({ basename: "config" })` （会在搜索目录中查找 config.json、config.yml、config.yaml）

#### dotenvLoader - 环境变量加载器

```typescript
dotenvLoader({
  envFilePath: ".env", // .env 文件路径（可选）
  ignoreEnvFile: false, // 是否忽略 .env 文件（可选）
  ignoreEnvVars: false, // 是否忽略环境变量（可选）
  separator: "__", // 嵌套分隔符（默认 "__"）
  enableExpandVariables: true, // 启用变量扩展（默认 true）
  keyTransformer: (key) => key.toLowerCase(), // 键转换器（可选）
});
```

**加载策略**：

- `.env` 文件不存在时静默忽略，不会报错
- 推荐配置：优先使用配置文件，`.env` 文件作为最后的 fallback
- 如果 `ignoreEnvFile: true`，只使用进程环境变量，不加载 `.env` 文件

**变量扩展示例**：

```bash
DB_HOST=${HOST:-localhost}     # 默认值
DB_PORT=${PORT}                # 环境变量
```

#### remoteLoader - 远程配置加载器

```typescript
remoteLoader(
  "https://config-server.com/api/config", // URL（必需）
  {
    requestConfig: {
      method: "GET", // HTTP 方法（可选）
      headers: { Authorization: "Bearer token" }, // 请求头（可选）
      timeout: 5000, // 超时时间（可选）
    },
    type: "json", // 响应类型：json | yaml | yml（可选）
    mapResponse: (response) => response.data, // 响应映射函数（可选）
    shouldRetry: (response) => response.status !== 200, // 重试条件（可选）
    retries: 3, // 重试次数（可选，默认 3）
    retryInterval: 1000, // 重试间隔（毫秒，可选，默认 1000）
  },
);
```

**重要提示**：`remoteLoader` 的 URL 作为第一个参数，选项作为第二个参数。

#### directoryLoader - 目录批量加载器

```typescript
directoryLoader({
  directory: "./config", // 目录路径（必需）
  include: /\.(json|yml|yaml)$/, // 文件匹配模式（可选，默认匹配所有 .json/.yml/.yaml）
  ignoreEnvironmentVariableSubstitution: false, // 是否忽略变量替换（可选）
  disallowUndefinedEnvironmentVariables: true, // 是否不允许未定义的环境变量（可选，默认 true）
});
```

**重要提示**：

- 如果目录不存在，返回空对象而不是抛出错误
- 这样可以让其他配置源（如远程配置、环境变量）作为 fallback

---

## 🔧 高级功能

### 配置验证

**⚠️ 重要提示**：`@hl8/config` 并不知道使用者的配置需求，使用者必须自己定义验证规则。

```typescript
// 使用者定义的配置类和验证规则
import { IsString, IsNotEmpty, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class ServerConfig {
  @IsString() // 验证规则：必须是字符串（使用者定义）
  @IsNotEmpty() // 验证规则：不能为空（使用者定义）
  public readonly host!: string;

  @IsNumber() // 验证规则：必须是数字（使用者定义）
  @Min(1) // 验证规则：最小值 1（使用者定义）
  @Max(65535) // 验证规则：最大值 65535（使用者定义）
  @Type(() => Number) // 类型转换：字符串转数字
  public readonly port!: number;
}
```

**技术规范**：

- 使用 class-validator 装饰器定义验证规则
- 使用 class-transformer 装饰器进行类型转换
- 参考 [class-validator 官方文档](https://github.com/typestack/class-validator)

### 变量扩展

**配置文件** (`app.yml`):

```yaml
database:
  host: ${DB_HOST:-localhost}
  port: ${DB_PORT:-5432}
  url: postgres://${DB_HOST}:${DB_PORT}/mydb
```

**环境变量** (`.env`):

```bash
DB_HOST=prod-server
DB_PORT=5432
```

**结果**:

```typescript
config.database.host; // → 'prod-server'
config.database.port; // → 5432
config.database.url; // → 'postgres://prod-server:5432/mydb'
```

### 配置缓存

```typescript
TypedConfigModule.forRoot({
  schema: AppConfig,
  cache: {
    enabled: true,
    ttl: 3600, // 1小时
  },
});
```

### 异步配置加载

```typescript
TypedConfigModule.forRootAsync({
  schema: AppConfig,
  load: [
    fileLoader({ path: "./config/app.yml" }),
    remoteLoader("https://config-server.com/api/config", {
      requestConfig: {
        headers: { Authorization: "Bearer token" },
      },
    }),
  ],
});
```

---

## 📊 配置缓存

### 缓存机制

`@hl8/config` 内置了**配置缓存机制**（CacheManager），用于缓存配置加载和验证结果，提升性能。

#### 缓存工作流程

1. **配置加载** - 从文件系统、环境变量、远程服务加载配置
2. **配置验证** - 使用 class-validator 验证配置完整性
3. **缓存存储** - 将验证后的配置实例存储到缓存中
4. **缓存查询** - 后续请求直接从缓存获取配置，避免重复加载和验证

#### 缓存策略

| 策略       | 说明     | 适用场景               | 性能            |
| ---------- | -------- | ---------------------- | --------------- |
| **memory** | 内存缓存 | 开发环境、单进程应用   | ⚡⚡⚡ 最快     |
| **file**   | 文件缓存 | 需要跨进程共享、持久化 | ⚡⚡ 较快       |
| **none**   | 无缓存   | 配置频繁变化、调试环境 | ⚡ 每次重新加载 |

#### 缓存特性

- ✅ **自动过期** - 支持 TTL（Time To Live）自动过期
- ✅ **LRU 淘汰** - 内存缓存支持 LRU（最近最少使用）淘汰策略
- ✅ **缓存统计** - 提供命中率、访问时间等统计信息
- ✅ **事件监听** - 支持缓存命中、未命中、过期等事件监听
- ✅ **键前缀** - 支持缓存键前缀，避免键冲突
- ✅ **完全透明** - 对使用者完全透明，自动管理

### 使用场景

#### 1. 远程配置缓存

当使用远程配置服务时，缓存可以显著减少网络请求：

```typescript
TypedConfigModule.forRootAsync({
  schema: AppConfig,
  load: [remoteLoader("https://config-server.com/api/config")],
  cache: {
    enabled: true,
    strategy: "memory",
    ttl: 3600000, // 缓存1小时，减少网络请求
  },
});
```

**优势**：

- 减少网络请求，提升性能
- 降低远程配置服务负载
- 网络故障时仍可使用缓存配置

#### 2. 文件配置缓存

缓存文件配置的解析和验证结果：

```typescript
TypedConfigModule.forRoot({
  schema: AppConfig,
  load: [directoryLoader({ directory: "./config" })],
  cache: {
    enabled: true,
    strategy: "file", // 文件缓存，可跨进程共享
    cacheDir: "./cache",
    ttl: 1800000, // 30分钟
  },
});
```

**优势**：

- 避免重复解析 JSON/YAML 文件
- 避免重复验证配置
- 跨进程共享缓存

#### 3. 开发环境性能优化

在开发环境中使用内存缓存提升开发体验：

```typescript
TypedConfigModule.forRoot({
  schema: AppConfig,
  load: [fileLoader({ path: "./config/app.yml" })],
  cache: {
    enabled: process.env.NODE_ENV !== "development",
    strategy: "memory",
    ttl: 60000, // 开发环境：1分钟（快速刷新）
  },
});
```

**优势**：

- 开发时快速刷新配置
- 生产环境使用较长 TTL 提升性能

### 使用方法

#### 基础用法

```typescript
TypedConfigModule.forRoot({
  schema: AppConfig,
  cache: {
    enabled: true,
    strategy: "memory",
    ttl: 3600000, // 1小时
  },
});
```

#### 文件缓存

```typescript
TypedConfigModule.forRoot({
  schema: AppConfig,
  cache: {
    enabled: true,
    strategy: "file",
    cacheDir: "./cache", // 缓存目录
    ttl: 3600000,
  },
});
```

#### 禁用缓存

```typescript
TypedConfigModule.forRoot({
  schema: AppConfig,
  cache: {
    enabled: false, // 或 strategy: "none"
  },
});
```

#### 使用 CacheManager（高级用法）

如果需要手动管理缓存，可以注入 `CacheManager`：

```typescript
import { CacheManager } from "@hl8/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ConfigService {
  constructor(private readonly cacheManager: CacheManager) {}

  async clearCache() {
    // 清空所有缓存
    await this.cacheManager.clear();
  }

  async getCacheStats() {
    // 获取缓存统计信息
    return await this.cacheManager.getStats();
  }

  async invalidateConfig(key: string) {
    // 删除指定配置的缓存
    await this.cacheManager.delete(key);
  }
}
```

#### 缓存事件监听

```typescript
import { CacheManager } from "@hl8/config";

const cacheManager = new CacheManager({
  enabled: true,
  strategy: "memory",
});

// 监听缓存命中事件
cacheManager.on("hit", (event) => {
  console.log(`缓存命中: ${event.key}`);
});

// 监听缓存未命中事件
cacheManager.on("miss", (event) => {
  console.log(`缓存未命中: ${event.key}`);
});

// 监听缓存过期事件
cacheManager.on("expire", (event) => {
  console.log(`缓存过期: ${event.key}`);
});
```

### 缓存统计

```typescript
const stats = await cacheManager.getStats();

console.log(`缓存命中率: ${stats.hitRate}%`);
console.log(`总缓存条目: ${stats.totalEntries}`);
console.log(`缓存大小: ${stats.totalSize} bytes`);
console.log(`平均访问时间: ${stats.averageAccessTime} ms`);
console.log(`最常访问的键:`, stats.topKeys);
```

**统计信息说明**：

| 字段                | 说明                 |
| ------------------- | -------------------- |
| `totalEntries`      | 总缓存条目数         |
| `hits`              | 缓存命中次数         |
| `misses`            | 缓存未命中次数       |
| `hitRate`           | 缓存命中率（0-100）  |
| `totalSize`         | 总缓存大小（字节）   |
| `averageAccessTime` | 平均访问时间（毫秒） |
| `topKeys`           | 最常访问的键列表     |

### 注意事项

1. **内存缓存**：仅在进程内有效，进程重启后缓存丢失
2. **文件缓存**：需要确保缓存目录有读写权限
3. **TTL 设置**：根据配置更新频率合理设置 TTL
4. **缓存失效**：配置更新后需要手动清除缓存或等待 TTL 过期

---

## 📊 使用场景

### ✅ 适用场景

- NestJS 应用配置管理
- Node.js 应用配置加载
- 微服务配置中心
- 多环境配置管理
- 类型安全配置验证

### 🎯 核心优势

| 特性     | 传统方式       | @hl8/config        |
| -------- | -------------- | ------------------ |
| 类型安全 | ❌ any         | ✅ 完全类型        |
| 验证     | ❌ 手动        | ✅ class-validator |
| 环境变量 | ⚠️ process.env | ✅ 类型安全注入    |
| 多格式   | ❌ 手动解析    | ✅ 自动支持        |
| 变量扩展 | ❌ 不支持      | ✅ ${VAR} 语法     |

---

## 🧪 测试

本模块使用 Jest 进行测试。测试文件使用 `.spec.ts` 后缀，与源代码文件同目录。

**运行测试**：

```bash
# 运行所有测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test:cov

# 监听模式运行测试
pnpm test:watch
```

**测试文件位置**：

- 单元测试：`src/**/*.spec.ts`（与源代码同目录）
- 测试遵循就近原则，便于维护和理解

---

## 📦 依赖要求

- **Node.js**: >= 20
- **TypeScript**: >= 5.9
- **NestJS**: >= 11

---

## 📚 文档

- [📖 完整使用指南](./docs/使用指南.md) - 详细的培训教程，包含所有功能说明和实际案例
- [项目源码](../../../)
- [NestJS 官方文档](https://docs.nestjs.com/)
- [class-validator 文档](https://github.com/typestack/class-validator)

---

## 📝 许可证

MIT

---

**独立、通用、类型安全的配置管理解决方案！** 🎯
