import { Module, DynamicModule, Provider } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { CaslAbilityCoordinator } from "./casl/casl-ability-coordinator.js";
import { AuditCoordinator } from "./audit/audit-coordinator.js";
import { AuditCommandInterceptor } from "./audit/audit-command.interceptor.js";
import { AuditQueryInterceptor } from "./audit/audit-query.interceptor.js";
import {
  ABILITY_SERVICE_TOKEN,
  AUDIT_SERVICE_TOKEN,
} from "./interfaces/tokens.js";

/**
 * @public
 * @description `ApplicationCoreModule` 注册选项。
 */
export interface ApplicationCoreModuleOptions {
  /**
   * @description 权限服务提供者（必须 provide 为 `ABILITY_SERVICE_TOKEN`）。
   */
  readonly abilityService?: Provider;
  /**
   * @description 审计服务提供者（必须 provide 为 `AUDIT_SERVICE_TOKEN`）。
   */
  readonly auditService?: Provider;
  /**
   * @description 额外需要注册的应用层提供者。
   */
  readonly extraProviders?: Provider[];
}

/**
 * @public
 * @description 应用层核心模块，集中注册命令/查询基线能力。
 */
@Module({})
export class ApplicationCoreModule {
  /**
   * @description 注册应用层核心能力。
   * @param options - 模块配置。
   */
  public static register(
    options: ApplicationCoreModuleOptions = {},
  ): DynamicModule {
    const providers: Provider[] = [
      CaslAbilityCoordinator,
      AuditCoordinator,
      AuditCommandInterceptor,
      AuditQueryInterceptor,
    ];

    if (options.abilityService) {
      providers.push(options.abilityService);
    }
    if (options.auditService) {
      providers.push(options.auditService);
    }
    if (options.extraProviders?.length) {
      providers.push(...options.extraProviders);
    }

    return {
      module: ApplicationCoreModule,
      imports: [CqrsModule],
      providers,
      exports: [
        CaslAbilityCoordinator,
        AuditCoordinator,
        AuditCommandInterceptor,
        AuditQueryInterceptor,
        ABILITY_SERVICE_TOKEN,
        AUDIT_SERVICE_TOKEN,
      ],
    };
  }
}
