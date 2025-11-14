/**
 * @fileoverview 空审计服务单元测试
 * @description 测试空审计服务的核心功能，确保它不会抛出异常
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { randomUUID } from "crypto";
import { NullAuditService } from "./null-audit.service.js";
import type { AuditRecord, AuditQuery } from "./audit.interface.js";

describe("NullAuditService", () => {
  let auditService: NullAuditService;

  beforeEach(() => {
    auditService = new NullAuditService();
  });

  describe("append", () => {
    it("应该能够追加审计记录而不抛出异常", async () => {
      // 准备
      const record: AuditRecord = {
        auditId: randomUUID(),
        tenantId: "tenant-1",
        userId: "user-1",
        action: "CREATE",
        payload: { resource: "user", id: "user-1" },
        occurredAt: new Date(),
        metadata: {},
      };

      // 执行
      await expect(auditService.append(record)).resolves.toBeUndefined();
    });

    it("应该能够追加多个审计记录而不抛出异常", async () => {
      // 准备
      const records: AuditRecord[] = [
        {
          auditId: randomUUID(),
          tenantId: "tenant-1",
          userId: "user-1",
          action: "CREATE",
          payload: { resource: "user", id: "user-1" },
          occurredAt: new Date(),
          metadata: {},
        },
        {
          auditId: randomUUID(),
          tenantId: "tenant-1",
          userId: "user-1",
          action: "UPDATE",
          payload: { resource: "user", id: "user-1" },
          occurredAt: new Date(),
          metadata: {},
        },
      ];

      // 执行
      for (const record of records) {
        await expect(auditService.append(record)).resolves.toBeUndefined();
      }
    });
  });

  describe("query", () => {
    it("应该返回空数组", async () => {
      // 准备
      const query: AuditQuery = {
        tenantId: "tenant-1",
        userId: "user-1",
        limit: 100,
        offset: 0,
      };

      // 执行
      const result = await auditService.query(query);

      // 验证
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("应该接受任何查询条件", async () => {
      // 准备
      const query: AuditQuery = {
        tenantId: "tenant-1",
        userId: "user-1",
        action: "CREATE",
        startTime: new Date("2024-01-01"),
        endTime: new Date("2024-12-31"),
        limit: 50,
        offset: 10,
      };

      // 执行
      const result = await auditService.query(query);

      // 验证
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
