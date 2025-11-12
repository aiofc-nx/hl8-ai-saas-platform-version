import { describe, expect, it, jest } from "@jest/globals";
import { MikroOrmModule } from "./mikro-orm.module.js";
import { MikroOrmEntitiesStorage } from "./mikro-orm.entities.storage.js";
import { MikroOrmCoreModule } from "./mikro-orm-core.module.js";

describe("MikroOrmModule", () => {
  it("clearStorage 应清理实体存储", () => {
    class DemoEntity {}
    MikroOrmEntitiesStorage.addEntity(DemoEntity, "orders");

    MikroOrmModule.clearStorage("orders");

    expect(
      Array.from(MikroOrmEntitiesStorage.getEntities("orders")),
    ).toHaveLength(0);
  });

  it("forRoot 数组调用时应委托核心模块", () => {
    const spy = jest
      .spyOn(MikroOrmCoreModule, "forRoot")
      .mockReturnValue({ module: MikroOrmCoreModule });

    const configs = [{ contextName: "orders" }, { contextName: "billing" }];
    const result = MikroOrmModule.forRoot(configs);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);

    spy.mockRestore();
  });

  it("forFeature 应返回实体仓储 Provider", () => {
    class DemoEntity {}
    const module = MikroOrmModule.forFeature([DemoEntity], "orders");

    expect(module.providers).toHaveLength(1);
    expect(module.exports).toEqual(module.providers);
  });
});
