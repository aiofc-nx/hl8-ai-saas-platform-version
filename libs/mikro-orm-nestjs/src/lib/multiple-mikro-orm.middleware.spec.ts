import { describe, expect, it, jest } from "@jest/globals";
import { RequestContext, type MikroORM } from "@mikro-orm/core";
import { MultipleMikroOrmMiddleware } from "./multiple-mikro-orm.middleware.js";

describe("MultipleMikroOrmMiddleware", () => {
  it("use 应使用所有 ORM 实例创建上下文", () => {
    const createSpy = jest
      .spyOn(RequestContext, "create")
      .mockImplementation((_emArray, next) => {
        next();
      });

    const ormA = { em: { id: "A" } } as unknown as MikroORM;
    const ormB = { em: { id: "B" } } as unknown as MikroORM;
    const middleware = new MultipleMikroOrmMiddleware([ormA, ormB]);

    const next = jest.fn();
    middleware.use({}, {}, next);

    expect(createSpy).toHaveBeenCalledWith(
      [ormA.em, ormB.em],
      expect.any(Function),
    );
    expect(next).toHaveBeenCalled();

    createSpy.mockRestore();
  });
});
