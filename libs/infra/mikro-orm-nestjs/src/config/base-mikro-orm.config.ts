import type { Options } from "@mikro-orm/core";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import type { MikroOrmModuleSyncOptions } from "../lib/typings.js";

/**
 * @description MikroORM 配置基类，封装上下文标识与通用选项
 */
export abstract class BaseMikroOrmConfig {
  /**
   * @description MikroORM 上下文名称，需在应用内保持唯一
   */
  @IsString()
  @IsNotEmpty()
  contextName!: string;

  /**
   * @description 是否启用该上下文
   */
  @IsBoolean()
  enabled: boolean = true;

  /**
   * @description 是否在 Nest 中注册请求上下文中间件
   */
  @IsBoolean()
  registerRequestContext: boolean = true;

  /**
   * @description 是否根据 `forFeature` 自动装载实体
   */
  @IsBoolean()
  @IsOptional()
  autoLoadEntities: boolean = true;

  /**
   * @description 转换为 Nest 模块同步配置
   * @returns MikroOrmModuleSyncOptions
   */
  public toModuleOptions(): MikroOrmModuleSyncOptions {
    const options = this.buildOrmOptions();

    return {
      contextName: this.contextName,
      registerRequestContext: this.registerRequestContext,
      autoLoadEntities: this.autoLoadEntities,
      ...options,
    };
  }

  /**
   * @description 获取可直接用于初始化 MikroORM 的 Options
   * @returns Options
   */
  public getOrmOptions(): Options {
    return this.buildOrmOptions();
  }

  /**
   * @description 由子类实现的 ORM 选项构建逻辑
   * @returns ORM Options
   */
  protected abstract buildOrmOptions(): Options;
}
