/**
 * @public
 * @description 值对象基类，封装不可变属性与等值比较逻辑。
 * @typeParam TProps - 值对象内部属性结构。
 * @example
 * ```ts
 * class TenantCode extends ValueObjectBase<{ value: string }> {
 *   public constructor(value: string) {
 *     super({ value });
 *   }
 * }
 * ```
 */
export abstract class ValueObjectBase<TProps extends object> {
  protected readonly props: Readonly<TProps>;

  /**
   * @description 创建值对象基类实例。
   * @param props - 值对象内部属性。
   * @returns 返回 `ValueObjectBase` 的子类实例。
   * @example
   * ```ts
   * super({ value });
   * ```
   */
  protected constructor(props: TProps) {
    this.props = Object.freeze({ ...props }) as Readonly<TProps>;
  }

  /**
   * @description 判断两个值对象是否等值。
   * @param other - 用于比较的值对象，可为空。
   * @returns 若等值返回 `true`，否则返回 `false`。
   * @example
   * ```ts
   * const same = valueObject.equals(other);
   * ```
   */
  public equals(other?: ValueObjectBase<TProps>): boolean {
    if (other === undefined || other === null) {
      return false;
    }
    if (other === this) {
      return true;
    }
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }

  /**
   * @description 以普通对象形式导出值对象属性。
   * @returns 值对象内部属性的只读快照。
   * @example
   * ```ts
   * const props = valueObject.toJSON();
   * ```
   */
  public toJSON(): Readonly<TProps> {
    return this.props;
  }
}
