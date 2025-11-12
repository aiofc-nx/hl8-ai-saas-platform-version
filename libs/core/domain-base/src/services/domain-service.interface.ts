/**
 * @public
 * @remarks 领域服务标识接口，约束服务实现保持无状态。
 */
export interface DomainService {
  /**
   * 品牌字段，仅用于类型约束，业务实现不应访问。
   */
  readonly __domainServiceBrand?: unique symbol;
}
