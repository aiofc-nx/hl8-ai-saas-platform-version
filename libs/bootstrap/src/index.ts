/**
 * @description Bootstrap 模块公共导出入口，统一暴露 Fastify 启动相关工具方法与类型
 */
export * from "./lib/utils/call-or-undefined-if-exception.js";
export * from "./lib/utils/process-error-handlers.js";
export * from "./lib/fastify/express-compatibility.js";
export * from "./lib/fastify/fastify-adapter.factory.js";
export * from "./lib/fastify/fastify-bootstrap.types.js";
export * from "./lib/fastify/create-fastify-application.js";
export * from "./lib/fastify/bootstrap-fastify-application.js";
