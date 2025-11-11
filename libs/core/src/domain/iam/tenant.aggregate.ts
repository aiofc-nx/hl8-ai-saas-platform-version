/**
 * @zh
 * @description IAM 领域内的租户聚合根，负责描述租户生命周期与关键属性。
 * @remarks 当前实现仅为骨架，用于指导后续领域建模与事件驱动行为。
 */
export class TenantAggregate {
  /**
   * @zh
   * @description 构造函数同时体现租户标识与基础资料。
   * @param id 全局唯一的租户标识
   * @param name 租户展示名称，后续将与 `TenantProfile` 值对象解耦
   * @param activated 租户是否已激活，默认待激活
   */
  public constructor(
    public readonly id: string,
    public name: string,
    public activated: boolean = false,
  ) {}

  /**
   * @zh
   * @description 租户开户（预留）逻辑，后续将发出领域事件并与事件存储集成。
   * @remarks 目前仅保留方法签名，避免业务逻辑在未达成前被使用。
   */
  public provision(): void {
    // TODO: 集成事件溯源与审计记录
  }

  /**
   * @zh
   * @description 更新租户名称的占位方法。
   * @param name 新的租户名称
   */
  public rename(name: string): void {
    this.name = name;
  }
}

