/**
 * @fileoverview 租户联系人信息值对象单元测试
 * @description 测试租户联系人信息值对象的创建、校验和业务规则
 */

import { describe, it, expect } from "@jest/globals";
import { DomainException } from "@hl8/domain-base";
import { TenantContactInfo } from "./tenant-contact-info.vo.js";

describe("TenantContactInfo", () => {
  describe("create", () => {
    it("应该成功创建有效的联系人信息（包含电话）", () => {
      const contactInfo = TenantContactInfo.create({
        contactName: "张三",
        email: "zhangsan@example.com",
        phone: "+86-13800138000",
      });

      expect(contactInfo.contactName).toBe("张三");
      expect(contactInfo.email).toBe("zhangsan@example.com");
      expect(contactInfo.phone).toBe("+86-13800138000");
    });

    it("应该成功创建有效的联系人信息（不包含电话）", () => {
      const contactInfo = TenantContactInfo.create({
        contactName: "李四",
        email: "lisi@example.com",
      });

      expect(contactInfo.contactName).toBe("李四");
      expect(contactInfo.email).toBe("lisi@example.com");
      expect(contactInfo.phone).toBeNull();
    });

    it("应该自动去除首尾空白字符", () => {
      const contactInfo = TenantContactInfo.create({
        contactName: "  张三  ",
        email: "  zhangsan@example.com  ",
        phone: "  +86-13800138000  ",
      });

      expect(contactInfo.contactName).toBe("张三");
      expect(contactInfo.email).toBe("zhangsan@example.com");
      expect(contactInfo.phone).toBe("+86-13800138000");
    });

    it("应该自动将邮箱转换为小写", () => {
      const contactInfo = TenantContactInfo.create({
        contactName: "张三",
        email: "ZHANGSAN@EXAMPLE.COM",
      });

      expect(contactInfo.email).toBe("zhangsan@example.com");
    });

    it("应该拒绝空的负责人姓名", () => {
      expect(() =>
        TenantContactInfo.create({
          contactName: "",
          email: "zhangsan@example.com",
        }),
      ).toThrow(DomainException);
    });

    it("应该拒绝空的邮箱", () => {
      expect(() =>
        TenantContactInfo.create({
          contactName: "张三",
          email: "",
        }),
      ).toThrow(DomainException);
    });

    it("应该拒绝无效的邮箱格式", () => {
      expect(() =>
        TenantContactInfo.create({
          contactName: "张三",
          email: "invalid-email",
        }),
      ).toThrow(DomainException);
      expect(() =>
        TenantContactInfo.create({
          contactName: "张三",
          email: "invalid-email",
        }),
      ).toThrow("邮箱格式不正确");
    });

    it("应该接受有效的邮箱格式", () => {
      const validEmails = [
        "user@example.com",
        "user.name@example.com",
        "user+tag@example.com",
        "user_name@example.co.uk",
      ];

      for (const email of validEmails) {
        const contactInfo = TenantContactInfo.create({
          contactName: "张三",
          email,
        });
        expect(contactInfo.email).toBe(email.toLowerCase());
      }
    });

    it("应该拒绝无效的电话格式", () => {
      expect(() =>
        TenantContactInfo.create({
          contactName: "张三",
          email: "zhangsan@example.com",
          phone: "13800138000", // 缺少国家代码
        }),
      ).toThrow(DomainException);
      expect(() =>
        TenantContactInfo.create({
          contactName: "张三",
          email: "zhangsan@example.com",
          phone: "13800138000",
        }),
      ).toThrow("电话格式不正确");
    });

    it("应该接受有效的国际电话格式", () => {
      const validPhones = [
        "+86-13800138000",
        "+1-5551234567",
        "+44-2012345678",
      ];

      for (const phone of validPhones) {
        const contactInfo = TenantContactInfo.create({
          contactName: "张三",
          email: "zhangsan@example.com",
          phone,
        });
        expect(contactInfo.phone).toBe(phone);
      }
    });

    it("应该接受 null 作为电话", () => {
      const contactInfo = TenantContactInfo.create({
        contactName: "张三",
        email: "zhangsan@example.com",
        phone: null,
      });

      expect(contactInfo.phone).toBeNull();
    });

    it("应该接受空字符串作为电话（视为无电话）", () => {
      const contactInfo = TenantContactInfo.create({
        contactName: "张三",
        email: "zhangsan@example.com",
        phone: "",
      });

      expect(contactInfo.phone).toBeNull();
    });
  });

  describe("hasPhone", () => {
    it("应该在有电话时返回 true", () => {
      const contactInfo = TenantContactInfo.create({
        contactName: "张三",
        email: "zhangsan@example.com",
        phone: "+86-13800138000",
      });

      expect(contactInfo.hasPhone()).toBe(true);
    });

    it("应该在无电话时返回 false", () => {
      const contactInfo = TenantContactInfo.create({
        contactName: "张三",
        email: "zhangsan@example.com",
      });

      expect(contactInfo.hasPhone()).toBe(false);
    });
  });
});
