/**
 * @public
 * @description CASL 权限判定所需的能力描述。
 */
export interface AbilityDescriptor {
  /**
   * @description 权限动作，如 `read`、`manage`。
   */
  readonly action: string;
  /**
   * @description 权限主体，如命令或资源名称。
   */
  readonly subject: string;
  /**
   * @description 可选条件，用于细粒度判定。
   */
  readonly conditions?: Record<string, unknown>;
}
