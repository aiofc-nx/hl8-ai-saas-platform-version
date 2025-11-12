import { PureAbility } from "@casl/ability";
import { GeneralForbiddenException } from "@hl8/exceptions";
import type { SecurityContext } from "../../src/interfaces/security-context.js";
import type { AuditService } from "../../src/interfaces/audit-service.interface.js";
import { CaslAbilityCoordinator } from "../../src/casl/casl-ability-coordinator.js";
import { AuditCoordinator } from "../../src/audit/audit-coordinator.js";
import { CaslCommandBase } from "../../src/cqrs/commands/casl-command.base.js";
import { CaslCommandHandler } from "../../src/cqrs/commands/casl-command-handler.base.js";

class StubAbilityService implements AbilityService {
  public constructor(private readonly allow: boolean) {}

  public async resolveAbility(): Promise<
    PureAbility<[string, string], Record<string, unknown>>
  > {
    if (this.allow) {
      return new PureAbility<[string, string], Record<string, unknown>>([
        { action: "manage", subject: "AssignRoleCommand" },
      ]);
    }
    return new PureAbility<[string, string], Record<string, unknown>>([]);
  }
}

class InMemoryAuditService {
  public records: Array<{ action: string; payload?: Record<string, unknown> }> =
    [];

  public async append(
    _context: SecurityContext,
    record: { action: string; payload?: Record<string, unknown> },
  ): Promise<void> {
    this.records.push(record);
  }
}

class AssignRoleCommand extends CaslCommandBase<void> {
  public constructor(
    context: SecurityContext,
    public readonly payload: { tenantId: string; roleId: string },
  ) {
    super(context);
  }

  public abilityDescriptor() {
    return { action: "manage", subject: AssignRoleCommand.name };
  }

  public override auditPayload() {
    return this.payload;
  }
}

class AssignRoleCommandHandler extends CaslCommandHandler<
  AssignRoleCommand,
  void
> {
  public constructor(
    abilityCoordinator: CaslAbilityCoordinator,
    auditCoordinator: AuditCoordinator,
  ) {
    super(abilityCoordinator, auditCoordinator);
  }

  protected async handle(command: AssignRoleCommand): Promise<void> {
    this.assertTenantScope(command, command.payload.tenantId);
  }
}

const securityContext: SecurityContext = {
  tenantId: "tenant-1",
  userId: "user-1",
};

describe("CaslCommandHandler", () => {
  it("允许权限通过时执行命令并写入审计", async () => {
    const abilityService = new StubAbilityService(true);
    const auditService = new InMemoryAuditService();
    const handler = new AssignRoleCommandHandler(
      new CaslAbilityCoordinator(abilityService),
      new AuditCoordinator(auditService as unknown as AuditService),
    );

    await handler.execute(
      new AssignRoleCommand(securityContext, {
        tenantId: "tenant-1",
        roleId: "role",
      }),
    );

    expect(auditService.records).toHaveLength(1);
    expect(auditService.records[0]?.action).toBe("AssignRoleCommand");
  });

  it("权限不足时抛出 GeneralForbiddenException", async () => {
    const abilityService = new StubAbilityService(false);
    const auditService = new InMemoryAuditService();
    const handler = new AssignRoleCommandHandler(
      new CaslAbilityCoordinator(abilityService),
      new AuditCoordinator(auditService as unknown as AuditService),
    );

    await expect(
      handler.execute(
        new AssignRoleCommand(securityContext, {
          tenantId: "tenant-1",
          roleId: "role",
        }),
      ),
    ).rejects.toBeInstanceOf(GeneralForbiddenException);
    expect(auditService.records).toHaveLength(0);
  });
});
