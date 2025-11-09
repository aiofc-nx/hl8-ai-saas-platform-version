/**
 * 导入工具
 *
 * @description 提供配置模块所需的导入工具
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

import { plainToClass } from "class-transformer";
import { validateSync } from "class-validator";

/**
 * 导出验证同步函数
 * @description 从 class-validator 导出的验证同步函数
 */
export { validateSync };

/**
 * 导出普通对象转类函数
 * @description 从 class-transformer 导出的普通对象转类函数
 */
export { plainToClass };
