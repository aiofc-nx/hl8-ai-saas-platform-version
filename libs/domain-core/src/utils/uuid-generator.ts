import { randomUUID } from "node:crypto";

import { assertUuid } from "./domain-guards.js";

/**
 * @public
 * @remarks 平台统一 UUID 生成器，供领域层使用。
 */
export class UuidGenerator {
  /**
   * 生成新的 UUID v4。
   */
  public static generate(): string {
    return randomUUID();
  }

  /**
   * 校验传入 UUID 的合法性。
   */
  public static validate(value: string): string {
    assertUuid(value, "标识符必须为合法的 UUID");
    return value;
  }
}
