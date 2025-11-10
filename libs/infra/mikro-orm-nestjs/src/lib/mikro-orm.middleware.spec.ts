import { describe, expect, it, jest } from "@jest/globals";
import { RequestContext, type MikroORM } from "@mikro-orm/core";
import { MikroOrmMiddleware } from "./mikro-orm.middleware.js";

describe("MikroOrmMiddleware", () => {
  it("use 应创建请求上下文", () => {
    const createSpy = jest
      .spyOn(RequestContext, "create")
      .mockImplementation((_em, next) => {
        next();
      });
    const orm = { em: { mocked: true } } as unknown as MikroORM;
    const middleware = new MikroOrmMiddleware(orm);

    const next = jest.fn();
    middleware.use({}, {}, next);

    expect(createSpy).toHaveBeenCalledWith(orm.em, expect.any(Function));
    expect(next).toHaveBeenCalled();

    createSpy.mockRestore();
  });
});
