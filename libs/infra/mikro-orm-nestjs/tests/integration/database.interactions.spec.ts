import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import {
  Entity,
  MikroORM,
  PrimaryKey,
  Property,
  type Options,
} from "@mikro-orm/core";
import { PostgresMikroOrmConfig } from "../../src/config/postgres-mikro-orm.config.js";
import { MongoMikroOrmConfig } from "../../src/config/mongo-mikro-orm.config.js";
import { ObjectId } from "@mikro-orm/mongodb";
@Entity({ tableName: "integration_dummy_pg" })
class DummyPostgresEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  label!: string;
}

@Entity({ collection: "integration_dummy_mongo" })
class DummyMongoEntity {
  @PrimaryKey()
  _id: ObjectId = new ObjectId();

  @Property()
  label: string = "mongo";
}

jest.setTimeout(15_000);

describe("数据库容器集成验证", () => {
  describe("PostgreSQL 集成", () => {
    let orm: MikroORM | undefined;

    beforeAll(async () => {
      const config = new PostgresMikroOrmConfig();
      config.host = "127.0.0.1";
      config.port = 5432;
      config.username = "aiofix";
      config.password = "aiofix";
      config.dbName = "hl8-platform";
      config.debug = false;

      const options = config.getOrmOptions() as Options;
      options.entities = [DummyPostgresEntity];
      options.entitiesTs = [];

      orm = await MikroORM.init(options);
    });

    afterAll(async () => {
      if (orm) {
        await orm.close(true);
      }
    });

    it("应成功执行 select 语句", async () => {
      const result = await orm!.em
        .getConnection()
        .execute("select 1 as result");

      expect(result[0]?.result).toBe(1);
    });
  });

  describe("MongoDB 集成", () => {
    let orm: MikroORM | undefined;

    beforeAll(async () => {
      const config = new MongoMikroOrmConfig();
      config.uri = "mongodb://aiofix:aiofix@127.0.0.1:27017/?authSource=admin";
      config.dbName = "hl8-platform";
      config.debug = false;
      config.retryWrites = false;

      const options = config.getOrmOptions() as Options;
      options.entities = [DummyMongoEntity];
      options.entitiesTs = [];

      orm = await MikroORM.init(options);
    });

    afterAll(async () => {
      if (orm) {
        await orm.close(true);
      }
    });

    it("应能写入并查询集合数据", async () => {
      const connection = orm!.em.getDriver().getConnection();
      const collection = connection.getCollection("integration_tests");

      await collection.insertOne({ name: "integration-check" });
      const count = await collection.countDocuments({
        name: "integration-check",
      });
      await collection.deleteMany({ name: "integration-check" });

      expect(count).toBeGreaterThan(0);
    });
  });
});
