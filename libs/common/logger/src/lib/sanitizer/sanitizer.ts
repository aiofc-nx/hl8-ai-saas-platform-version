/**
 * 敏感信息脱敏服务
 *
 * @description 自动识别并脱敏日志中的敏感字段，防止敏感数据泄露
 *
 * ## 业务规则
 *
 * ### 脱敏规则
 * - 支持深度遍历和递归脱敏
 * - 支持嵌套对象、数组、Map、Set 等复杂数据结构
 * - 支持自定义敏感字段列表（支持正则表达式）
 * - 支持自定义脱敏函数
 * - 脱敏后的占位符可配置（默认：'***'）
 *
 * ### 性能要求
 * - 普通对象（< 10 字段）脱敏开销 < 2ms
 * - 复杂对象（嵌套深度 < 5）脱敏开销 < 5ms
 * - 大对象（> 100 字段）脱敏开销 < 10ms
 *
 * ### 边界情况处理
 * - 循环引用：使用 WeakMap 跟踪已处理对象
 * - 特殊值：null、undefined、NaN 等特殊值的处理
 * - 函数和 Symbol：跳过函数和 Symbol 类型字段
 * - 日期对象：保持日期对象的原始格式
 *
 * @since 1.0.0
 */

import type { LogContext } from "../pino-logger.service.js";
import type { SanitizerConfig } from "../../config/logging.config.js";
import { DEFAULT_SENSITIVE_FIELDS } from "./default-fields.js";

/**
 * 敏感信息脱敏服务
 *
 * @description 提供深度遍历递归脱敏功能
 *
 * @class Sanitizer
 */
export class Sanitizer {
  private readonly maxDepth: number = 10;
  private readonly processedObjects = new WeakMap<object, unknown>();

  /**
   * 脱敏日志上下文
   *
   * @description 深度遍历上下文对象，脱敏敏感字段
   *
   * ## 业务规则
   *
   * ### 脱敏流程
   * 1. 检查字段名是否匹配敏感字段列表（支持正则表达式）
   * 2. 如果是对象，递归处理每个字段
   * 3. 如果是数组，遍历处理每个元素
   * 4. 如果是 Map/Set，遍历处理每个值
   * 5. 如果匹配，使用占位符替换值
   *
   * ### 性能优化
   * - 使用 WeakMap 跟踪已处理对象，避免重复处理
   * - 字段名匹配使用 Set 和正则表达式缓存
   * - 深度限制防止无限递归
   *
   * @param context - 原始上下文
   * @param config - 脱敏配置
   * @returns 脱敏后的上下文
   *
   * @example
   * ```typescript
   * const sanitizer = new Sanitizer();
   * const sanitized = sanitizer.sanitize(
   *   { password: 'secret', name: 'John' },
   *   { enabled: true, placeholder: '***' }
   * );
   * // 结果: { password: '***', name: 'John' }
   * ```
   */
  sanitize(context: LogContext, config?: SanitizerConfig): LogContext {
    // 如果脱敏功能未启用，返回原上下文
    if (config?.enabled === false) {
      return context;
    }

    // 处理 null 和 undefined
    if (context === null || context === undefined) {
      return context;
    }

    // 处理非对象值（字符串、数字、布尔值等）
    if (typeof context !== "object") {
      return context;
    }

    // 清理已处理对象缓存（为新请求准备）
    // 注意：WeakMap 会自动清理，这里不需要手动清理

    // 获取敏感字段列表
    // 将只读数组转换为可变数组以匹配 buildMatcher 的类型要求
    const sensitiveFields: (string | RegExp)[] = config?.sensitiveFields || [
      ...DEFAULT_SENSITIVE_FIELDS,
    ];
    const placeholder = config?.placeholder || "***";
    const customSanitizer = config?.customSanitizer;

    // 构建敏感字段匹配器
    const matcher = this.buildMatcher(sensitiveFields);

    // 深度脱敏
    return this.sanitizeValue(
      context,
      "",
      matcher,
      placeholder,
      customSanitizer,
      0,
    ) as LogContext;
  }

  /**
   * 构建字段名匹配器
   *
   * @description 将敏感字段列表转换为高效的匹配函数
   *
   * @param sensitiveFields - 敏感字段列表（支持字符串和正则表达式）
   * @returns 匹配函数
   *
   * @private
   */
  private buildMatcher(
    sensitiveFields: (string | RegExp)[],
  ): (fieldName: string) => boolean {
    // 将字符串字段转换为 Set，用于 O(1) 查找
    const stringFields = new Set<string>();
    const regexFields: RegExp[] = [];

    for (const field of sensitiveFields) {
      if (typeof field === "string") {
        stringFields.add(field.toLowerCase());
      } else if (field instanceof RegExp) {
        regexFields.push(field);
      }
    }

    // 返回匹配函数
    return (fieldName: string): boolean => {
      const lowerFieldName = fieldName.toLowerCase();

      // 检查字符串匹配
      if (stringFields.has(lowerFieldName)) {
        return true;
      }

      // 检查正则表达式匹配
      for (const regex of regexFields) {
        if (regex.test(fieldName)) {
          return true;
        }
      }

      return false;
    };
  }

  /**
   * 脱敏值
   *
   * @description 递归脱敏值，支持对象、数组、Map、Set 等
   *
   * @param value - 要脱敏的值
   * @param fieldName - 字段名（用于匹配敏感字段）
   * @param matcher - 字段名匹配函数
   * @param placeholder - 脱敏占位符
   * @param customSanitizer - 自定义脱敏函数
   * @param depth - 当前深度（防止无限递归）
   * @returns 脱敏后的值
   *
   * @private
   */
  private sanitizeValue(
    value: unknown,
    fieldName: string,
    matcher: (fieldName: string) => boolean,
    placeholder: string,
    customSanitizer?: (fieldName: string, value: unknown) => unknown,
    depth: number = 0,
  ): unknown {
    // 深度限制
    if (depth >= this.maxDepth) {
      return value;
    }

    // 处理 null 和 undefined
    if (value === null || value === undefined) {
      return value;
    }

    // 处理基本类型
    if (typeof value !== "object") {
      // 如果字段名匹配敏感字段，使用自定义脱敏函数或占位符
      if (fieldName && matcher(fieldName)) {
        if (customSanitizer) {
          return customSanitizer(fieldName, value);
        }
        return placeholder;
      }
      return value;
    }

    // 处理日期对象（保持原始格式）
    if (value instanceof Date) {
      return value;
    }

    // 处理数组
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        this.sanitizeValue(
          item,
          `${fieldName}[${index}]`,
          matcher,
          placeholder,
          customSanitizer,
          depth + 1,
        ),
      );
    }

    // 处理 Map
    if (value instanceof Map) {
      const sanitizedMap = new Map();
      for (const [key, val] of value.entries()) {
        // Map 的 key 保持不变（不脱敏 key）
        // 只对 key 进行递归脱敏（如果 key 是复杂对象）
        const sanitizedKey = this.sanitizeValue(
          key,
          "",
          matcher,
          placeholder,
          customSanitizer,
          depth + 1,
        );
        // 对于值的脱敏，使用 key 作为字段名（如果 key 是字符串）
        // 这样可以通过字段名匹配来脱敏敏感字段的值
        const fieldNameForValue = typeof key === "string" ? key : "";
        const sanitizedVal = this.sanitizeValue(
          val,
          fieldNameForValue,
          matcher,
          placeholder,
          customSanitizer,
          depth + 1,
        );
        sanitizedMap.set(sanitizedKey, sanitizedVal);
      }
      return sanitizedMap;
    }

    // 处理 Set
    if (value instanceof Set) {
      const sanitizedSet = new Set();
      for (const item of value) {
        sanitizedSet.add(
          this.sanitizeValue(
            item,
            "",
            matcher,
            placeholder,
            customSanitizer,
            depth + 1,
          ),
        );
      }
      return sanitizedSet;
    }

    // 处理循环引用（使用 WeakMap 跟踪已处理对象）
    if (this.processedObjects.has(value)) {
      return this.processedObjects.get(value);
    }

    // 处理普通对象
    const sanitized: Record<string, unknown> = {};
    this.processedObjects.set(value, sanitized);

    for (const [key, val] of Object.entries(value)) {
      // 跳过函数和 Symbol 类型字段
      if (typeof val === "function" || typeof key === "symbol") {
        continue;
      }

      // 检查字段名是否匹配敏感字段
      const isSensitive = matcher(key);

      if (isSensitive) {
        // 如果值是 null 或 undefined，保持原值（不脱敏）
        if (val === null || val === undefined) {
          sanitized[key] = val;
        } else {
          // 使用自定义脱敏函数或占位符
          if (customSanitizer) {
            sanitized[key] = customSanitizer(key, val);
          } else {
            sanitized[key] = placeholder;
          }
        }
      } else {
        // 递归处理嵌套对象
        sanitized[key] = this.sanitizeValue(
          val,
          key,
          matcher,
          placeholder,
          customSanitizer,
          depth + 1,
        );
      }
    }

    return sanitized;
  }
}
