/**
 * 配置安全工具
 *
 * @description 提供配置安全相关的工具函数，包括深度冻结、敏感信息清理等
 *
 * ## 业务规则
 *
 * ### 配置不可变性规则
 * - 配置对象在加载后应该被冻结
 * - 防止运行时意外或恶意修改
 * - 使用深度冻结确保嵌套对象也不可变
 *
 * ### 敏感信息保护规则
 * - 启动后清理敏感环境变量
 * - 避免在日志中打印敏感信息
 * - 生产环境额外保护措施
 *
 * @example
 * ```typescript
 * import { deepFreeze, cleanupSensitiveEnvVars } from './config/config-security.util.js';
 * import { AppConfig } from './config/app.config.js';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *
 *   // 冻结配置对象
 *   const config = app.get(AppConfig);
 *   deepFreeze(config);
 *
 *   // 清理敏感环境变量
 *   if (config.NODE_ENV === 'production') {
 *     cleanupSensitiveEnvVars();
 *   }
 *
 *   await app.listen(config.PORT);
 * }
 * ```
 */

/**
 * 深度冻结对象
 *
 * @description 递归冻结对象及其所有嵌套属性，使其完全不可变
 *
 * ## 业务逻辑
 *
 * 1. **冻结当前对象**：使用 Object.freeze()
 * 2. **递归冻结**：遍历所有属性，递归冻结对象类型的属性
 * 3. **防止修改**：冻结后任何修改尝试都会失败（严格模式下抛出错误）
 *
 * ## 使用场景
 *
 * - 配置对象加载后立即冻结
 * - 防止配置被意外或恶意修改
 * - 确保配置的一致性和可预测性
 *
 * @param obj - 要冻结的对象
 * @returns 冻结后的对象（同一个引用）
 *
 * @example
 * ```typescript
 * const config = { port: 3000, db: { host: 'localhost' } };
 * deepFreeze(config);
 *
 * config.port = 9999;  // ❌ 严格模式下抛出 TypeError
 * config.db.host = 'evil.com';  // ❌ 同样被保护
 * ```
 */
export function deepFreeze<T>(obj: T): T {
  // 冻结当前对象
  Object.freeze(obj);

  // 递归冻结所有属性
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as Record<string, unknown>)[prop];

    // 如果属性是对象且未冻结，递归冻结
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });

  return obj;
}

/**
 * 敏感环境变量列表
 *
 * @description 定义需要在启动后清理的敏感环境变量
 *
 * ## 配置规则
 *
 * - 所有包含密码、密钥、令牌的环境变量
 * - 使用通配符匹配（支持嵌套配置）
 * - 生产环境强制清理
 */
const SENSITIVE_ENV_VARS = [
  "DATABASE_PASSWORD",
  "DATABASE__PASSWORD",
  "CACHING__REDIS__PASSWORD",
  "REDIS__PASSWORD",
  "API_SECRET_KEY",
  "API__SECRET_KEY",
  "JWT_SECRET",
  "JWT__SECRET",
  "ENCRYPTION_KEY",
] as const;

/**
 * 清理敏感环境变量
 *
 * @description 删除敏感环境变量，减少运行时暴露风险
 *
 * ## 业务逻辑
 *
 * 1. **配置已加载**：环境变量已读取并创建配置实例
 * 2. **删除环境变量**：从 process.env 中删除敏感信息
 * 3. **减少暴露**：即使代码被注入，也无法读取敏感环境变量
 *
 * ## 使用场景
 *
 * - 应用启动完成后立即调用
 * - 生产环境必须调用
 * - 开发环境可选（便于调试）
 *
 * ## 注意事项
 *
 * - 必须在配置加载**之后**调用
 * - 删除后无法通过 process.env 访问这些变量
 * - 确保所有需要这些值的代码都使用配置实例
 *
 * @example
 * ```typescript
 * // main.ts
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *
 *   // 配置已加载
 *   const config = app.get(AppConfig);
 *
 *   // 生产环境清理敏感环境变量
 *   if (config.NODE_ENV === 'production') {
 *     cleanupSensitiveEnvVars();
 *   }
 *
 *   await app.listen(config.PORT);
 * }
 * ```
 */
export function cleanupSensitiveEnvVars(): void {
  let cleanedCount = 0;

  SENSITIVE_ENV_VARS.forEach((key) => {
    if (process.env[key]) {
      delete process.env[key];
      cleanedCount++;
    }
  });

  // 可选：记录清理数量（不记录具体的键名）
  if (cleanedCount > 0) {
    console.log(`[Security] 已清理 ${cleanedCount} 个敏感环境变量`);
  }
}

/**
 * 检查配置对象是否已冻结
 *
 * @description 检查配置对象及其嵌套属性是否都已冻结
 *
 * @param obj - 要检查的对象
 * @param deep - 是否深度检查（默认：true）
 * @returns 是否已完全冻结
 *
 * @example
 * ```typescript
 * const config = { port: 3000, db: { host: 'localhost' } };
 * console.log(isFrozen(config));  // false
 *
 * deepFreeze(config);
 * console.log(isFrozen(config));  // true
 * ```
 */
export function isFrozen(obj: unknown, deep: boolean = true): boolean {
  if (!obj || typeof obj !== "object") {
    return true;
  }

  if (!Object.isFrozen(obj)) {
    return false;
  }

  if (!deep) {
    return true;
  }

  const record = obj as Record<string, unknown>;

  // 深度检查所有属性
  return Object.keys(record).every((prop) => {
    const value = record[prop];
    if (value && typeof value === "object") {
      return isFrozen(value, true);
    }
    return true;
  });
}

/**
 * 获取配置对象的安全副本
 *
 * @description 创建配置对象的副本，隐藏敏感信息
 *
 * ## 业务逻辑
 *
 * 1. **深拷贝对象**：创建配置的副本
 * 2. **隐藏敏感字段**：将包含敏感信息的字段替换为 '***'
 * 3. **返回安全副本**：可以安全地记录日志或返回给客户端
 *
 * ## 使用场景
 *
 * - 记录配置到日志
 * - 返回配置信息给调试端点
 * - 配置对象的序列化
 *
 * @param obj - 配置对象
 * @param sensitiveKeys - 敏感字段列表
 * @returns 隐藏敏感信息后的副本
 *
 * @example
 * ```typescript
 * const config = {
 *   port: 3000,
 *   database: {
 *     host: 'localhost',
 *     password: 'secret123',
 *   },
 * };
 *
 * const safe = getSafeConfigCopy(config, ['password']);
 * console.log(safe);
 * // { port: 3000, database: { host: 'localhost', password: '***' } }
 * ```
 */
export function getSafeConfigCopy(
  obj: unknown,
  sensitiveKeys: string[] = ["password", "secret", "key", "token"],
): unknown {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => getSafeConfigCopy(item, sensitiveKeys));
  }

  const record = obj as Record<string, unknown>;
  const copy: Record<string, unknown> = {};

  Object.keys(record).forEach((key) => {
    const value = record[key];
    const isSensitive = sensitiveKeys.some((sensitive) =>
      key.toLowerCase().includes(sensitive.toLowerCase()),
    );

    if (isSensitive && typeof value === "string") {
      copy[key] = "***";
    } else if (value && typeof value === "object") {
      copy[key] = getSafeConfigCopy(value, sensitiveKeys);
    } else {
      copy[key] = value;
    }
  });

  return copy;
}
