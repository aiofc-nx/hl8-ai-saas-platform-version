import { GeneralBadRequestException } from "@hl8/exceptions";
import type {
  CacheLogger,
  CacheLoggerWithChild,
} from "../types/logger.types.js";

/**
 * @description 缓存键构建器抽象基类，约束命名空间与键格式。
 */
export abstract class AbstractCacheKeyBuilder<TPayload> {
  private readonly logger: CacheLogger;

  protected constructor(logger: CacheLogger) {
    this.logger =
      typeof (logger as CacheLoggerWithChild).child === "function"
        ? (logger as CacheLoggerWithChild).child({
            context: AbstractCacheKeyBuilder.name,
          })
        : logger;
  }

  /**
   * @description 生成完整缓存键，对外暴露的核心方法。
   * @param payload 构建缓存键所需的业务载荷
   * @returns 拼接后的完整缓存键字符串
   * @throws GeneralBadRequestException 当命名空间或键片段不合法时抛出
   */
  public build(payload: TPayload): string {
    const namespace = this.getNamespace(payload);
    const parts = this.getKeyParts(payload);
    const suffix = this.getSuffix(payload);

    const segments = [namespace, ...parts];
    if (suffix) {
      segments.push(suffix);
    }

    return this.joinSegments(segments, payload);
  }

  /**
   * @description 使用任意自定义片段生成缓存键，提供工具方法供子类或外部复用。
   * @param segments 键片段数组
   * @returns 拼接后的缓存键
   * @throws GeneralBadRequestException 当片段缺失或为空时抛出
   */
  public buildFromSegments(segments: Array<string | number>): string {
    if (!segments || segments.length === 0) {
      throw new GeneralBadRequestException({
        field: "segments",
        message: "缓存键片段不能为空",
        rejectedValue: segments,
      });
    }

    return this.joinSegments(segments, undefined);
  }

  /**
   * @description 返回命名空间/键前缀，通常包含租户或业务域信息。
   * @param payload 构建缓存键的业务载荷
   * @returns 命名空间字符串
   */
  protected abstract getNamespace(payload: TPayload): string;

  /**
   * @description 返回主体键片段数组。
   * @param payload 构建缓存键的业务载荷
   * @returns 键片段数组
   */
  protected abstract getKeyParts(payload: TPayload): Array<string | number>;

  /**
   * @description 可选的键后缀，默认返回 undefined。
   * @param payload 构建缓存键的业务载荷
   * @returns 可选的键后缀
   */
  protected getSuffix(_: TPayload): string | undefined {
    return undefined;
  }

  /**
   * @description 片段分隔符，默认使用冒号。
   * @returns 键分隔符字符串
   */
  protected getSeparator(): string {
    return ":";
  }

  private joinSegments(
    rawSegments: Array<string | number>,
    payload: TPayload | undefined,
  ): string {
    const separator = this.getSeparator();
    if (!separator || separator.length === 0) {
      throw new GeneralBadRequestException({
        field: "separator",
        message: "缓存键分隔符不能为空",
        rejectedValue: separator,
      });
    }

    const segments = rawSegments.map((segment, index) => {
      const normalized = this.normalizeSegment(segment, index);
      if (normalized.includes(" ")) {
        this.logger.warn("缓存键片段包含空格，已自动去除空白", {
          segment: normalized,
          payload,
        });
      }
      return normalized.replace(/\s+/g, "");
    });

    return segments.join(separator);
  }

  private normalizeSegment(segment: string | number, index: number): string {
    if (segment === undefined || segment === null) {
      throw new GeneralBadRequestException({
        field: `segments[${index}]`,
        message: "缓存键片段不能为空",
        rejectedValue: segment,
      });
    }

    const normalized = String(segment).trim();
    if (normalized.length === 0) {
      throw new GeneralBadRequestException({
        field: `segments[${index}]`,
        message: "缓存键片段不能为空字符串",
        rejectedValue: segment,
      });
    }

    return normalized;
  }
}
