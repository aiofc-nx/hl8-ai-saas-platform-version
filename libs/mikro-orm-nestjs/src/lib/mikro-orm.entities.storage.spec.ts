import { describe, expect, it, beforeEach } from "@jest/globals";
import { MikroOrmEntitiesStorage } from "./mikro-orm.entities.storage.js";

describe("MikroOrmEntitiesStorage", () => {
  beforeEach(() => {
    MikroOrmEntitiesStorage.clear("default");
    MikroOrmEntitiesStorage.clear("orders");
  });

  it("addEntity 应按上下文记录实体", () => {
    class DemoEntity {}

    MikroOrmEntitiesStorage.addEntity(DemoEntity, "orders");

    const entities = Array.from(MikroOrmEntitiesStorage.getEntities("orders"));
    expect(entities).toEqual([DemoEntity]);
  });

  it("clear 应清空指定上下文的实体缓存", () => {
    class DemoEntity {}
    MikroOrmEntitiesStorage.addEntity(DemoEntity, "orders");

    MikroOrmEntitiesStorage.clear("orders");

    const entities = Array.from(MikroOrmEntitiesStorage.getEntities("orders"));
    expect(entities).toHaveLength(0);
  });

  it("clearLater 应在下次 addEntity 调用前惰性清理", () => {
    class DemoEntity {}
    class OtherEntity {}
    MikroOrmEntitiesStorage.addEntity(DemoEntity, "orders");

    MikroOrmEntitiesStorage.clearLater();
    MikroOrmEntitiesStorage.addEntity(OtherEntity, "orders");

    const entities = Array.from(MikroOrmEntitiesStorage.getEntities("orders"));
    expect(entities).toEqual([OtherEntity]);
  });
});
