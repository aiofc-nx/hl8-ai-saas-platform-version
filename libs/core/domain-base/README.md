# @hl8/domain-base

`@hl8/domain-base` 提供聚合根、实体、值对象、领域事件与守卫工具等领域层基线能力，支撑多租户 SaaS 平台快速构建一致的领域模型。包源码位于 `libs/core/domain-base/`。

## 功能概览

- 聚合根基类：内置租户/组织/部门断言、审计轨迹、软删除状态与领域事件队列。
- 值对象集合：聚合标识、租户/组织/部门/用户标识、日期时间、审计与软删除值对象。
- 守卫与工具：统一的 UUID 生成器与断言函数，保持领域层纯净。
- 文档即代码：所有公共 API 提供中文 TSDoc（含 `@description`、`@example` 等标签），确保领域语义一致。
- 测试基座：通过 `@hl8/domain-testing` 提供聚合测试支撑。

## 使用方式

```ts
import { AggregateId, AggregateRootBase, AggregateRootProps, TenantId, AuditTrail, SoftDeleteStatus } from "@hl8/domain-base";

class TenantAggregate extends AggregateRootBase<AggregateId> {
  private constructor(props: AggregateRootProps<AggregateId>) {
    super(props);
    this.ensureValidState();
  }

  protected ensureValidState(): void {
    // 校验聚合不变式
  }

  public static create(props: AggregateRootProps<AggregateId>): TenantAggregate {
    return new TenantAggregate(props);
  }
}

const tenant = TenantAggregate.create({
  id: AggregateId.generate(),
  tenantId: TenantId.create("tenant_x"),
  auditTrail: AuditTrail.create({ createdBy: null }),
  softDeleteStatus: SoftDeleteStatus.create(),
});
```

所有公共 API 均提供中文 TSDoc 注释，确保跨团队共享统一领域语言。
