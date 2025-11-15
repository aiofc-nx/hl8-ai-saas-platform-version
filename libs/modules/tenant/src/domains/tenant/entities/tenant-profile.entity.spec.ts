/**
 * @fileoverview 租户档案实体单元测试
 * @description 测试租户档案实体的创建、更新和业务规则
 */

import { describe, it, expect } from "@jest/globals";
import { TenantProfile } from "./tenant-profile.entity.js";

describe("TenantProfile", () => {
  describe("create", () => {
    it("应该成功创建空的档案", () => {
      const profile = TenantProfile.create();
      expect(profile.legalName).toBeNull();
      expect(profile.registrationCode).toBeNull();
      expect(profile.industry).toBeNull();
    });

    it("应该成功创建包含所有字段的档案", () => {
      const profile = TenantProfile.create({
        legalName: "ABC科技有限公司",
        registrationCode: "91110000MA01234567",
        industry: "信息技术",
      });

      expect(profile.legalName).toBe("ABC科技有限公司");
      expect(profile.registrationCode).toBe("91110000MA01234567");
      expect(profile.industry).toBe("信息技术");
    });

    it("应该成功创建包含部分字段的档案", () => {
      const profile = TenantProfile.create({
        legalName: "ABC科技有限公司",
      });

      expect(profile.legalName).toBe("ABC科技有限公司");
      expect(profile.registrationCode).toBeNull();
      expect(profile.industry).toBeNull();
    });

    it("应该自动去除首尾空白字符", () => {
      const profile = TenantProfile.create({
        legalName: "  ABC科技有限公司  ",
        registrationCode: "  91110000MA01234567  ",
        industry: "  信息技术  ",
      });

      expect(profile.legalName).toBe("ABC科技有限公司");
      expect(profile.registrationCode).toBe("91110000MA01234567");
      expect(profile.industry).toBe("信息技术");
    });

    it("应该将空字符串视为 null", () => {
      const profile = TenantProfile.create({
        legalName: "",
        registrationCode: "",
        industry: "",
      });

      expect(profile.legalName).toBeNull();
      expect(profile.registrationCode).toBeNull();
      expect(profile.industry).toBeNull();
    });

    it("应该接受 null 值", () => {
      const profile = TenantProfile.create({
        legalName: null,
        registrationCode: null,
        industry: null,
      });

      expect(profile.legalName).toBeNull();
      expect(profile.registrationCode).toBeNull();
      expect(profile.industry).toBeNull();
    });
  });

  describe("hasLegalName", () => {
    it("应该在有法定名称时返回 true", () => {
      const profile = TenantProfile.create({
        legalName: "ABC科技有限公司",
      });
      expect(profile.hasLegalName()).toBe(true);
    });

    it("应该在无法定名称时返回 false", () => {
      const profile = TenantProfile.create();
      expect(profile.hasLegalName()).toBe(false);
    });
  });

  describe("hasRegistrationCode", () => {
    it("应该在有注册代码时返回 true", () => {
      const profile = TenantProfile.create({
        registrationCode: "91110000MA01234567",
      });
      expect(profile.hasRegistrationCode()).toBe(true);
    });

    it("应该在无注册代码时返回 false", () => {
      const profile = TenantProfile.create();
      expect(profile.hasRegistrationCode()).toBe(false);
    });
  });

  describe("hasIndustry", () => {
    it("应该在有行业分类时返回 true", () => {
      const profile = TenantProfile.create({
        industry: "信息技术",
      });
      expect(profile.hasIndustry()).toBe(true);
    });

    it("应该在无行业分类时返回 false", () => {
      const profile = TenantProfile.create();
      expect(profile.hasIndustry()).toBe(false);
    });
  });

  describe("update", () => {
    it("应该更新指定字段并保留其他字段", () => {
      const original = TenantProfile.create({
        legalName: "ABC科技有限公司",
        registrationCode: "91110000MA01234567",
        industry: "信息技术",
      });

      const updated = original.update({
        industry: "金融服务",
      });

      expect(updated.legalName).toBe("ABC科技有限公司");
      expect(updated.registrationCode).toBe("91110000MA01234567");
      expect(updated.industry).toBe("金融服务");
    });

    it("应该更新多个字段", () => {
      const original = TenantProfile.create({
        legalName: "ABC科技有限公司",
        registrationCode: "91110000MA01234567",
        industry: "信息技术",
      });

      const updated = original.update({
        legalName: "XYZ科技有限公司",
        industry: "金融服务",
      });

      expect(updated.legalName).toBe("XYZ科技有限公司");
      expect(updated.registrationCode).toBe("91110000MA01234567");
      expect(updated.industry).toBe("金融服务");
    });

    it("应该将字段设置为 null", () => {
      const original = TenantProfile.create({
        legalName: "ABC科技有限公司",
        registrationCode: "91110000MA01234567",
        industry: "信息技术",
      });

      const updated = original.update({
        industry: null,
      });

      expect(updated.legalName).toBe("ABC科技有限公司");
      expect(updated.registrationCode).toBe("91110000MA01234567");
      expect(updated.industry).toBeNull();
    });

    it("应该创建新实例而不是修改原实例", () => {
      const original = TenantProfile.create({
        legalName: "ABC科技有限公司",
        industry: "信息技术",
      });

      const updated = original.update({
        industry: "金融服务",
      });

      expect(original.industry).toBe("信息技术");
      expect(updated.industry).toBe("金融服务");
      expect(original).not.toBe(updated);
    });
  });
});
