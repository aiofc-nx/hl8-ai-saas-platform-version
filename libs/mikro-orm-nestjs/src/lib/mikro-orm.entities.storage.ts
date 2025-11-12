import type { AnyEntity } from "@mikro-orm/core";
import type { EntityName } from "./typings.js";

/**
 * @description MikroORM 实体登记存储，缓存按上下文分类的实体定义
 */
export class MikroOrmEntitiesStorage {
  private static readonly storage = new Map<
    string,
    Set<EntityName<AnyEntity>>
  >();
  private static shouldClear = false;

  /**
   * @description 记录实体或实体名称
   * @param entity - 实体定义或名称
   * @param contextName - 上下文名称，默认 `default`
   * @returns void
   */
  static addEntity(entity: EntityName<AnyEntity>, contextName = "default") {
    if (this.shouldClear) {
      this.clear(contextName);
      this.shouldClear = false;
    }

    let set = this.storage.get(contextName);

    if (!set) {
      set = new Set<EntityName<AnyEntity>>();
      this.storage.set(contextName, set);
    }

    set.add(entity);
  }

  /**
   * @description 按上下文获取已登记实体
   * @param contextName - 上下文名称
   * @returns 实体迭代器
   */
  static getEntities(contextName = "default") {
    return this.storage.get(contextName)?.values() || [];
  }

  /**
   * @description 清空指定上下文的实体缓存
   * @param contextName - 上下文名称
   * @returns void
   */
  static clear(contextName = "default") {
    this.storage.get(contextName)?.clear();
  }

  /**
   * @description 标记下次添加实体前自动清空缓存
   *
   * 为兼容测试场景下的上下文重建，使用惰性清理策略：避免立即清空影响 require 时注册的实体缓存，
   * 而是在下一次 `addEntity` 调用时完成清理。
   *
   * @returns void
   */
  static clearLater() {
    this.shouldClear = true;
  }
}
