# 后端项目 ESLint 配置指南

## 概述

本文档基于当前 `hl8-aisaas-platform` monorepo 的实际配置，汇总 TypeScript 项目在 ESLint 上的统一约束、规则策略与使用方式，确保所有代码符合《项目章程》中的中文注释与严格类型要求。

## 配置总览

- **根配置入口**：仓库根目录 `eslint.config.mjs`
- **共享基础配置**：`packages/eslint-config/eslint-base.config.mjs`
- **工具链版本**：
  - `eslint@9.39.1`
  - `@eslint/js` 官方推荐规则
  - `typescript-eslint@8.46.3`
  - `eslint-plugin-prettier/recommended`（保证格式化与 lint 统一）
- **执行方式**：
  - 全量检查：`pnpm lint`（Turbo 任务）
  - 选择性检查：`pnpm --filter <package> lint` 或直接运行 `eslint`
  - 提交前检查：`lint-staged` 针对 `*.ts` 自动运行 ESLint `--fix`

## 配置结构

### 1. 基础规则（`packages/eslint-config/eslint-base.config.mjs`）

```mjs
import eslint from "@eslint/js";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import tsEslint from "typescript-eslint";

export default tsEslint.config(eslint.configs.recommended, ...tsEslint.configs.recommended, prettierRecommended, {
  ignores: [".*.?(c|m)js", "*.setup*.?(c|m)js", "*.config*.?(c|m)js", "*.d.ts", ".turbo/", ".git/", "build/", "dist/", "coverage/", "node_modules/"],
});
```

核心要求：

- 默认启用 ESLint 官方推荐规则与 TypeScript-ESLint 推荐规则。
- 全局集成 Prettier 推荐配置，防止格式化与 lint 规则冲突。
- 预置忽略列表，避免对产物与配置文件重复检查。

### 2. 根级扩展（`eslint.config.mjs`）

```mjs
export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    ignores: [],
    rules: {
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "prefer-const": "off",
      "no-console": "off",
    },
  },
];
```

重点说明：

- `projectService: true` 让 TypeScript-ESLint 自动感知各包 `tsconfig.json`，避免手动声明 `project`。
- 生产代码禁止 `any`，测试文件允许更宽松的类型与调试语句。
- 参数、变量、捕获异常名前缀 `_` 时忽略未使用警告，便于表达占位逻辑。

## 使用要点

- **注释语言**：所有 ESLint 相关注释（如 `// eslint-disable-next-line`）同样必须使用中文说明原因。
- **配置扩展**：如需在子包追加自定义规则，推荐在本地创建 `eslint.config.mjs` 并引用根配置：

```mjs
import rootConfig from "../../eslint.config.mjs";

export default [
  ...rootConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      // 新增或覆盖规则
    },
  },
];
```

- **自动修复**：允许在安全情况下使用 `eslint --fix`，但需审查修复结果，确保未破坏业务逻辑。
- **配合 Prettier**：避免单独运行 Prettier；使用 `pnpm format` 或 IDE 集成统一格式化。

## 场景策略

- **单测 / 集成测试**：规则宽松，仅保留基础语法校验，鼓励快速编写测试。
- **脚本与工具**：如需 lint `.cjs`/`.mjs` 文件，可在工具目录新增局部配置或在根配置 `ignores` 中删除对应项。
- **第三方类型**：遇到 DefinitelyTyped 或库类型限制时，可通过局部 `// eslint-disable-next-line`（附中文说明）临时豁免。

## 常见问题与排查

| 问题                                                                      | 可能原因                            | 解决方案                                                           |
| ------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `Parsing error: Cannot find module 'typescript'`                          | 未安装全局 TypeScript               | 依赖通过 pnpm/workspace 提供，确保在工作区根执行 `pnpm install`    |
| `ESLint was configured to run on <tsconfig> but that file does not exist` | 子包缺少 `tsconfig.json` 或路径错误 | 确保每个包具备正确的 `tsconfig.json`，且位于仓库根目录下的继承链内 |
| `@typescript-eslint/no-explicit-any` 报错                                 | 代码使用 `any`                      | 以更具体类型替换，或在测试环境下书写                               |
| 格式与 ESLint 互相覆盖                                                    | 未启用 Prettier 推荐配置            | 确保规则保持当前状态或在局部配置继续引用 `prettierRecommended`     |

## 合规提醒

- 代码评审需确认是否存在 `any`、未使用变量、未遵循中文注释要求等违规情况。
- 更新或新增 ESLint 规则时，需同步更新本指南及相关模板。
- 任何 `eslint-disable` 类注释必须附中文理由，并限制在最小作用域内。

## 执行指引

1. 安装依赖：`pnpm install`
2. 全仓检查：`pnpm lint`
3. 单包检查：`pnpm --filter libs/infra/logger lint`
4. 自动修复：`pnpm lint -- --fix`
5. 提交前：依托 `lint-staged` 自动运行，无需额外配置

---

遵循上述约定可确保 ESLint 与 TypeScript、Prettier 无缝协作，统一团队编码风格并满足项目章程对类型安全与中文注释的要求。后续若调整规则或升级依赖，请立即更新本文档并通知团队。\*\*\*
