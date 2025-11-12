import { DomainException } from "../exceptions/domain.exception.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @public
 * @remarks 断言值已定义。
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new DomainException(message);
  }
}

/**
 * @public
 * @remarks 断言字符串非空。
 */
export function assertNonEmptyString(value: string, message: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DomainException(message);
  }
}

/**
 * @public
 * @remarks 断言字符串为合法 UUID。
 */
export function assertUuid(value: string, message: string): void {
  assertNonEmptyString(value, message);
  if (!UUID_REGEX.test(value)) {
    throw new DomainException(message);
  }
}

/**
 * @public
 * @remarks 断言传入的日期合法。
 */
export function assertValidDate(value: Date, message: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new DomainException(message);
  }
}

/**
 * @public
 * @remarks 断言布尔条件为真。
 */
export function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new DomainException(message);
  }
}
