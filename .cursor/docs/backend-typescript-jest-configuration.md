# 后端项目 TypeScript 与 Jest 配置指南

## 概述

本文档根据当前 `hl8-aisaas-platform` 仓库的实际配置，总结后端项目在 TypeScript 与 Jest 上的统一约定、关键参数、最佳实践与排障方法。所有后续项目与库的配置均应以此为准，确保章程合规与运行一致性。

## 文档结构

- [TypeScript 配置](#typescript-配置)
  - 基础配置
  - 子包配置
  - 构建配置分离
- [Jest 测试配置](#jest-测试配置)
  - 全局 Jest 配置
  - 子包级 Jest 配置
  - 运行与调试
- [测试文件组织](#测试文件组织)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)
- [配置检查清单](#配置检查清单)

## TypeScript 配置

### 基础配置（根目录 `tsconfig.json`）

仓库根目录维持唯一的基础配置，所有后端包通过 `extends` 继承。关键选项如下：

- **模块系统**
  - `module: "NodeNext"`
  - `moduleResolution: "NodeNext"`
  - `target: "ES2022"` 与 `lib: ["ES2022"]`
- **类型安全**
  - `strict: true`，`strictNullChecks: true`，`noImplicitAny: true`
  - `strictBindCallApply: true`，`noFallthroughCasesInSwitch: true`
- **装饰器支持**
  - `experimentalDecorators: true`
  - `emitDecoratorMetadata: true`
- **ESM 互操作**
  - `esModuleInterop: true`，`allowSyntheticDefaultImports: true`
- **构建体验**
  - `useDefineForClassFields: true`
  - `incremental: true`，`skipLibCheck: false`
  - `removeComments: true`，`sourceMap: true`
- **路径别名**
  - `baseUrl: "."`
  - 提供 `@hl8/*` 别名，对应 `libs/infra/*`、`libs/domains/*`、`libs/modules/*` 等源代码路径

> **注意**：根配置未开启 `declaration`，如需生成类型声明，应在具体包的构建配置中自行开启。

### 子包配置（示例：`libs/infra/logger/tsconfig.json`）

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "esModuleInterop": true,
    "incremental": false,
    "baseUrl": ".",
    "outDir": "./dist",
    "isolatedModules": true
  },
  "include": ["src", "src/**/*.spec.ts", "src/**/*.test.ts", "test"],
  "exclude": ["node_modules", "dist"]
}
```

要点：

- 仅在必要时覆盖根配置，例如调整 `allowJs`、关闭增量编译或指定 `outDir`。
- `isolatedModules: true` 确保与 `ts-jest` NodeNext 诊断兼容，避免 `TS151002`。
- `include` 必须显式纳入单元测试文件（就近原则）。
- `exclude` 坚持排除 `node_modules`、`dist` 及其他产物目录。

### 构建配置分离

所有库通过 `tsconfig.build.json` 与开发配置分离：

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "**/*.spec.ts", "__tests__"]
}
```

- 构建时屏蔽测试文件，确保产物纯净。
- 开发时仍由 `tsconfig.json` 提供完整类型检查。
- 若需要生成声明文件，可在 `tsconfig.build.json` 中补充 `declaration: true` 与 `emitDeclarationOnly: true`。

## Jest 测试配置

### 全局配置（根目录 `jest.config.ts` 与 `jest.setup.js`）

```typescript
import path from "node:path";
import type { Config } from "jest";

const workspaceRoot = path.resolve();
const libsRoot = path.join(workspaceRoot, "libs");

const config: Config = {
  displayName: "workspace",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: workspaceRoot,
  extensionsToTreatAsEsm: [".ts"],
  testMatch: ["**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: path.resolve(workspaceRoot, "tsconfig.base.json"),
        diagnostics: {
          warnOnly: true,
          ignoreCodes: [151002],
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@hl8/logger$": path.resolve(libsRoot, "infra/logger/src/index.ts"),
    "^@hl8/exceptions$": path.resolve(libsRoot, "infra/exceptions/src/index.ts"),
    "^@hl8/config$": path.resolve(libsRoot, "infra/config/src/index.ts"),
    "^@hl8/cache$": path.resolve(libsRoot, "infra/cache/src/index.ts"),
    "^@hl8/bootstrap$": path.resolve(libsRoot, "infra/bootstrap/src/index.ts"),
    "^@hl8/async-storage$": path.resolve(libsRoot, "infra/async-storage/src/index.ts"),
    "^@hl8/multi-tenancy$": path.resolve(libsRoot, "infra/multi-tenancy/src/index.ts"),
    "^@hl8/persistence$": path.resolve(libsRoot, "infra/persistence/src/index.ts"),
    "^@hl8/persistence-postgres$": path.resolve(libsRoot, "infra/persistence/postgres/src/index.ts"),
    "^@hl8/persistence-mongo$": path.resolve(libsRoot, "infra/persistence/mongo/src/index.ts"),
    "^@hl8/user$": path.resolve(libsRoot, "domains/user/src/index.ts"),
    "^@hl8/auth$": path.resolve(libsRoot, "domains/auth/src/index.ts"),
  },
  moduleFileExtensions: ["ts", "js"],
  setupFilesAfterEnv: [path.resolve(workspaceRoot, "jest.setup.js")],
  transformIgnorePatterns: ["node_modules/(?!(@hl8|ioredis|class-transformer|class-validator)/)"],
};

export default config;
```

```javascript
require("reflect-metadata");

jest.setTimeout(10000);

if (typeof global.jest === "undefined") {
  global.jest = jest;
}

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
```

核心说明：

- 统一启用 `ts-jest/presets/default-esm` 处理 ES 模块。
- 通过 `moduleNameMapper` 映射所有内置包，确保测试直接引用源码。
- `transformIgnorePatterns` 仅允许必要的第三方包经过转换。
- 全局 setup 注入 `reflect-metadata` 并屏蔽默认 console 输出。

> **提示**：`tsconfig.base.json` 用于 Jest 转换器，可在存在差异时覆盖测试专用编译选项；若缺失请及时补充。

### 子包级配置（示例：`libs/infra/cache/jest.config.ts`）

```typescript
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.resolve(process.cwd(), "package.json"));

export default {
  displayName: "@hl8/cache",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: ".",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@anchan828/nest-redlock$": "<rootDir>/src/testing/redlock.mock.ts",
    "^@anchan828/nest-redlock/dist/cjs/redlock.service.js$": "<rootDir>/src/testing/redlock.mock.ts",
  },
  transformIgnorePatterns: ["node_modules/(?!(@anchan828/nest-redlock|redlock)/)"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
        },
        diagnostics: {
          warnOnly: true,
          ignoreCodes: [151002],
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js"],
  coverageDirectory: "../../coverage/libs/cache",
  testMatch: ["**/*.spec.ts"],
  setupFilesAfterEnv: ["<rootDir>/../../../jest.setup.js"],
  passWithNoTests: true,
};
```

遵循原则：

- 显式映射 `.js` 结尾的相对路径，保证 ES 模块兼容。
- 只在必要时新增第三方包映射或转换规则。
- 复用根级 `jest.setup.js`，保持全局测试体验一致。

### 运行与调试

- **脚本入口**：根目录通过 Turbo 任务执行测试，命令为 `pnpm test`（实际执行 `turbo test`）。各子包可直接运行 `pnpm --filter <package> test`，调用本地 `jest.config.ts`。
- **环境变量**：当前脚本未显式设置 `NODE_OPTIONS=--experimental-vm-modules`，Jest 30 + `ts-jest` 已原生兼容 ES 模块。如需在独立运行时遇到问题，可在命令前手动追加该变量。
- **无测试包处理**：部分基础设施包暂未编写单测，`package.json` 中的 `test`/`test:watch`/`test:cov` 脚本追加 `--passWithNoTests`，并在对应 `jest.config.*` 内设置 `passWithNoTests: true`，避免 Turbo 流程因缺少匹配用例而失败。
- **覆盖率**：子包若需要覆盖率统计，可在包级 `jest.config.ts` 中设置 `collectCoverageFrom` 与 `coverageDirectory`。根配置未强制输出全局覆盖率。

## 测试文件组织

### 目录结构

```
<package>/
├── src/
│   ├── *.ts
│   └── *.spec.ts          // 单元测试（就近原则，命名 {filename}.spec.ts）
├── test/
│   ├── integration/       // 集成测试
│   │   └── **/*.spec.ts
│   └── e2e/               // 端到端测试
│       └── **/*.spec.ts
└── coverage/              // 可选：覆盖率报告输出目录
```

- 单元测试必须与源码文件同目录，命名 `{被测文件名}.spec.ts`。
- 集成与端到端测试统一放置在包外层的 `test/` 目录，命名 `*.spec.ts`。
- 遵循《项目章程》测试覆盖率要求：核心逻辑 ≥ 80%，关键路径 ≥ 90%，公共 API 必须编写测试。

## 最佳实践

### TypeScript

- **最小覆盖原则**：子包禁止重复声明根配置已存在的选项，只在确有差异时覆盖。
- **路径别名复用**：如需新增别名，请同时更新根 `tsconfig.json` 与 `jest.config.ts`，保持编译与测试一致。
- **构建产物隔离**：确保所有产物写入 `dist/`，并在 `package.json` 的 `exports` 中指向编译结果。

### Jest

- **保持与 TS 配置一致**：若变更模块系统或目标版本，需同步更新 `ts-jest` 的 `tsconfig` 选项。
- **合理 mock**：对外部依赖或第三方库，通过 `moduleNameMapper` 或 `__mocks__` 目录集中管理。
- **禁用多余输出**：如需在测试中调试，可在用例内部临时恢复 `console`，测试结束后需要手动还原。

### 测试编写

- 使用 `describe` 结构化推理路径，`beforeEach/afterEach` 管理环境。
- 对异步行为使用 `async/await` 与超时断言。
- 针对异常流程使用 `expect(asyncFn).rejects.toThrowError(...)` 明确断言。

## 常见问题

### TypeScript

- **找不到模块**：确认是否遗漏 `.js` 后缀，或忘记同步更新 `tsconfig.json` 与 `jest.config.ts` 的别名。
- **装饰器报错**：检查子包是否继承了根配置的 `experimentalDecorators` 与 `emitDecoratorMetadata`。
- **类型收紧导致报错**：如确需放宽，可在局部通过泛型约束或类型断言解决，不建议修改全局 `strict`。

### Jest

- **ESM 导入异常**：确认 `preset: "ts-jest/presets/default-esm"` 与 `extensionsToTreatAsEsm: [".ts"]` 均已配置；必要时添加 `NODE_OPTIONS=--experimental-vm-modules`。
- **路径映射失效**：确保 `moduleNameMapper` 中的路径与实际文件结构一致，避免漏写 `src` 或 `dist`。
- **第三方包未转换**：将需要转译的包加入 `transformIgnorePatterns` 的白名单。
- **console 输出被隐藏**：如需调试，可在测试用例中临时调用 `jest.spyOn(console, "log").mockImplementation(console.log)`。

## 配置检查清单

### TypeScript

- [ ] 子包 `tsconfig.json` 已继承根配置并仅覆盖必要选项。
- [ ] `include` 包含单元测试文件，`exclude` 排除产物与依赖。
- [ ] 构建配置通过 `tsconfig.build.json` 排除测试文件。
- [ ] 新增路径别名时同步更新根级 `tsconfig.json` 与 Jest 映射。

### Jest

- [ ] 使用 `ts-jest/presets/default-esm` 并启用 `useESM: true`。
- [ ] `moduleNameMapper` 正确映射相对路径 `.js` 后缀与 `@hl8/*` 别名。
- [ ] `setupFilesAfterEnv` 指向根目录 `jest.setup.js`。
- [ ] 单元测试 `testMatch` 仅匹配 `{filename}.spec.ts`，集成测试存放于 `test/integration/`。
- [ ] 必要的第三方包已加入 `transformIgnorePatterns` 白名单。

### 执行命令

- [ ] 使用 `pnpm test` 触发 Turbo 管道，按包并行执行。
- [ ] 需要覆盖率时在对应包内配置 `collectCoverageFrom` 与 `coverageDirectory`。
- [ ] 遇到 ES 模块执行问题时，考虑临时追加 `NODE_OPTIONS=--experimental-vm-modules`。

---

遵循以上约定，可确保所有后端模块在类型安全、测试执行与运行时行为上保持一致，并满足《项目章程》对于技术栈、测试策略和模块规范的要求。若配置发生变更，应同步更新本文档及相关模板，确保团队成员能够快速获取最新指导。
