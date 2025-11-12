import { SetMetadata } from "@nestjs/common";
import type { AbilityDescriptor } from "./ability-descriptor.js";

/**
 * @public
 * @description CASL 能力元数据键。
 */
export const CASL_ABILITY_METADATA = "casl:ability";

/**
 * @public
 * @description 标记控制器或处理器所需的 CASL 能力。
 * @param descriptor - 权限描述。
 */
export const RequireAbility = (descriptor: AbilityDescriptor) =>
  SetMetadata(CASL_ABILITY_METADATA, descriptor);
