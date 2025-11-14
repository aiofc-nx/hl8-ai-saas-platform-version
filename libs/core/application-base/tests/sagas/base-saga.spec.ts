import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { BaseSaga } from "../../src/sagas/base-saga.js";
import type { SagaStep } from "../../src/sagas/saga-step.interface.js";

interface SagaContext {
  readonly id: string;
}

class TestSaga extends BaseSaga<SagaContext> {
  public constructor(steps: SagaStep<SagaContext>[]) {
    super(steps);
  }
}

describe("BaseSaga", () => {
  it("throws when steps are empty", () => {
    expect(() => new TestSaga([])).toThrow(BadRequestException);
  });

  it("executes steps sequentially", async () => {
    const sequence: string[] = [];
    const stepA: SagaStep<SagaContext> = {
      name: "StepA",
      execute: jest.fn(async () => sequence.push("A")),
    };
    const stepB: SagaStep<SagaContext> = {
      name: "StepB",
      execute: jest.fn(async () => sequence.push("B")),
    };

    const saga = new TestSaga([stepA, stepB]);
    await saga.run({ id: "ctx" });

    expect(sequence).toEqual(["A", "B"]);
    expect(stepA.execute).toHaveBeenCalledTimes(1);
    expect(stepB.execute).toHaveBeenCalledTimes(1);
  });

  it("runs compensation steps in reverse order when failure occurs", async () => {
    const error = new Error("step failed");
    const compensate = jest.fn<Required<SagaStep<SagaContext>>["compensate"]>();

    const stepA: SagaStep<SagaContext> = {
      name: "StepA",
      execute: jest.fn().mockResolvedValue(undefined),
      compensate,
    };
    const stepB: SagaStep<SagaContext> = {
      name: "StepB",
      execute: jest.fn().mockRejectedValue(error),
    };

    const saga = new TestSaga([stepA, stepB]);

    await expect(saga.run({ id: "ctx" })).rejects.toThrow(error);

    expect(stepA.execute).toHaveBeenCalledTimes(1);
    expect(stepB.execute).toHaveBeenCalledTimes(1);
    expect(compensate).toHaveBeenCalledWith({ id: "ctx" }, error);
  });
});
