import type { AbilityDescriptor } from "../../casl/ability-descriptor.js";
import type { SecurityContext } from "../../interfaces/security-context.js";

/**
 * @public
 * @description 查询基类，封装安全上下文与权限描述。
 */
export abstract class CaslQueryBase<_TResult = unknown> {
  protected constructor(public readonly context: SecurityContext) {}

  /**
   * @description 返回执行当前查询所需的权限描述。
   */
  public abstract abilityDescriptor(): AbilityDescriptor;

  /**
   * @description 返回审计所需的查询参数。
   */
  public auditPayload(): Record<string, unknown> | undefined {
    return undefined;
  }
}
