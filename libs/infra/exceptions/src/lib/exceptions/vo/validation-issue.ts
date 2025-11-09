/**
 * @description 校验错误明细
 */
export interface ValidationIssue {
  /**
   * @description 发生错误的字段路径
   */
  field: string;

  /**
   * @description 该字段的错误说明
   */
  message: string;

  /**
   * @description 可选的错误代码，便于前端区分不同规则
   */
  code?: string;

  /**
   * @description 引发错误的实际值
   */
  rejectedValue?: unknown;
}
