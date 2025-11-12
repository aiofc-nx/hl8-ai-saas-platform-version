/**
 * @fileoverview 日志模块导出
 */

export * from "./pino-logger.service.js";
export * from "./logging.module.js";
export * from "./pino-config.factory.js";
export * from "./context/context-storage.js";
export * from "./context/request-context.types.js";
export * from "./sanitizer/sanitizer.js";
export * from "./sanitizer/default-fields.js";

// 导出 Logger 别名，使其更接近 NestJS 的导入方式
// import { Logger } from '@hl8/logger';
export { default as Logger } from "./pino-logger.service.js";
