/**
 * @fileoverview 内存事件存储单元测试
 * @description 测试内存事件存储的核心功能，包括事件追加、检索和重放
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { randomUUID } from "crypto";
import { InMemoryEventStore } from "./in-memory-event-store.js";
import type { StoredEvent } from "./event-store.interface.js";
import { EventStoreException } from "../exceptions/infrastructure-exception.js";

describe("InMemoryEventStore", () => {
  let eventStore: InMemoryEventStore;
  const tenantId = "tenant-1";
  const aggregateId = "aggregate-1";

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
  });

  describe("append", () => {
    it("应该能够追加单个事件", async () => {
      // 准备
      const event: StoredEvent = {
        eventId: randomUUID(),
        aggregateId,
        tenantId,
        version: 1,
        payload: { type: "UserCreated", name: "John" },
        occurredAt: new Date(),
        metadata: {},
      };

      // 执行
      const result = await eventStore.append([event]);

      // 验证
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(event);
      expect(eventStore.getEventCount(aggregateId, tenantId)).toBe(1);
    });

    it("应该能够追加多个事件", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 1,
          payload: { type: "UserCreated", name: "John" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 2,
          payload: { type: "UserNameChanged", name: "Jane" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      // 执行
      const result = await eventStore.append(events);

      // 验证
      expect(result).toHaveLength(2);
      expect(result).toEqual(events);
      expect(eventStore.getEventCount(aggregateId, tenantId)).toBe(2);
    });

    it("应该能够追加空事件流", async () => {
      // 执行
      const result = await eventStore.append([]);

      // 验证
      expect(result).toHaveLength(0);
      expect(eventStore.getEventCount(aggregateId, tenantId)).toBe(0);
    });

    it("应该检测版本冲突", async () => {
      // 准备
      const event1: StoredEvent = {
        eventId: randomUUID(),
        aggregateId,
        tenantId,
        version: 1,
        payload: { type: "UserCreated" },
        occurredAt: new Date(),
        metadata: {},
      };

      const event2: StoredEvent = {
        eventId: randomUUID(),
        aggregateId,
        tenantId,
        version: 3, // 版本不连续
        payload: { type: "UserNameChanged" },
        occurredAt: new Date(),
        metadata: {},
      };

      // 执行第一个事件
      await eventStore.append([event1]);

      // 执行第二个事件（应该抛出异常）
      await expect(eventStore.append([event2])).rejects.toThrow(
        EventStoreException,
      );
      await expect(eventStore.append([event2])).rejects.toThrow("事件版本冲突");
    });

    it("应该验证事件流中所有事件属于同一个聚合", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId: "aggregate-1",
          tenantId,
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId: "aggregate-2", // 不同的聚合
          tenantId,
          version: 2,
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      // 执行
      await expect(eventStore.append(events)).rejects.toThrow(
        EventStoreException,
      );
      await expect(eventStore.append(events)).rejects.toThrow(
        "事件流中的所有事件必须属于同一个聚合",
      );
    });

    it("应该验证事件流中所有事件属于同一个租户", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId: "tenant-1",
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId: "tenant-2", // 不同的租户
          version: 2,
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      // 执行
      await expect(eventStore.append(events)).rejects.toThrow(
        EventStoreException,
      );
      await expect(eventStore.append(events)).rejects.toThrow(
        "事件流中的所有事件必须属于同一个租户",
      );
    });

    it("应该验证版本号必须 >= 1", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 0, // 无效的版本号
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      // 执行
      await expect(eventStore.append(events)).rejects.toThrow(
        EventStoreException,
      );
      await expect(eventStore.append(events)).rejects.toThrow(
        "事件版本号必须 >= 1",
      );
    });

    it("应该验证版本号必须连续", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 3, // 跳过版本 2
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      // 执行
      await expect(eventStore.append(events)).rejects.toThrow(
        EventStoreException,
      );
      await expect(eventStore.append(events)).rejects.toThrow(
        "事件版本号必须连续",
      );
    });
  });

  describe("load", () => {
    it("应该能够加载所有事件", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 2,
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      await eventStore.append(events);

      // 执行
      const result = await eventStore.load(aggregateId, tenantId);

      // 验证
      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(1);
      expect(result[1].version).toBe(2);
    });

    it("应该按版本顺序返回事件", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 2,
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      await eventStore.append(events);

      // 执行
      const result = await eventStore.load(aggregateId, tenantId);

      // 验证
      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(1);
      expect(result[1].version).toBe(2);
    });

    it("应该为空聚合返回空数组", async () => {
      // 执行
      const result = await eventStore.load(aggregateId, tenantId);

      // 验证
      expect(result).toHaveLength(0);
    });

    it("应该隔离不同租户的事件", async () => {
      // 准备
      const tenant1Events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId: "tenant-1",
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      const tenant2Events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId: "tenant-2",
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      await eventStore.append(tenant1Events);
      await eventStore.append(tenant2Events);

      // 执行
      const result1 = await eventStore.load(aggregateId, "tenant-1");
      const result2 = await eventStore.load(aggregateId, "tenant-2");

      // 验证
      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(result1[0].tenantId).toBe("tenant-1");
      expect(result2[0].tenantId).toBe("tenant-2");
    });
  });

  describe("loadSince", () => {
    it("应该从指定版本开始加载事件", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 2,
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 3,
          payload: { type: "UserDeleted" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      await eventStore.append(events);

      // 执行
      const result: StoredEvent[] = [];
      for await (const event of eventStore.loadSince(
        aggregateId,
        tenantId,
        2,
      )) {
        result.push(event);
      }

      // 验证
      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(2);
      expect(result[1].version).toBe(3);
    });

    it("应该按版本顺序返回事件", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 2,
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 3,
          payload: { type: "UserDeleted" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      await eventStore.append(events);

      // 执行
      const result: StoredEvent[] = [];
      for await (const event of eventStore.loadSince(
        aggregateId,
        tenantId,
        2,
      )) {
        result.push(event);
      }

      // 验证
      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(2);
      expect(result[1].version).toBe(3);
    });

    it("应该为空聚合返回空迭代器", async () => {
      // 执行
      const result: StoredEvent[] = [];
      for await (const event of eventStore.loadSince(
        aggregateId,
        tenantId,
        1,
      )) {
        result.push(event);
      }

      // 验证
      expect(result).toHaveLength(0);
    });
  });

  describe("clear", () => {
    it("应该清空所有事件", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      await eventStore.append(events);
      expect(eventStore.getEventCount(aggregateId, tenantId)).toBe(1);

      // 执行
      eventStore.clear();

      // 验证
      expect(eventStore.getEventCount(aggregateId, tenantId)).toBe(0);
      const result = await eventStore.load(aggregateId, tenantId);
      expect(result).toHaveLength(0);
    });
  });

  describe("getEventCount", () => {
    it("应该返回正确的事件数量", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId,
          tenantId,
          version: 2,
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      await eventStore.append(events);

      // 执行
      const count = eventStore.getEventCount(aggregateId, tenantId);

      // 验证
      expect(count).toBe(2);
    });

    it("应该为空聚合返回 0", () => {
      // 执行
      const count = eventStore.getEventCount(aggregateId, tenantId);

      // 验证
      expect(count).toBe(0);
    });
  });
});
