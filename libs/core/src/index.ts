/**
 * @zh
 * @description 核心领域导出入口，统一暴露 IAM 等子模块，供应用层按需引用。
 * @remarks 保持导出结构稳定，便于依赖方通过 `@hl8/core` 获得核心能力。
 */

export { IamModule } from "./application/iam/iam.module.js";
export * as CoreDomain from "./domain/index.js";
export * as CoreInterfaces from "./interfaces/index.js";
export * as CoreInfrastructure from "./infrastructure/index.js";

