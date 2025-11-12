/**
 * @public
 * @remarks 值对象基类，负责封装等值比较与不可变属性。
 */
export abstract class ValueObjectBase<TProps extends object> {
  protected readonly props: Readonly<TProps>;

  protected constructor(props: TProps) {
    this.props = Object.freeze({ ...props }) as Readonly<TProps>;
  }

  /**
   * 判断两个值对象是否等值。
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
   * 以普通对象形式导出值对象属性。
   */
  public toJSON(): Readonly<TProps> {
    return this.props;
  }
}
