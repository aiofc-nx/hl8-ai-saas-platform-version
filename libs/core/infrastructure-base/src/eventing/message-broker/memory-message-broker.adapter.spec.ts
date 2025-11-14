/**
 * @fileoverview 内存消息队列适配器单元测试
 * @description 测试内存消息队列适配器的核心功能，包括事件转发和批量转发
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { randomUUID } from "crypto";
import { MemoryMessageBrokerAdapter } from "./memory-message-broker.adapter.js";
import type { StoredEvent } from "../../event-sourcing/event-store.interface.js";
import { MessageBrokerException } from "../../exceptions/infrastructure-exception.js";

describe("MemoryMessageBrokerAdapter", () => {
  let adapter: MemoryMessageBrokerAdapter;
  const tenantId = "tenant-1";

  beforeEach(() => {
    adapter = new MemoryMessageBrokerAdapter();
  });

  describe("forward", () => {
    it("应该能够转发单个事件", async () => {
      // 准备
      const event: StoredEvent = {
        eventId: randomUUID(),
        aggregateId: "aggregate-1",
        tenantId,
        version: 1,
        payload: { type: "UserCreated", name: "John" },
        occurredAt: new Date(),
        metadata: {},
      };

      // 执行
      await adapter.forward(event);

      // 验证
      const topic = `tenant:${tenantId}`;
      expect(adapter.getEventCount(topic)).toBe(1);
      const events = adapter.getEvents(topic);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it("应该能够转发多个事件到同一个主题", async () => {
      // 准备
      const event1: StoredEvent = {
        eventId: randomUUID(),
        aggregateId: "aggregate-1",
        tenantId,
        version: 1,
        payload: { type: "UserCreated" },
        occurredAt: new Date(),
        metadata: {},
      };

      const event2: StoredEvent = {
        eventId: randomUUID(),
        aggregateId: "aggregate-1",
        tenantId,
        version: 2,
        payload: { type: "UserNameChanged" },
        occurredAt: new Date(),
        metadata: {},
      };

      // 执行
      await adapter.forward(event1);
      await adapter.forward(event2);

      // 验证
      const topic = `tenant:${tenantId}`;
      expect(adapter.getEventCount(topic)).toBe(2);
      const events = adapter.getEvents(topic);
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(event1);
      expect(events[1]).toEqual(event2);
    });

    it("应该隔离不同租户的事件", async () => {
      // 准备
      const event1: StoredEvent = {
        eventId: randomUUID(),
        aggregateId: "aggregate-1",
        tenantId: "tenant-1",
        version: 1,
        payload: { type: "UserCreated" },
        occurredAt: new Date(),
        metadata: {},
      };

      const event2: StoredEvent = {
        eventId: randomUUID(),
        aggregateId: "aggregate-1",
        tenantId: "tenant-2",
        version: 1,
        payload: { type: "UserCreated" },
        occurredAt: new Date(),
        metadata: {},
      };

      // 执行
      await adapter.forward(event1);
      await adapter.forward(event2);

      // 验证
      expect(adapter.getEventCount("tenant:tenant-1")).toBe(1);
      expect(adapter.getEventCount("tenant:tenant-2")).toBe(1);
      expect(adapter.getEvents("tenant:tenant-1")[0].tenantId).toBe("tenant-1");
      expect(adapter.getEvents("tenant:tenant-2")[0].tenantId).toBe("tenant-2");
    });
  });

  describe("forwardBatch", () => {
    it("应该能够批量转发事件", async () => {
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
          aggregateId: "aggregate-1",
          tenantId,
          version: 2,
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      // 执行
      await adapter.forwardBatch(events);

      // 验证
      const topic = `tenant:${tenantId}`;
      expect(adapter.getEventCount(topic)).toBe(2);
      const storedEvents = adapter.getEvents(topic);
      expect(storedEvents).toHaveLength(2);
      expect(storedEvents[0]).toEqual(events[0]);
      expect(storedEvents[1]).toEqual(events[1]);
    });

    it("应该能够批量转发空事件列表", async () => {
      // 执行
      await adapter.forwardBatch([]);

      // 验证
      const topic = `tenant:${tenantId}`;
      expect(adapter.getEventCount(topic)).toBe(0);
    });

    it("应该能够批量转发不同租户的事件", async () => {
      // 准备
      const events: StoredEvent[] = [
        {
          eventId: randomUUID(),
          aggregateId: "aggregate-1",
          tenantId: "tenant-1",
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          eventId: randomUUID(),
          aggregateId: "aggregate-2",
          tenantId: "tenant-2",
          version: 1,
          payload: { type: "UserCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      // 执行
      await adapter.forwardBatch(events);

      // 验证
      expect(adapter.getEventCount("tenant:tenant-1")).toBe(1);
      expect(adapter.getEventCount("tenant:tenant-2")).toBe(1);
    });

    it("应该能够批量转发同一租户的多个事件", async () => {
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
          aggregateId: "aggregate-2",
          tenantId,
          version: 1,
          payload: { type: "OrderCreated" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      // 执行
      await adapter.forwardBatch(events);

      // 验证
      const topic = `tenant:${tenantId}`;
      expect(adapter.getEventCount(topic)).toBe(2);
    });
  });

  describe("clear", () => {
    it("应该清空所有事件", async () => {
      // 准备
      const event: StoredEvent = {
        eventId: randomUUID(),
        aggregateId: "aggregate-1",
        tenantId,
        version: 1,
        payload: { type: "UserCreated" },
        occurredAt: new Date(),
        metadata: {},
      };

      await adapter.forward(event);
      expect(adapter.getEventCount(`tenant:${tenantId}`)).toBe(1);

      // 执行
      adapter.clear();

      // 验证
      expect(adapter.getEventCount(`tenant:${tenantId}`)).toBe(0);
    });
  });

  describe("getEventCount", () => {
    it("应该返回正确的事件数量", async () => {
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
          aggregateId: "aggregate-1",
          tenantId,
          version: 2,
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      await adapter.forwardBatch(events);

      // 执行
      const count = adapter.getEventCount(`tenant:${tenantId}`);

      // 验证
      expect(count).toBe(2);
    });

    it("应该为空主题返回 0", () => {
      // 执行
      const count = adapter.getEventCount("tenant:nonexistent");

      // 验证
      expect(count).toBe(0);
    });
  });

  describe("getEvents", () => {
    it("应该返回正确的事件列表", async () => {
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
          aggregateId: "aggregate-1",
          tenantId,
          version: 2,
          payload: { type: "UserNameChanged" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      await adapter.forwardBatch(events);

      // 执行
      const result = adapter.getEvents(`tenant:${tenantId}`);

      // 验证
      expect(result).toHaveLength(2);
      expect(result).toEqual(events);
    });

    it("应该为空主题返回空数组", () => {
      // 执行
      const result = adapter.getEvents("tenant:nonexistent");

      // 验证
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
