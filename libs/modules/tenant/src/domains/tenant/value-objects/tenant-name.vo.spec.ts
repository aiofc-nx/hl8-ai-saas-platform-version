/**
 * @fileoverview 租户名称值对象单元测试
 * @description 测试租户名称值对象的创建、校验和业务规则
 */

import { describe, it, expect } from "@jest/globals";
import { DomainException } from "@hl8/domain-base";
import { TenantName } from "./tenant-name.vo.js";

describe("TenantName", () => {
  describe("create", () => {
    it("应该成功创建有效的租户名称", () => {
      const name = TenantName.create("ABC公司");
      expect(name.value).toBe("ABC公司");
    });

    it("应该成功创建包含英文和数字的名称", () => {
      const name = TenantName.create("Company123");
      expect(name.value).toBe("Company123");
    });

    it("应该成功创建包含连字符和下划线的名称", () => {
      const name = TenantName.create("ABC-Company_123");
      expect(name.value).toBe("ABC-Company_123");
    });

    it("应该自动去除首尾空白字符", () => {
      const name = TenantName.create("  ABC公司  ");
      expect(name.value).toBe("ABC公司");
    });

    it("应该拒绝空字符串", () => {
      expect(() => TenantName.create("")).toThrow(DomainException);
      expect(() => TenantName.create("")).toThrow("租户名称不能为空");
    });

    it("应该拒绝仅包含空白字符的字符串", () => {
      expect(() => TenantName.create("   ")).toThrow(DomainException);
    });

    it("应该拒绝长度少于1个字符的名称", () => {
      expect(() => TenantName.create("")).toThrow(DomainException);
    });

    it("应该拒绝长度超过100个字符的名称", () => {
      const longName = "A".repeat(101);
      expect(() => TenantName.create(longName)).toThrow(DomainException);
      expect(() => TenantName.create(longName)).toThrow(
        "租户名称长度不能超过 100 个字符",
      );
    });

    it("应该接受长度为100个字符的名称", () => {
      const name = "A".repeat(100);
      const tenantName = TenantName.create(name);
      expect(tenantName.value).toBe(name);
    });

    it("应该拒绝包含特殊符号的名称", () => {
      expect(() => TenantName.create("ABC@公司")).toThrow(DomainException);
      expect(() => TenantName.create("ABC@公司")).toThrow(
        "租户名称只能包含中文、英文、数字、连字符（-）和下划线（_）",
      );
    });

    it("应该拒绝包含表情符号的名称", () => {
      expect(() => TenantName.create("ABC公司😊")).toThrow(DomainException);
    });

    it("应该拒绝包含控制字符的名称", () => {
      expect(() => TenantName.create("ABC\n公司")).toThrow(DomainException);
    });
  });

  describe("value", () => {
    it("应该返回租户名称值", () => {
      const name = TenantName.create("ABC公司");
      expect(name.value).toBe("ABC公司");
    });
  });

  describe("toString", () => {
    it("应该返回租户名称字符串", () => {
      const name = TenantName.create("ABC公司");
      expect(name.toString()).toBe("ABC公司");
    });
  });
});
