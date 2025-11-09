/**
 * 默认敏感字段列表
 *
 * @description 定义默认的敏感字段列表，用于自动脱敏
 *
 * ## 业务规则
 *
 * ### 敏感字段识别规则
 * - 字段名完全匹配（大小写不敏感）
 * - 支持正则表达式匹配
 * - 支持嵌套对象和数组中的字段
 *
 * @since 1.0.0
 */

/**
 * 默认敏感字段列表
 *
 * @description 包含常见的敏感字段名称
 * 这些字段在日志中会被自动脱敏为占位符（默认：'***'）
 *
 * @constant DEFAULT_SENSITIVE_FIELDS
 */
export const DEFAULT_SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "accessToken",
  "refreshToken",
  "authorization",
  "creditCard",
  "credit_card",
  "ssn",
  "socialSecurityNumber",
] as const;
