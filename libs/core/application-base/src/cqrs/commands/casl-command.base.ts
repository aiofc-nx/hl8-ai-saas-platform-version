import type { AbilityDescriptor } from "../../casl/ability-descriptor.js";
import type { SecurityContext } from "../../interfaces/security-context.js";

/**
 * @public
 * @description 命令基类，封装安全上下文与权限描述。
 */
export abstract class CaslCommandBase<_TResponse = void> {
  protected constructor(public readonly context: SecurityContext) {}

  /**
   * @description 返回执行当前命令所需的权限描述。
   */
  public abstract abilityDescriptor(): AbilityDescriptor;

  /**
   * @description 返回审计所需的载荷，默认返回 undefined。
   */
  public auditPayload(): Record<string, unknown> | undefined {
    return undefined;
  }
}
