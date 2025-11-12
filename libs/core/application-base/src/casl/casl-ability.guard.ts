import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GeneralBadRequestException } from "@hl8/exceptions";
import type { AbilityDescriptor } from "./ability-descriptor.js";
import { CaslAbilityCoordinator } from "./casl-ability-coordinator.js";
import { CASL_ABILITY_METADATA } from "./require-ability.decorator.js";
import {
  assertSecurityContext,
  type SecurityContext,
} from "../interfaces/security-context.js";

/**
 * @public
 * @description 基于 CASL 的通用守卫，校验控制器方法所需的权限。
 */
@Injectable()
export class CaslAbilityGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly abilityCoordinator: CaslAbilityCoordinator,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const descriptor = this.reflectAbilityDescriptor(context);
    if (!descriptor) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      securityContext?: SecurityContext;
      user?: { securityContext?: SecurityContext };
    }>();
    const securityContext =
      request?.securityContext ?? request?.user?.securityContext;
    if (!securityContext) {
      throw new GeneralBadRequestException({
        field: "securityContext",
        message: "缺少安全上下文，无法执行权限校验",
      });
    }

    await this.abilityCoordinator.ensureAuthorized(
      assertSecurityContext(securityContext),
      descriptor,
    );
    return true;
  }

  private reflectAbilityDescriptor(
    context: ExecutionContext,
  ): AbilityDescriptor | undefined {
    return this.reflector.getAllAndOverride<AbilityDescriptor | undefined>(
      CASL_ABILITY_METADATA,
      [context.getHandler(), context.getClass()],
    );
  }
}
