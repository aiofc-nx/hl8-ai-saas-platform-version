/**
 * @public
 * @description Saga 步骤接口，定义执行与补偿逻辑。
 */
export interface SagaStep<TContext> {
  /**
   * @description 步骤名称，用于审计与日志。
   */
  readonly name: string;
  /**
   * @description 执行当前步骤。
   */
  execute(context: TContext): Promise<void>;
  /**
   * @description 可选补偿逻辑，用于前序步骤失败时回滚。
   */
  compensate?(context: TContext, error: Error): Promise<void>;
}
