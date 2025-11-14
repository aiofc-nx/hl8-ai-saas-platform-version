import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type {
  ArgumentsHost,
  ExecutionContext,
  HttpArgumentsHost,
} from "@nestjs/common";
import { GeneralBadRequestException } from "@hl8/exceptions";
import { Reflector } from "@nestjs/core";
import type { AbilityDescriptor } from "../../src/casl/ability-descriptor.js";
import { CaslAbilityCoordinator } from "../../src/casl/casl-ability-coordinator.js";
import { CaslAbilityGuard } from "../../src/casl/casl-ability.guard.js";
import type { SecurityContext } from "../../src/interfaces/security-context.js";

const createExecutionContext = (
  request: Record<string, unknown>,
): ExecutionContext => {
  const httpContext: HttpArgumentsHost = {
    getRequest: () => request,
    getResponse: () => ({}),
    getNext: () => ({}),
  };

  const context: Partial<ExecutionContext> = {
    switchToHttp: () => httpContext,
    getHandler: () => ({}),
    getClass: () => ({}),
  };

  return context as ExecutionContext;
};

describe("CaslAbilityGuard", () => {
  let guard: CaslAbilityGuard;
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const abilityCoordinator = {
    ensureAuthorized: jest.fn().mockResolvedValue(undefined),
  } as unknown as CaslAbilityCoordinator;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new CaslAbilityGuard(reflector, abilityCoordinator);
  });

  it("allows request when no ability metadata is defined", async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const canActivate = await guard.canActivate(createExecutionContext({}));

    expect(canActivate).toBe(true);
    expect(abilityCoordinator.ensureAuthorized).not.toHaveBeenCalled();
  });

  it("throws when security context is missing", async () => {
    const descriptor: AbilityDescriptor = {
      action: "manage",
      subject: "Tenant",
    };
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(descriptor);

    await expect(
      guard.canActivate(createExecutionContext({})),
    ).rejects.toBeInstanceOf(GeneralBadRequestException);

    expect(abilityCoordinator.ensureAuthorized).not.toHaveBeenCalled();
  });

  it("delegates authorization to coordinator when context present", async () => {
    const descriptor: AbilityDescriptor = {
      action: "manage",
      subject: "Tenant",
    };
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(descriptor);
    const securityContext: SecurityContext = {
      tenantId: "tenant-1",
      userId: "user-1",
    };

    const result = await guard.canActivate(
      createExecutionContext({ securityContext }),
    );

    expect(result).toBe(true);
    expect(abilityCoordinator.ensureAuthorized).toHaveBeenCalledWith(
      securityContext,
      descriptor,
    );
  });
});
