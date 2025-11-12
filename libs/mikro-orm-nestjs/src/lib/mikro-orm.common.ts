import { MikroORM, Utils } from "@mikro-orm/core";
import { Inject } from "@nestjs/common";
import type { EntityName } from "./typings.js";

export const MIKRO_ORM_MODULE_OPTIONS = Symbol("mikro-orm-module-options");
export const CONTEXT_NAMES: string[] = [];

/**
 * @description 根据上下文名称生成 MikroORM Provider 的注入令牌
 * @param name - 数据库上下文名称
 * @returns MikroORM Provider 注入令牌
 */
export const getMikroORMToken = (name: string) => `${name}_MikroORM`;
/**
 * @description 生成 MikroORM Provider 的注入装饰器
 *
 * @param name - 数据库上下文名称
 * @returns 参数装饰器，用于注入对应的 MikroORM 实例
 */
export const InjectMikroORM = (name: string) => Inject(getMikroORMToken(name));

/**
 * @description 注入聚合后的 MikroORM 实例数组
 *
 * @returns 参数装饰器，用于注入 MikroORM 实例数组
 */
export const InjectMikroORMs = () => Inject("MikroORMs");

/**
 * @description 根据上下文名称生成 EntityManager Provider 的注入令牌
 * @param name - 数据库上下文名称
 * @returns EntityManager Provider 注入令牌
 */
export const getEntityManagerToken = (name: string) => `${name}_EntityManager`;
/**
 * @description 生成 EntityManager Provider 的注入装饰器
 *
 * @param name - 数据库上下文名称
 * @returns 参数装饰器，用于注入对应上下文的 EntityManager
 */
export const InjectEntityManager = (name: string) =>
  Inject(getEntityManagerToken(name));

/**
 * @description 获取实体仓储 Provider 的注入令牌
 * @param entity - 实体类或名称
 * @param name - 可选上下文名称，用于多数据源场景
 * @returns 实体仓储注入令牌
 */
export const getRepositoryToken = <T extends object>(
  entity: EntityName<T>,
  name?: string,
) => {
  const suffix = name ? `_${name}` : "";
  return `${Utils.className(entity)}Repository${suffix}`;
};
/**
 * @description 生成实体仓储 Provider 的注入装饰器
 *
 * @param entity - 实体类或名称
 * @param name - 可选上下文名称，多数据源场景必填
 * @returns 参数装饰器，用于注入对应的实体仓储
 */
export const InjectRepository = <T extends object>(
  entity: EntityName<T>,
  name?: string,
) => Inject(getRepositoryToken(entity, name));
