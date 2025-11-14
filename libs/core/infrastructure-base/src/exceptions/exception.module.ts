/**
 * @fileoverview 异常模块
 * @description 注册异常服务，导出 ExceptionService 接口
 *
 * ## 业务规则
 *
 * ### 模块注册规则
 * - 注册 ExceptionService 提供者
 * - 导出 ExceptionService 接口
 * - 支持测试替身
 *
 * ### 依赖注入规则
 * - ExceptionService 接口可以通过依赖注入使用
 * - 支持注入日志服务
 */

import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import type { ExceptionService } from "./exception.interface.js";
import { ExceptionServiceImpl } from "./exception.service.js";

/**
 * @description 异常模块选项
 * @remarks 定义异常模块的配置选项
 */
export interface ExceptionModuleOptions {
  /**
   * @description 是否注册为全局模块
   * @remarks 默认 false，需要显式导入
   */
  isGlobal?: boolean;
}

/**
 * @description 异常模块
 * @remarks 注册异常服务，导出 ExceptionService 接口
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     ExceptionModule.forRoot({
 *       isGlobal: true,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class ExceptionModule {
  /**
   * @description 注册异常模块
   * @remarks 创建并配置异常模块
   *
   * @param options - 模块选项
   * @returns 动态模块
   */
  static forRoot(options: ExceptionModuleOptions = {}): DynamicModule {
    const { isGlobal = false } = options;

    // 创建提供者
    const providers: Provider[] = [
      // 异常服务
      {
        provide: "ExceptionService",
        useFactory: (logger?: Logger): ExceptionService => {
          return new ExceptionServiceImpl(logger);
        },
        inject: [{ token: Logger, optional: true }],
      },
    ];

    return {
      module: ExceptionModule,
      global: isGlobal,
      providers,
      exports: ["ExceptionService"],
    };
  }
}
