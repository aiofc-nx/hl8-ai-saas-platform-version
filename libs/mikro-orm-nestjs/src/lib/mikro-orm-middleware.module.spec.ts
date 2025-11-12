import { describe, expect, it } from "@jest/globals";
import type { MiddlewareConsumer } from "@nestjs/common";
import type { MikroORM } from "@mikro-orm/core";
import {
  MIKRO_ORM_MODULE_OPTIONS,
  CONTEXT_NAMES,
  getMikroORMToken,
} from "./mikro-orm.common.js";
import { MikroOrmMiddlewareModule } from "./mikro-orm-middleware.module.js";
import { MultipleMikroOrmMiddleware } from "./multiple-mikro-orm.middleware.js";

describe("MikroOrmMiddlewareModule", () => {
  beforeEach(() => {
    CONTEXT_NAMES.length = 0;
  });

  it("forRoot 应返回包含 MikroORMs Provider 的模块定义", () => {
    CONTEXT_NAMES.push("orders");
    const moduleDef = MikroOrmMiddlewareModule.forRoot({
      forRoutesPath: "/custom",
    });

    expect(moduleDef.providers).toEqual(
      expect.arrayContaining([
        {
          provide: MIKRO_ORM_MODULE_OPTIONS,
          useValue: { forRoutesPath: "/custom" },
        },
        expect.objectContaining({
          provide: "MikroORMs",
          inject: [getMikroORMToken("orders")],
        }),
      ]),
    );
    expect(moduleDef.exports).toEqual(["MikroORMs"]);
  });

  it("configure 应将多上下文中间件应用至所有路由", () => {
    const applied: {
      middleware?: unknown;
      path?: string;
    } = {};
    const consumer = {
      apply: (middleware: unknown) => {
        applied.middleware = middleware;
        return {
          forRoutes: ({ path }: { path: string }) => {
            applied.path = path;
          },
        };
      },
    } as unknown as MiddlewareConsumer;

    const module = new MikroOrmMiddlewareModule({ forRoutesPath: undefined });
    module.configure(consumer);

    expect(applied.middleware).toBe(MultipleMikroOrmMiddleware);
    expect(applied.path).toBe("(.*)");
  });

  it("中间件工厂应将多个 ORM 实例透出", () => {
    const moduleDef = MikroOrmMiddlewareModule.forRoot();
    const mikroOrmProvider = moduleDef.providers?.find(
      (provider) =>
        typeof provider === "object" && provider.provide === "MikroORMs",
    ) as {
      useFactory: (...args: MikroORM[]) => MikroORM[];
    };
    const ormA = { mocked: true } as unknown as MikroORM;
    const ormB = { mocked: true } as unknown as MikroORM;

    const result = mikroOrmProvider.useFactory(ormA, ormB);

    expect(result).toEqual([ormA, ormB]);
  });
});
