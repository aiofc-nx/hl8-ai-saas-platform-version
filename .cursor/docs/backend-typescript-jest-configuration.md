# 后端项目 TypeScript 和 Jest 配置文档

## 概述

本文档详细阐述了 hl8-platform monorepo 后端项目的 TypeScript 配置和 Jest 测试配置，涵盖配置策略、使用方式、最佳实践和常见问题。

## 文档结构

- [TypeScript 配置](#typescript-配置)
- [Jest 测试配置](#jest-测试配置)
- [配置集成](#配置集成)
- [测试文件组织](#测试文件组织)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

## TypeScript 配置

### 配置继承体系

#### 1. 基础配置

所有后端项目的基础配置继承自monorepo根目录下的 `tsconfig.json`，包含：

- ✅ **ESM 支持**: `module: "NodeNext"`, `moduleResolution: "NodeNext"`
- ✅ **严格类型检查**: `strict: true`
- ✅ **声明文件生成**: `declaration: true`, `declarationMap: true`
- ✅ **ES2022 目标**: `target: "ES2022"`
- ✅ **索引访问安全**: `noUncheckedIndexedAccess: true`

#### 3. 项目配置

后端项目通过 `extends` 继承根目录下的 `tsconfig.json` 配置，只覆盖项目特定的选项：

```json
// apps/fastify-api/tsconfig.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strictPropertyInitialization": false,
    "outDir": "./dist",
    "baseUrl": "./",
    "strict": false,
    "useDefineForClassFields": false
  }
}
```

### 核心配置选项说明

#### 模块系统配置

```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
  "moduleDetection": "force"
}
```

- **module: "NodeNext"**: 使用 Node.js 原生的 ES 模块系统
- **moduleResolution: "NodeNext"**: 遵循 Node.js 的模块解析规则，支持 package.json 的 "exports" 字段
- **moduleDetection: "force"**: 强制将所有文件识别为模块

#### 装饰器配置

```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

- **experimentalDecorators**: 启用装饰器语法（NestJS 核心特性）
- **emitDecoratorMetadata**: 为装饰器生成运行时元数据，支持依赖注入

#### 类型检查配置

```json
{
  "strict": true,
  "strictNullChecks": false,
  "noImplicitAny": false,
  "noUncheckedIndexedAccess": true
}
```

- **strict: true**: 启用所有严格类型检查（base.json 中）
- **strictNullChecks: false**: NestJS 依赖注入需要放宽
- **noImplicitAny: false**: 允许隐式 any 类型
- **noUncheckedIndexedAccess: true**: 索引访问返回类型包含 undefined

### 配置分离策略

项目采用 `tsconfig.build.json` 分离开发和生产配置：

```json
// tsconfig.json - 开发配置
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "incremental": true
  },
  "include": ["src", "src/**/*.spec.ts"]
}

// tsconfig.build.json - 构建配置
{
  "extends": "./tsconfig.json",
  "exclude": ["**/*.spec.ts", "test", "node_modules"]
}
```

**优势**：

- 开发时包含测试文件，IDE 提供完整类型检查
- 构建时排除测试文件，减少编译时间
- 配置清晰易维护

## Jest 测试配置

### 配置架构

Jest 测试配置采用三层次配置：

1. **全局设置** (`jest.setup.js`): 根目录的全局测试配置
2. **项目配置** (`jest.config.ts`): 每个项目的 Jest 配置
3. **测试文件**: 单元测试、集成测试、E2E 测试

### 全局配置 (jest.setup.js)

所有项目的全局测试配置位于根目录：

```javascript
// jest.setup.js
jest.setTimeout(10000); // 测试超时时间

// 确保 jest 在全局范围内可用
if (typeof global.jest === "undefined") {
  global.jest = jest;
}

// 全局测试配置
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
```

**作用**：

- 统一的测试超时时间（10 秒）
- 禁用测试中的 console 输出（避免干扰）
- 确保 jest 全局可用

### 项目级 Jest 配置

#### 基础设施库配置

```typescript
// libs/infra/config/jest.config.ts
export default {
  displayName: "config",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: ".",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1", // ES 模块路径映射
    "^@/(.*)$": "<rootDir>/src/$1", // 路径别名
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js"],
  coverageDirectory: "../../coverage/libs/config",
  testMatch: ["**/*.spec.ts"],
  setupFilesAfterEnv: ["<rootDir>/../../../jest.setup.js"],
};
```

#### 应用级配置

```typescript
// apps/fastify-api/jest.config.ts
export default {
  collectCoverageFrom: ["src/**/*.(t|j)s", "!src/**/*.spec.ts", "!src/**/*.test.ts"],
  coverageDirectory: "../coverage",
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts", "../test/integration/**/*.spec.ts", "../test/e2e/**/*.spec.ts"],
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          moduleResolution: "NodeNext",
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // Monorepo 工作区映射
    "^@hl8/(.*)$": "/path/to/libs/$1/dist/index.js",
  },
};
```

### 核心配置选项说明

#### preset 配置

```typescript
preset: "ts-jest/presets/default-esm";
```

- 使用 `default-esm` preset 支持 ES 模块
- 自动配置 TypeScript 转换

#### 环境配置

```typescript
testEnvironment: "node"; // Node.js 环境
extensionsToTreatAsEsm: [".ts"]; // 将 .ts 文件视为 ES 模块
```

#### 模块路径映射

```typescript
moduleNameMapper: {
  "^(\\.{1,2}/.*)\\.js$": "$1",      // ES 模块导入路径
  "^@/(.*)$": "<rootDir>/src/$1",    // 路径别名
  "^@hl8/(.*)$": "..."               // Monorepo 包映射
}
```

**关键点**：

- ES 模块导入需要 `.js` 扩展名，但 Jest 需要映射回源文件
- 支持 TypeScript 路径别名
- Monorepo 包映射到构建产物

#### Transform 配置

```typescript
transform: {
  "^.+\\.ts$": [
    "ts-jest",
    {
      useESM: true,
      tsconfig: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
    },
  ],
}
```

- **useESM: true**: 使用 ES 模块
- **tsconfig**: 传递给 TypeScript 编译器的选项
- 保持与项目 TypeScript 配置一致

#### 测试文件匹配

```typescript
testMatch: [
  "**/*.spec.ts", // 单元测试
  "../test/integration/**/*.spec.ts", // 集成测试
  "../test/e2e/**/*.spec.ts", // E2E 测试
];
```

#### 覆盖率配置

```typescript
collectCoverageFrom: [
  "src/**/*.(t|j)s",
  "!src/**/*.spec.ts",  // 排除测试文件
  "!src/**/*.test.ts"
],
coverageDirectory: "../coverage"
```

## 配置集成

### TypeScript + Jest 集成

确保 Jest 配置与 TypeScript 配置兼容：

```typescript
// jest.config.ts
transform: {
  "^.+\\.ts$": [
    "ts-jest",
    {
      useESM: true,
      tsconfig: {
        // 与 tsconfig.json 保持一致
        module: "NodeNext",
        moduleResolution: "NodeNext",
        // 测试环境可能需要放宽某些选项
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  ],
}
```

### NODE_OPTIONS 配置

运行 Jest 测试时需要使用 `--experimental-vm-modules` 标志：

```json
// package.json
{
  "scripts": {
    "test": "NODE_OPTIONS=--experimental-vm-modules jest",
    "test:cov": "NODE_OPTIONS=--experimental-vm-modules jest --coverage",
    "test:watch": "NODE_OPTIONS=--experimental-vm-modules jest --watch"
  }
}
```

**原因**：Jest 需要这个标志来支持 ES 模块的动态导入。

## 测试文件组织

### 分层测试架构

项目遵循分层测试架构：

```
项目根目录/
├── src/                    # 源代码
│   ├── *.ts
│   └── *.spec.ts          # 单元测试（就近原则）
├── test/                   # 测试目录（src 外）
│   ├── integration/       # 集成测试
│   │   └── **/*.spec.ts
│   └── e2e/               # 端到端测试
│       └── **/*.spec.ts
└── coverage/              # 测试覆盖率报告
```

### 单元测试

- **位置**: 与被测试文件同一目录
- **命名**: `{被测试文件名}.spec.ts`
- **作用**: 测试单个函数、类或模块

```typescript
// src/lib/config-loader.spec.ts
import { ConfigLoader } from "./config-loader";

describe("ConfigLoader", () => {
  it("should load configuration from file", () => {
    // 测试逻辑
  });
});
```

### 集成测试

- **位置**: `test/integration/`
- **命名**: `*.spec.ts`
- **作用**: 测试多个模块的协作

### 端到端测试

- **位置**: `test/e2e/`
- **命名**: `*.spec.ts`
- **作用**: 测试完整的业务流程

## 最佳实践

### TypeScript 配置

#### 1. 避免重复配置

❌ **错误示例**：

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "experimentalDecorators": true, // ❌ 已在 nestjs.json 中定义
    "emitDecoratorMetadata": true // ❌ 已在 nestjs.json 中定义
  }
}
```

✅ **正确示例**：

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "baseUrl": "."
  }
}
```

#### 2. 使用配置分离

- `tsconfig.json`: 开发配置，包含测试文件
- `tsconfig.build.json`: 构建配置，排除测试文件

#### 3. 合理使用 include/exclude

```json
{
  "include": ["src", "src/**/*.spec.ts"],
  "exclude": ["node_modules", "dist", "**/*.js"]
}
```

### Jest 配置

#### 1. 保持 TypeScript 配置一致

Jest 的 tsconfig 选项应与项目的 tsconfig.json 保持一致：

```typescript
transform: {
  "^.+\\.ts$": [
    "ts-jest",
    {
      useESM: true,
      tsconfig: {
        // 与 tsconfig.json 保持一致
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
    },
  ],
}
```

#### 2. 正确的模块路径映射

```typescript
moduleNameMapper: {
  // ES 模块路径映射（必需）
  "^(\\.{1,2}/.*)\\.js$": "$1",

  // 路径别名
  "^@/(.*)$": "<rootDir>/src/$1",

  // Monorepo 包映射
  "^@hl8/(.*)$": "<rootDir>/../../libs/$1/dist/index.js"
}
```

#### 3. 合理设置覆盖率收集

```typescript
collectCoverageFrom: [
  "src/**/*.ts",
  "!src/**/*.spec.ts", // 排除测试文件
  "!src/**/*.interface.ts", // 排除接口定义
  "!src/**/*.dto.ts", // 排除 DTO
];
```

### 测试编写

#### 1. 使用 describe 组织测试

```typescript
describe("ClassName", () => {
  describe("methodName", () => {
    it("should do something", () => {
      // 测试逻辑
    });
  });
});
```

#### 2. 使用 beforeEach/afterEach

```typescript
describe("Service", () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
  });

  afterEach(() => {
    // 清理
  });
});
```

#### 3. 测试异步代码

```typescript
it("should handle async operations", async () => {
  const result = await service.asyncMethod();
  expect(result).toBeDefined();
});
```

## 常见问题

### TypeScript 问题

#### 1. 装饰器不生效

**问题**: NestJS 装饰器报错或无效

**解决方案**:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

#### 2. 模块导入错误

**问题**: `Cannot find module` 错误

**解决方案**:

- 确保使用 `.js` 扩展名导入
- 检查 `moduleResolution` 设置
- 配置 `paths` 别名

#### 3. 严格类型检查问题

**问题**: `strict` 模式报错过多

**解决方案**:

```json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false
  }
}
```

### Jest 问题

#### 1. ES 模块导入错误

**问题**: `SyntaxError: Cannot use import statement outside a module`

**解决方案**:

- 使用 `NODE_OPTIONS=--experimental-vm-modules jest`
- 配置 `extensionsToTreatAsEsm: [".ts"]`
- 使用 `preset: "ts-jest/presets/default-esm"`

#### 2. 路径映射不生效

**问题**: 模块路径别名不工作

**解决方案**:

```typescript
moduleNameMapper: {
  "^@/(.*)$": "<rootDir>/src/$1"
}
```

#### 3. Monorepo 包导入失败

**问题**: 无法导入 monorepo 中的其他包

**解决方案**:

```typescript
moduleNameMapper: {
  "^@hl8/(.*)$": "<rootDir>/../../libs/$1/dist/index.js"
}
```

#### 4. 装饰器在测试中失效

**问题**: 装饰器在测试中报错

**解决方案**:

```typescript
transform: {
  "^.+\\.ts$": [
    "ts-jest",
    {
      useESM: true,
      tsconfig: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true
      }
    }
  ]
}
```

### 性能问题

#### 1. 测试运行缓慢

**解决方案**:

- 启用 Jest 缓存
- 使用 `--maxWorkers` 并行运行
- 优化模块路径映射

#### 2. 增量编译缓慢

**解决方案**:

```json
{
  "compilerOptions": {
    "incremental": true
  }
}
```

## 配置检查清单

创建新后端项目时，确保以下配置正确：

### TypeScript 配置

- [ ] 继承 `@repo/typescript-config/nestjs.json`
- [ ] 使用 `tsconfig.build.json` 分离配置
- [ ] 不重复定义已在 monorepo 根目录下的 `tsconfig.json` 中的选项
- [ ] 正确配置 `include` 和 `exclude`
- [ ] 配置 `outDir` 和 `baseUrl`

### Jest 配置

- [ ] 使用 `ts-jest/presets/default-esm` preset
- [ ] 配置 `extensionsToTreatAsEsm: [".ts"]`
- [ ] 配置正确的 `moduleNameMapper`
- [ ] 配置 `setupFilesAfterEnv` 指向全局设置
- [ ] 配置 `transform` 与 TypeScript 配置一致
- [ ] 配置 `testMatch` 匹配测试文件

### package.json 脚本

- [ ] 使用 `NODE_OPTIONS=--experimental-vm-modules jest`
- [ ] 配置 `test`, `test:watch`, `test:cov` 脚本

## 总结

本文档阐述了后端项目的 TypeScript 和 Jest 配置体系：

1. **配置继承**: 通过继承统一的配置包确保一致性
2. **ES 模块支持**: 全面使用 ES 模块系统
3. **类型安全**: 启用严格类型检查（根据需要放宽）
4. **测试支持**: Jest 配置与 TypeScript 配置保持一致
5. **最佳实践**: 遵循配置分离、避免重复、保持一致性

通过遵循本文档的指导，可以确保后端项目的配置正确、高效且易于维护。
