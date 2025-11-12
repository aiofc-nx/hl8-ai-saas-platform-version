import { describe, expect, it } from "@jest/globals";
import { forRoutesPath } from "./middleware.helper.js";

describe("forRoutesPath", () => {
  it("当指定自定义路径时应直接返回", () => {
    const path = forRoutesPath({ forRoutesPath: "/custom" }, {} as never);
    expect(path).toBe("/custom");
  });

  it("在 Fastify 默认场景下应返回 (.*)", () => {
    const path = forRoutesPath({}, {} as never);
    expect(path).toBe("(.*)");
  });
});
