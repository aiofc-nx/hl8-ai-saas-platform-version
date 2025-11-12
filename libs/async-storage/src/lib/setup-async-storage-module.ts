import type { DynamicModule } from "@nestjs/common";
import { ClsModule, ClsModuleOptions } from "nestjs-cls";

/**
 * @description 初始化 CLS 模块，开启全局异步上下文存储，并为每个请求生成唯一 ID
 * @param clsOptions - 可选配置，允许覆盖默认的 CLS 参数设置
 * @returns 注册完成的动态模块，可直接引入 NestJS 根模块
 * @throws Error 当 `nestjs-cls` 在初始化过程中发生内部异常时抛出
 * @example
 * ```typescript
 * @Module({
 *   imports: [setupClsModule()],
 * })
 * export class AppModule {}
 * ```
 */
export function setupClsModule(clsOptions?: ClsModuleOptions): DynamicModule {
  return ClsModule.forRoot({
    global: true,
    middleware: {
      mount: true,
      generateId: true,
      idGenerator: (req) => req.id.toString(),
    },
    ...clsOptions,
  });
}
