import { BadRequestException } from "@nestjs/common";
import type { SagaStep } from "./saga-step.interface.js";

/**
 * @public
 * @description Saga 基类，提供顺序执行与补偿策略。
 */
export abstract class BaseSaga<TContext> {
  protected constructor(protected readonly steps: SagaStep<TContext>[]) {
    if (steps.length === 0) {
      throw new BadRequestException("Saga 步骤不可为空");
    }
  }

  /**
   * @description 执行 Saga 全部步骤，如遇异常将按逆序执行补偿。
   * @param context - Saga 共享上下文。
   */
  public async run(context: TContext): Promise<void> {
    const history: SagaStep<TContext>[] = [];
    for (const step of this.steps) {
      try {
        await step.execute(context);
        history.push(step);
      } catch (error) {
        await this.compensate(history, context, error as Error);
        throw error;
      }
    }
  }

  private async compensate(
    history: SagaStep<TContext>[],
    context: TContext,
    originalError: Error,
  ): Promise<void> {
    for (const step of [...history].reverse()) {
      if (step.compensate) {
        await step.compensate(context, originalError);
      }
    }
  }
}
