import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  GeneralForbiddenException,
  MissingConfigurationForFeatureException,
} from "@hl8/exceptions";
import { subject as buildSubject } from "@casl/ability";
import type { AbilityDescriptor } from "./ability-descriptor.js";
import type {
  AbilityService,
  ApplicationAbility,
} from "../interfaces/ability-service.interface.js";
import type { SecurityContext } from "../interfaces/security-context.js";
import { ABILITY_SERVICE_TOKEN } from "../interfaces/tokens.js";

/**
 * @public
 * @description 封装 CASL 权限判定的协调器，统一校验命令与查询执行权限。
 */
@Injectable()
export class CaslAbilityCoordinator {
  public constructor(
    @Optional()
    @Inject(ABILITY_SERVICE_TOKEN)
    private readonly abilityService?: AbilityService,
  ) {}

  /**
   * @description 校验当前上下文是否拥有执行指定动作的权限。
   * @param context - 安全上下文。
   * @param descriptor - 权限需求描述。
   * @throws {MissingConfigurationForFeatureException}
   * 当未提供权限服务实现时抛出。
   * @throws {GeneralForbiddenException}
   * 当权限不足时抛出。
   */
  public async ensureAuthorized(
    context: SecurityContext,
    descriptor: AbilityDescriptor,
  ): Promise<void> {
    const ability = await this.resolveAbility(context);
    const { action, subject: subjectName, conditions } = descriptor;
    const target = conditions
      ? (buildSubject(subjectName, conditions) as unknown)
      : subjectName;
    const authorized = ability.can(action, target as never);
    if (!authorized) {
      throw new GeneralForbiddenException(
        `权限不足，缺少对 ${subjectName} 的 ${action} 权限`,
      );
    }
  }

  /**
   * @description 刷新缓存的 CASL 能力，当权限发生变更时调用。
   * @param context - 安全上下文。
   */
  public async refreshAbility(context: SecurityContext): Promise<void> {
    const service = this.getAbilityService();
    if (service.refreshAbility) {
      await service.refreshAbility(context);
    }
  }

  private async resolveAbility(
    context: SecurityContext,
  ): Promise<ApplicationAbility> {
    const service = this.getAbilityService();
    return service.resolveAbility(context);
  }

  private getAbilityService(): AbilityService {
    if (!this.abilityService) {
      throw new MissingConfigurationForFeatureException(
        "@hl8/application-base 缺少 AbilityService 提供者，请通过 ApplicationCoreModule.register 提供实现",
      );
    }
    return this.abilityService;
  }
}
