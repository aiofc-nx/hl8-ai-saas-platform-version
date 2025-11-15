/**
 * @fileoverview 租户上下文值对象单元测试
 * @description 测试租户上下文值对象的创建、校验和业务规则
 */

import { describe, it, expect } from "@jest/globals";
import { DomainException, OrganizationId } from "@hl8/domain-base";
import { TenantContext } from "./tenant-context.vo.js";

describe("TenantContext", () => {
  describe("create", () => {
    it("应该成功创建有效的上下文（包含货币）", () => {
      const orgId = OrganizationId.create("org-123");
      const context = TenantContext.create({
        defaultOrganizationId: orgId,
        defaultTimezone: "Asia/Shanghai",
        currency: "CNY",
      });

      expect(context.defaultOrganizationId).toBe(orgId);
      expect(context.defaultTimezone).toBe("Asia/Shanghai");
      expect(context.currency).toBe("CNY");
    });

    it("应该成功创建有效的上下文（不包含货币）", () => {
      const orgId = OrganizationId.create("org-123");
      const context = TenantContext.create({
        defaultOrganizationId: orgId,
        defaultTimezone: "Asia/Shanghai",
      });

      expect(context.defaultOrganizationId).toBe(orgId);
      expect(context.defaultTimezone).toBe("Asia/Shanghai");
      expect(context.currency).toBeNull();
    });

    it("应该自动去除首尾空白字符", () => {
      const orgId = OrganizationId.create("org-123");
      const context = TenantContext.create({
        defaultOrganizationId: orgId,
        defaultTimezone: "  Asia/Shanghai  ",
        currency: "  CNY  ",
      });

      expect(context.defaultTimezone).toBe("Asia/Shanghai");
      expect(context.currency).toBe("CNY");
    });

    it("应该拒绝空的默认组织ID", () => {
      expect(() =>
        TenantContext.create({
          defaultOrganizationId: null as unknown as OrganizationId,
          defaultTimezone: "Asia/Shanghai",
        }),
      ).toThrow(DomainException);
    });

    it("应该拒绝空的时区", () => {
      const orgId = OrganizationId.create("org-123");
      expect(() =>
        TenantContext.create({
          defaultOrganizationId: orgId,
          defaultTimezone: "",
        }),
      ).toThrow(DomainException);
    });

    it("应该拒绝无效的时区格式", () => {
      const orgId = OrganizationId.create("org-123");
      expect(() =>
        TenantContext.create({
          defaultOrganizationId: orgId,
          defaultTimezone: "InvalidTimezone",
        }),
      ).toThrow(DomainException);
      expect(() =>
        TenantContext.create({
          defaultOrganizationId: orgId,
          defaultTimezone: "InvalidTimezone",
        }),
      ).toThrow("时区格式不正确");
    });

    it("应该接受有效的 IANA 时区格式", () => {
      const orgId = OrganizationId.create("org-123");
      const validTimezones = [
        "Asia/Shanghai",
        "America/New_York",
        "Europe/London",
      ];

      for (const timezone of validTimezones) {
        const context = TenantContext.create({
          defaultOrganizationId: orgId,
          defaultTimezone: timezone,
        });
        expect(context.defaultTimezone).toBe(timezone);
      }
    });

    it("应该拒绝无效的货币代码格式", () => {
      const orgId = OrganizationId.create("org-123");
      expect(() =>
        TenantContext.create({
          defaultOrganizationId: orgId,
          defaultTimezone: "Asia/Shanghai",
          currency: "CN",
        }),
      ).toThrow(DomainException);
      expect(() =>
        TenantContext.create({
          defaultOrganizationId: orgId,
          defaultTimezone: "Asia/Shanghai",
          currency: "CN",
        }),
      ).toThrow("货币代码格式不正确");
    });

    it("应该接受有效的货币代码格式（3位大写字母）", () => {
      const orgId = OrganizationId.create("org-123");
      const validCurrencies = ["CNY", "USD", "EUR", "GBP"];

      for (const currency of validCurrencies) {
        const context = TenantContext.create({
          defaultOrganizationId: orgId,
          defaultTimezone: "Asia/Shanghai",
          currency,
        });
        expect(context.currency).toBe(currency);
      }
    });

    it("应该接受 null 作为货币", () => {
      const orgId = OrganizationId.create("org-123");
      const context = TenantContext.create({
        defaultOrganizationId: orgId,
        defaultTimezone: "Asia/Shanghai",
        currency: null,
      });

      expect(context.currency).toBeNull();
    });

    it("应该接受空字符串作为货币（视为无货币）", () => {
      const orgId = OrganizationId.create("org-123");
      const context = TenantContext.create({
        defaultOrganizationId: orgId,
        defaultTimezone: "Asia/Shanghai",
        currency: "",
      });

      expect(context.currency).toBeNull();
    });
  });

  describe("hasCurrency", () => {
    it("应该在有货币时返回 true", () => {
      const orgId = OrganizationId.create("org-123");
      const context = TenantContext.create({
        defaultOrganizationId: orgId,
        defaultTimezone: "Asia/Shanghai",
        currency: "CNY",
      });

      expect(context.hasCurrency()).toBe(true);
    });

    it("应该在无货币时返回 false", () => {
      const orgId = OrganizationId.create("org-123");
      const context = TenantContext.create({
        defaultOrganizationId: orgId,
        defaultTimezone: "Asia/Shanghai",
      });

      expect(context.hasCurrency()).toBe(false);
    });
  });
});
