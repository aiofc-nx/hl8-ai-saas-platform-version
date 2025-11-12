# @hl8/mikro-orm-nestjs 与官方 @mikro-orm/nestjs 差异说明

## 背景概述

- 本地模块 `@hl8/mikro-orm-nestjs` 基于官方 `@mikro-orm/nestjs` 二次开发，目标是在 HL8 平台内平替官方实现。
- 改造重点围绕多租户场景、平台日志观测、配置体系、中文文档规范以及 NodeNext/ESM 构建要求。

## 核心改动对比

### 1. 平台依赖与构建流程

- `package.json` 切换为 `type: "module"`，脚本与输出目录遵循工作区约定，去掉官方仓库的 `rm -rf dist` 等脚本。
- 依赖项新增 `@hl8/config`、`@hl8/logger`、`@hl8/exceptions`，统一使用内部工具链；官方包仅声明 Nest/MikroORM 通用 peer dependency。
- 构建命令简化为 `tsc -p tsconfig.build.json`，并提供 `lint`, `format`, `type-check` 等工具脚本以匹配 monorepo DevOps 流程。

### 2. 请求上下文中间件

- 本地 `MikroOrmMiddleware` 不再直接注入默认 `MikroORM` 实例，而是通过 `ModuleRef` + `contextName` 惰性解析对应 Token，解决多上下文场景下的 DI 错误。
- 异常信息、日志全部输出中文，并在解析失败时提示上下文名；官方实现仅支持默认 Token，且报错信息为英文。

### 3. 日志与可观测性

- `createMikroOrmProvider` 注入平台日志服务，将 MikroORM 内部调试日志转为 `@hl8/logger` 调用，统一字段与格式。
- 官方版本通过 Nest `Logger` 输出简单文本，缺乏上下文扩展与集中化能力。

### 4. 配置封装体系

- 新增 `libs/infra/mikro-orm-nestjs/src/config/` 下的配置类（Postgres/Mongo/Base），结合 `class-validator` + `class-transformer` 自动生成上下文配置，满足平台「配置模块使用规范」。
- 官方仓库无配置抽象，使用者需自行编写 `forRoot` 传参或依赖 CLI 配置。

### 5. 文档与注释本地化

- README、源码注释、错误消息全部改写为中文并遵循 TSDoc 规范，符合仓库宪法。
- 官方 README/注释保持英文描述，面向通用社区场景。

### 6. 测试与工具增强

- 本地仓库在 `src/lib` 目录下补充多份 `*.spec.ts` 单元测试，覆盖请求中间件、实体存储、工具函数等。
- 官方仓库主要在 `tests/` 目录下提供示例集成测试，核心模块单测较少。

### 7. 兼容性与导出

- 导出接口保持与官方模块一致（`MikroOrmModule`、`MikroOrmMiddleware` 等），确保替换后业务侧 API 无需改动。
- 同步维护 `CONTEXT_NAMES`、多上下文中间件等机制，只是在注入、配置、文档层面做平台化增强。

## 使用建议

- 在 HL8 平台内开发新服务时统一引入 `@hl8/mikro-orm-nestjs`，配合配置模块与日志模块使用，避免混用官方包。
- 若需对比官方实现，可参考 `forks/mikro-orm-nestjs` 目录获取最新源码；所有平台定制改动需同步更新本报告与 README。

## 后续维护事项

- 当官方 `@mikro-orm/nestjs` 发布重大版本时，应定期对照 `forks/` 源码评估差异，并验证本地增强是否仍然适配。
- 如新增平台特性（例如审计日志、事件追踪），需在本模块中统一嵌入实现，并完善中文文档/测试。
