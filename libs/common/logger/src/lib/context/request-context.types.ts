/**
 * 请求上下文类型定义
 *
 * @description 定义请求上下文和结构化日志上下文的类型
 *
 * ## 业务规则
 *
 * ### 请求上下文提取规则
 * - requestId: 优先从 req.requestId 提取，其次从 X-Request-Id 头提取
 * - traceId: 从 X-Trace-Id 头提取（分布式追踪）
 * - spanId: 从 X-Span-Id 头提取（分布式追踪）
 * - method、url、path、query、ip、userAgent: 从 Fastify 请求对象提取
 * - statusCode、responseTime: 从响应对象提取（如果可用）
 * - userId、sessionId: 从请求头或认证信息提取（如果配置启用）
 *
 * ### 结构化上下文规则
 * - request: 请求上下文（自动注入）
 * - business: 业务上下文（operation、resource、action 等）
 * - performance: 性能指标（duration、memoryUsage、cpuUsage 等）
 * - 自定义字段：支持任意扩展
 *
 * @since 1.0.0
 */

/**
 * 请求上下文接口
 *
 * @description 包含请求标识、HTTP 信息、响应信息和业务上下文
 *
 * @interface RequestContext
 */
export interface RequestContext {
  /**
   * 请求唯一标识
   *
   * @description 从 req.requestId 或 X-Request-Id 头提取
   * 用于追踪单个请求的生命周期
   */
  requestId?: string;

  /**
   * 分布式追踪 ID
   *
   * @description 从 X-Trace-Id 头提取
   * 用于跨服务追踪
   */
  traceId?: string;

  /**
   * 当前 Span ID
   *
   * @description 从 X-Span-Id 头提取
   * 用于分布式追踪
   */
  spanId?: string;

  /**
   * HTTP 方法
   *
   * @description GET、POST、PUT、DELETE 等
   */
  method?: string;

  /**
   * 完整请求 URL
   *
   * @description 包含查询参数
   */
  url?: string;

  /**
   * 请求路径
   *
   * @description 不含查询参数
   */
  path?: string;

  /**
   * 查询参数
   *
   * @description 解析后的查询参数对象
   */
  query?: Record<string, unknown>;

  /**
   * 客户端 IP 地址
   *
   * @description 从请求对象提取
   */
  ip?: string;

  /**
   * User-Agent 字符串
   *
   * @description 客户端浏览器/客户端信息
   */
  userAgent?: string;

  /**
   * HTTP 响应状态码
   *
   * @description 100-599 范围内的状态码
   * 仅在响应阶段可用
   */
  statusCode?: number;

  /**
   * 响应时间（毫秒）
   *
   * @description 请求处理时间
   * 仅在响应阶段可用
   */
  responseTime?: number;

  /**
   * 用户 ID
   *
   * @description 从认证信息或请求头提取
   * 仅在配置启用时提取
   */
  userId?: string;

  /**
   * 会话 ID
   *
   * @description 从请求头或认证信息提取
   * 仅在配置启用时提取
   */
  sessionId?: string;
}

/**
 * 结构化日志上下文接口
 *
 * @description 提供类型安全的结构化日志上下文
 *
 * @interface StructuredLogContext
 */
export interface StructuredLogContext {
  /**
   * 请求上下文（自动注入）
   *
   * @description 如果启用上下文注入，此字段会自动填充
   */
  request?: RequestContext;

  /**
   * 业务上下文
   *
   * @description 包含操作、资源、动作等业务相关信息
   */
  business?: {
    /**
     * 操作名称
     *
     * @description 如：createUser、updateOrder
     */
    operation?: string;

    /**
     * 资源名称
     *
     * @description 如：User、Order
     */
    resource?: string;

    /**
     * 动作名称
     *
     * @description 如：create、update、delete
     */
    action?: string;

    /**
     * 其他业务字段
     *
     * @description 支持任意扩展
     */
    [key: string]: unknown;
  };

  /**
   * 性能指标
   *
   * @description 包含操作耗时、内存使用、CPU 使用等性能相关信息
   */
  performance?: {
    /**
     * 操作耗时（毫秒）
     *
     * @description 非负数
     */
    duration?: number;

    /**
     * 内存使用量（字节）
     *
     * @description 非负数
     */
    memoryUsage?: number;

    /**
     * CPU 使用率（百分比）
     *
     * @description 0-100 范围内
     */
    cpuUsage?: number;

    /**
     * 其他性能指标
     *
     * @description 支持任意扩展
     */
    [key: string]: unknown;
  };

  /**
   * 自定义字段
   *
   * @description 支持任意扩展
   */
  [key: string]: unknown;
}
