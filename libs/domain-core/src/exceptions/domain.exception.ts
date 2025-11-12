/**
 * @public
 * @remarks 平台领域异常基类，保持领域层纯净，不依赖基础设施异常模块。
 */
export class DomainException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DomainException";
  }
}
