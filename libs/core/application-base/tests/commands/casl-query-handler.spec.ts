import { PureAbility } from "@casl/ability";
import { GeneralForbiddenException } from "@hl8/exceptions";
import type { SecurityContext } from "../../src/interfaces/security-context.js";
import type { AuditService } from "../../src/interfaces/audit-service.interface.js";
import { CaslAbilityCoordinator } from "../../src/casl/casl-ability-coordinator.js";
import { AuditCoordinator } from "../../src/audit/audit-coordinator.js";
import { CaslQueryBase } from "../../src/cqrs/queries/casl-query.base.js";
import { CaslQueryHandler } from "../../src/cqrs/queries/casl-query-handler.base.js";

const context: SecurityContext = {
  tenantId: "tenant-1",
  userId: "user-1",
};

class AllowQueryAbilityService {
  public async resolveAbility(): Promise<
    PureAbility<[string, string], Record<string, unknown>>
  > {
    return new PureAbility<[string, string], Record<string, unknown>>([
      { action: "read", subject: "FindUserQuery" },
    ]);
  }
}

class DenyQueryAbilityService {
  public async resolveAbility(): Promise<
    PureAbility<[string, string], Record<string, unknown>>
  > {
    return new PureAbility<[string, string], Record<string, unknown>>([]);
  }
}

class MemoryAuditService {
  public records: string[] = [];

  public async append(
    _context: SecurityContext,
    _record: Record<string, unknown>,
  ): Promise<void> {
    this.records.push("recorded");
  }
}

class FindUserQuery extends CaslQueryBase<{ id: string }> {
  public constructor(
    context: SecurityContext,
    public readonly payload: { id: string },
  ) {
    super(context);
  }

  public abilityDescriptor() {
    return { action: "read", subject: FindUserQuery.name };
  }

  public override auditPayload(): Record<string, unknown> {
    return this.payload;
  }
}

class FindUserQueryHandler extends CaslQueryHandler<
  FindUserQuery,
  { id: string }
> {
  public constructor(
    abilityCoordinator: CaslAbilityCoordinator,
    auditCoordinator: AuditCoordinator,
  ) {
    super(abilityCoordinator, auditCoordinator);
  }

  protected async handle(query: FindUserQuery): Promise<{ id: string }> {
    this.assertTenantScope(query, context.tenantId);
    return { id: query.payload.id };
  }
}

describe("CaslQueryHandler", () => {
  it("允许权限通过时返回结果并审计", async () => {
    const auditService = new MemoryAuditService();
    const handler = new FindUserQueryHandler(
      new CaslAbilityCoordinator(new AllowQueryAbilityService()),
      new AuditCoordinator(auditService as unknown as AuditService),
    );

    const result = await handler.execute(
      new FindUserQuery(context, { id: "user-1" }),
    );

    expect(result.id).toBe("user-1");
    expect(auditService.records).toHaveLength(1);
  });

  it("权限不足时抛出 GeneralForbiddenException", async () => {
    const handler = new FindUserQueryHandler(
      new CaslAbilityCoordinator(new DenyQueryAbilityService()),
      new AuditCoordinator(new MemoryAuditService() as unknown as AuditService),
    );

    await expect(
      handler.execute(new FindUserQuery(context, { id: "user-1" })),
    ).rejects.toBeInstanceOf(GeneralForbiddenException);
  });
});
