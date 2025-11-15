/**
 * @fileoverview 租户状态值对象单元测试
 * @description 测试租户状态值对象的状态转移和业务规则
 */

import { describe, it, expect } from "@jest/globals";
import { DomainException } from "@hl8/domain-base";
import { TenantStatus, TenantStatusEnum } from "./tenant-status.vo.js";

describe("TenantStatus", () => {
  describe("静态属性", () => {
    it("应该提供所有状态常量", () => {
      expect(TenantStatus.Initialized).toBeDefined();
      expect(TenantStatus.Active).toBeDefined();
      expect(TenantStatus.Suspended).toBeDefined();
      expect(TenantStatus.Archived).toBeDefined();
    });

    it("应该正确设置状态值", () => {
      expect(TenantStatus.Initialized.value).toBe(TenantStatusEnum.Initialized);
      expect(TenantStatus.Active.value).toBe(TenantStatusEnum.Active);
      expect(TenantStatus.Suspended.value).toBe(TenantStatusEnum.Suspended);
      expect(TenantStatus.Archived.value).toBe(TenantStatusEnum.Archived);
    });
  });

  describe("fromEnum", () => {
    it("应该从枚举值创建状态", () => {
      const status = TenantStatus.fromEnum(TenantStatusEnum.Active);
      expect(status).toBe(TenantStatus.Active);
    });

    it("应该拒绝无效的枚举值", () => {
      expect(() =>
        TenantStatus.fromEnum("Invalid" as TenantStatusEnum),
      ).toThrow(DomainException);
    });
  });

  describe("fromString", () => {
    it("应该从字符串创建状态", () => {
      const status = TenantStatus.fromString("Active");
      expect(status).toBe(TenantStatus.Active);
    });

    it("应该拒绝无效的字符串", () => {
      expect(() => TenantStatus.fromString("Invalid")).toThrow(DomainException);
      expect(() => TenantStatus.fromString("Invalid")).toThrow(
        "无效的租户状态字符串",
      );
    });
  });

  describe("canTransitionTo", () => {
    it("应该允许从 Initialized 转移到 Active", () => {
      expect(
        TenantStatus.Initialized.canTransitionTo(TenantStatus.Active),
      ).toBe(true);
    });

    it("应该允许从 Initialized 转移到 Archived", () => {
      expect(
        TenantStatus.Initialized.canTransitionTo(TenantStatus.Archived),
      ).toBe(true);
    });

    it("应该拒绝从 Initialized 转移到 Suspended", () => {
      expect(
        TenantStatus.Initialized.canTransitionTo(TenantStatus.Suspended),
      ).toBe(false);
    });

    it("应该允许从 Active 转移到 Suspended", () => {
      expect(TenantStatus.Active.canTransitionTo(TenantStatus.Suspended)).toBe(
        true,
      );
    });

    it("应该允许从 Active 转移到 Archived", () => {
      expect(TenantStatus.Active.canTransitionTo(TenantStatus.Archived)).toBe(
        true,
      );
    });

    it("应该拒绝从 Active 转移到 Initialized", () => {
      expect(
        TenantStatus.Active.canTransitionTo(TenantStatus.Initialized),
      ).toBe(false);
    });

    it("应该允许从 Suspended 转移到 Active", () => {
      expect(TenantStatus.Suspended.canTransitionTo(TenantStatus.Active)).toBe(
        true,
      );
    });

    it("应该允许从 Suspended 转移到 Archived", () => {
      expect(
        TenantStatus.Suspended.canTransitionTo(TenantStatus.Archived),
      ).toBe(true);
    });

    it("应该拒绝从 Suspended 转移到 Initialized", () => {
      expect(
        TenantStatus.Suspended.canTransitionTo(TenantStatus.Initialized),
      ).toBe(false);
    });

    it("应该拒绝从 Archived 转移到任何状态", () => {
      expect(TenantStatus.Archived.canTransitionTo(TenantStatus.Active)).toBe(
        false,
      );
      expect(
        TenantStatus.Archived.canTransitionTo(TenantStatus.Suspended),
      ).toBe(false);
      expect(
        TenantStatus.Archived.canTransitionTo(TenantStatus.Initialized),
      ).toBe(false);
    });
  });

  describe("状态判断方法", () => {
    it("isInitialized 应该正确判断初始化状态", () => {
      expect(TenantStatus.Initialized.isInitialized()).toBe(true);
      expect(TenantStatus.Active.isInitialized()).toBe(false);
    });

    it("isActive 应该正确判断激活状态", () => {
      expect(TenantStatus.Active.isActive()).toBe(true);
      expect(TenantStatus.Initialized.isActive()).toBe(false);
    });

    it("isSuspended 应该正确判断暂停状态", () => {
      expect(TenantStatus.Suspended.isSuspended()).toBe(true);
      expect(TenantStatus.Active.isSuspended()).toBe(false);
    });

    it("isArchived 应该正确判断归档状态", () => {
      expect(TenantStatus.Archived.isArchived()).toBe(true);
      expect(TenantStatus.Active.isArchived()).toBe(false);
    });
  });

  describe("toString", () => {
    it("应该返回状态枚举值的字符串表示", () => {
      expect(TenantStatus.Active.toString()).toBe("Active");
      expect(TenantStatus.Initialized.toString()).toBe("Initialized");
    });
  });
});
