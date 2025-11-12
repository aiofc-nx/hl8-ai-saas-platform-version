import { assertValidDate } from "../utils/domain-guards.js";
import { ValueObjectBase } from "./value-object.base.js";

interface DateTimeProps {
  readonly value: Date;
}

/**
 * @public
 * @remarks 平台统一的日期时间值对象，封装比较与序列化逻辑。
 */
export class DateTimeValueObject extends ValueObjectBase<DateTimeProps> {
  private constructor(date: Date) {
    assertValidDate(date, "日期时间值对象必须接收合法的时间");
    super({ value: new Date(date.getTime()) });
  }

  /**
   * 当前时间。
   */
  public static now(): DateTimeValueObject {
    return new DateTimeValueObject(new Date());
  }

  /**
   * 根据原生 Date 创建值对象。
   */
  public static fromJSDate(date: Date): DateTimeValueObject {
    return new DateTimeValueObject(date);
  }

  /**
   * 根据 ISO 字符串创建值对象。
   */
  public static fromISOString(value: string): DateTimeValueObject {
    return new DateTimeValueObject(new Date(value));
  }

  /**
   * 将值对象转换为原生 Date。
   */
  public toJSDate(): Date {
    return new Date(this.props.value.getTime());
  }

  /**
   * 序列化为 ISO 字符串。
   */
  public toISOString(): string {
    return this.toJSDate().toISOString();
  }

  /**
   * 判断当前时间是否晚于候选值。
   */
  public isAfter(other: DateTimeValueObject): boolean {
    return this.toJSDate().getTime() > other.toJSDate().getTime();
  }
}
