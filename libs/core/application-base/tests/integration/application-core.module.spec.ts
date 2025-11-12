import { CallHandler, ExecutionContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { of, lastValueFrom } from "rxjs";
import { AbilityBuilder, PureAbility } from "@casl/ability";
import {
  ABILITY_SERVICE_TOKEN,
  AUDIT_SERVICE_TOKEN,
} from "../../src/interfaces/tokens.js";
import type { AbilityService } from "../../src/interfaces/ability-service.interface.js";
import type {
  AuditService,
  AuditRecord,
} from "../../src/interfaces/audit-service.interface.js";
import type { SecurityContext } from "../../src/interfaces/security-context.js";
import { ApplicationCoreModule } from "../../src/application-core.module.js";
import { CaslAbilityCoordinator } from "../../src/casl/casl-ability-coordinator.js";
import { AuditCoordinator } from "../../src/audit/audit-coordinator.js";
import { AuditCommandInterceptor } from "../../src/audit/audit-command.interceptor.js";
import { AuditQueryInterceptor } from "../../src/audit/audit-query.interceptor.js";

class TestAbilityService implements AbilityService {
  public async resolveAbility(): Promise<PureAbility<[string, unknown]>> {
    const builder = new AbilityBuilder(PureAbility);
    builder.can("manage", "MuteUserCommand");
    builder.can("read", "FetchUserQuery");
    return builder.build();
  }
}

class TestAuditService implements AuditService {
  public records: AuditRecord[] = [];

  public async append(
    context: SecurityContext,
    record: AuditRecord,
  ): Promise<void> {
    this.records.push({
      ...record,
      tenantId: context.tenantId,
      userId: context.userId,
    });
  }
}

const securityContext: SecurityContext = {
  tenantId: "tenant-100",
  userId: "user-200",
};

describe("ApplicationCoreModule integration", () => {
  it("registers coordinators and interceptors", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ApplicationCoreModule.register({
          abilityService: {
            provide: ABILITY_SERVICE_TOKEN,
            useClass: TestAbilityService,
          },
          auditService: {
            provide: AUDIT_SERVICE_TOKEN,
            useClass: TestAuditService,
          },
        }),
      ],
    }).compile();

    const abilityCoordinator = moduleRef.get(CaslAbilityCoordinator);
    const auditCoordinator = moduleRef.get(AuditCoordinator);
    const auditService = moduleRef.get<TestAuditService>(AUDIT_SERVICE_TOKEN);

    await abilityCoordinator.ensureAuthorized(securityContext, {
      action: "manage",
      subject: "MuteUserCommand",
    });

    await auditCoordinator.record(securityContext, {
      tenantId: securityContext.tenantId,
      userId: securityContext.userId,
      action: "MuteUserCommand",
    });

    expect(auditService.records).toHaveLength(1);
  });

  it("writes audit records through interceptors", async () => {
    const auditService = new TestAuditService();
    const auditCoordinator = new AuditCoordinator(auditService);
    const commandInterceptor = new AuditCommandInterceptor(auditCoordinator);
    const queryInterceptor = new AuditQueryInterceptor(auditCoordinator);

    const commandContext = createHttpContext({
      securityContext,
      body: { id: "payload" },
    });
    await lastValueFrom(
      commandInterceptor.intercept(commandContext, { handle: () => of("ok") }),
    );

    const queryContext = createHttpContext({
      securityContext,
      query: { keyword: "test" },
    });
    await lastValueFrom(
      queryInterceptor.intercept(queryContext, { handle: () => of("ok") }),
    );

    expect(auditService.records).toHaveLength(2);
  });
});

const createHttpContext = (
  request: Record<string, unknown>,
): ExecutionContext => {
  return {
    getClass: () => ({}),
    getHandler: () => ({ name: "TestHandler" }),
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    switchToRpc: () => ({ getData: () => ({}), getContext: () => ({}) }),
    switchToWs: () => ({
      getClient: () => ({}),
      getData: () => ({}),
      getPattern: () => ({}),
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
  } as ExecutionContext;
};
