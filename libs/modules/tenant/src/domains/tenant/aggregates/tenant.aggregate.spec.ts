/**
 * @fileoverview 租户聚合根单元测试
 * @description 测试租户聚合根的创建、状态转移和业务规则
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { DomainException, UserId, OrganizationId } from "@hl8/domain-base";
import { TenantAggregate } from "./tenant.aggregate.js";
import { TenantName } from "../value-objects/tenant-name.vo.js";
import { TenantContactInfo } from "../value-objects/tenant-contact-info.vo.js";
import { TenantContext } from "../value-objects/tenant-context.vo.js";
import { TenantProfile } from "../entities/tenant-profile.entity.js";
import {
  TenantStatus,
  TenantStatusEnum,
} from "../value-objects/tenant-status.vo.js";
import {
  TenantCreatedEvent,
  TenantActivatedEvent,
  TenantSuspendedEvent,
  TenantArchivedEvent,
  TenantProfileUpdatedEvent,
} from "../events/index.js";

describe("TenantAggregate", () => {
  let tenantName: TenantName;
  let contactInfo: TenantContactInfo;
  let context: TenantContext;
  let userId: UserId;

  beforeEach(() => {
    tenantName = TenantName.create("ABC公司");
    contactInfo = TenantContactInfo.create({
      contactName: "张三",
      email: "zhangsan@example.com",
      phone: "+86-13800138000",
    });
    const orgId = OrganizationId.create("org-123");
    context = TenantContext.create({
      defaultOrganizationId: orgId,
      defaultTimezone: "Asia/Shanghai",
      currency: "CNY",
    });
    userId = UserId.create("user-123");
  });

  describe("create", () => {
    it("应该成功创建租户聚合根", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      expect(tenant).toBeDefined();
      expect(tenant.id).toBeDefined();
      expect(tenant.tenantName).toBe(tenantName);
      expect(tenant.contactInfo).toBe(contactInfo);
      expect(tenant.context).toBe(context);
      expect(tenant.status).toBe(TenantStatus.Initialized);
      expect(tenant.version).toBe(0);
    });

    it("应该创建初始状态为 Initialized 的租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
      });

      expect(tenant.status.isInitialized()).toBe(true);
    });

    it("应该创建默认的租户档案", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
      });

      expect(tenant.profile).toBeDefined();
      expect(tenant.profile.legalName).toBeNull();
    });

    it("应该接受自定义的租户档案", () => {
      const profile = TenantProfile.create({
        legalName: "ABC科技有限公司",
        industry: "信息技术",
      });

      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        profile,
      });

      expect(tenant.profile.legalName).toBe("ABC科技有限公司");
      expect(tenant.profile.industry).toBe("信息技术");
    });

    it("应该触发 TenantCreatedEvent 事件", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      const events = tenant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TenantCreatedEvent);
    });

    it("应该在没有 createdBy 时也能创建", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
      });

      expect(tenant).toBeDefined();
      expect(tenant.status.isInitialized()).toBe(true);
    });
  });

  describe("activate", () => {
    it("应该从 Initialized 状态激活租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.activate(userId);

      expect(tenant.status.isActive()).toBe(true);
    });

    it("应该从 Suspended 状态激活租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.activate(userId);
      tenant.deactivate(userId);
      tenant.activate(userId);

      expect(tenant.status.isActive()).toBe(true);
    });

    it("应该拒绝从 Active 状态激活租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.activate(userId);

      expect(() => tenant.activate(userId)).toThrow(DomainException);
      expect(() => tenant.activate(userId)).toThrow("不能激活");
    });

    it("应该拒绝从 Archived 状态激活租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.archive(userId);

      expect(() => tenant.activate(userId)).toThrow(DomainException);
      expect(() => tenant.activate(userId)).toThrow("已归档的租户不能激活");
    });

    it("应该触发 TenantActivatedEvent 事件", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.pullDomainEvents(); // 清除创建事件

      tenant.activate(userId);

      const events = tenant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TenantActivatedEvent);
    });

    it("应该在没有 initiator 时也能激活", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
      });

      tenant.activate(null);

      expect(tenant.status.isActive()).toBe(true);
    });
  });

  describe("deactivate", () => {
    it("应该从 Active 状态停用租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.activate(userId);
      tenant.deactivate(userId);

      expect(tenant.status.isSuspended()).toBe(true);
    });

    it("应该拒绝从 Initialized 状态停用租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      expect(() => tenant.deactivate(userId)).toThrow(DomainException);
      expect(() => tenant.deactivate(userId)).toThrow("不能停用");
    });

    it("应该拒绝从 Suspended 状态停用租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.activate(userId);
      tenant.deactivate(userId);

      expect(() => tenant.deactivate(userId)).toThrow(DomainException);
    });

    it("应该拒绝从 Archived 状态停用租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.archive(userId);

      expect(() => tenant.deactivate(userId)).toThrow(DomainException);
      expect(() => tenant.deactivate(userId)).toThrow("已归档的租户不能停用");
    });

    it("应该触发 TenantSuspendedEvent 事件", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.activate(userId);
      tenant.pullDomainEvents(); // 清除之前的事件

      tenant.deactivate(userId);

      const events = tenant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TenantSuspendedEvent);
    });
  });

  describe("archive", () => {
    it("应该从 Initialized 状态归档租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.archive(userId);

      expect(tenant.status.isArchived()).toBe(true);
      expect(tenant.softDeleteStatus.isDeleted).toBe(true);
    });

    it("应该从 Active 状态归档租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.activate(userId);
      tenant.archive(userId);

      expect(tenant.status.isArchived()).toBe(true);
    });

    it("应该从 Suspended 状态归档租户", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.activate(userId);
      tenant.deactivate(userId);
      tenant.archive(userId);

      expect(tenant.status.isArchived()).toBe(true);
    });

    it("应该触发 TenantArchivedEvent 事件", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.pullDomainEvents(); // 清除创建事件

      tenant.archive(userId);

      const events = tenant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TenantArchivedEvent);
    });
  });

  describe("updateProfile", () => {
    it("应该成功更新租户档案", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.updateProfile({
        legalName: "ABC科技有限公司",
        registrationCode: "91110000MA01234567",
        industry: "信息技术",
        updatedBy: userId,
      });

      expect(tenant.profile.legalName).toBe("ABC科技有限公司");
      expect(tenant.profile.registrationCode).toBe("91110000MA01234567");
      expect(tenant.profile.industry).toBe("信息技术");
    });

    it("应该拒绝更新已归档租户的档案", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.archive(userId);

      expect(() =>
        tenant.updateProfile({
          legalName: "ABC科技有限公司",
          updatedBy: userId,
        }),
      ).toThrow(DomainException);
      expect(() =>
        tenant.updateProfile({
          legalName: "ABC科技有限公司",
          updatedBy: userId,
        }),
      ).toThrow("已归档的租户不能更新档案");
    });

    it("应该触发 TenantProfileUpdatedEvent 事件", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.pullDomainEvents(); // 清除创建事件

      tenant.updateProfile({
        legalName: "ABC科技有限公司",
        updatedBy: userId,
      });

      const events = tenant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TenantProfileUpdatedEvent);
    });

    it("应该支持部分更新档案", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      tenant.updateProfile({
        legalName: "ABC科技有限公司",
        updatedBy: userId,
      });

      expect(tenant.profile.legalName).toBe("ABC科技有限公司");
      expect(tenant.profile.registrationCode).toBeNull();
    });
  });

  describe("状态转移流程", () => {
    it("应该支持完整的生命周期流程", () => {
      const tenant = TenantAggregate.create({
        tenantName,
        contactInfo,
        context,
        createdBy: userId,
      });

      expect(tenant.status.isInitialized()).toBe(true);

      tenant.activate(userId);
      expect(tenant.status.isActive()).toBe(true);

      tenant.deactivate(userId);
      expect(tenant.status.isSuspended()).toBe(true);

      tenant.activate(userId);
      expect(tenant.status.isActive()).toBe(true);

      tenant.archive(userId);
      expect(tenant.status.isArchived()).toBe(true);
    });
  });
});
