/**
 * 配置加载器
 *
 * 提供各种配置加载器的统一入口，支持文件系统、环境变量、远程服务等多种配置源。
 * 提供完整的配置加载功能，包括文件加载、环境变量加载、远程加载等。
 *
 * @description 此模块是配置加载器的统一入口，提供各种类型的配置加载器。
 * 支持同步和异步配置加载，提供完整的错误处理和配置验证。
 * 遵循配置加载器设计模式，提供统一的加载器接口和实现。
 *
 * ## 业务规则
 *
 * ### 加载器类型规则
 * - 文件加载器：支持 JSON、YAML 格式的本地配置文件
 * - 环境变量加载器：支持 .env 文件和系统环境变量
 * - 远程加载器：支持从远程 API 和配置服务加载配置
 * - 目录加载器：支持从目录中批量加载配置文件
 *
 * ### 加载器组合规则
 * - 支持多个加载器的链式调用
 * - 后续加载器的配置会覆盖前面的配置
 * - 支持同步和异步加载器混合使用
 * - 配置加载失败时会抛出详细的错误信息
 *
 * ### 配置合并规则
 * - 使用深度合并策略合并多个配置源
 * - 支持嵌套对象的配置合并
 * - 支持数组配置的合并和覆盖
 * - 配置合并失败时会抛出合并错误
 *
 * ## 业务逻辑流程
 *
 * 1. **加载器选择**：根据配置源选择合适的加载器
 * 2. **配置加载**：执行配置加载器获取原始配置
 * 3. **配置解析**：解析配置内容并转换为配置对象
 * 4. **配置合并**：合并多个配置源的结果
 * 5. **配置验证**：验证配置的格式和完整性
 * 6. **配置返回**：返回处理后的配置对象
 *
 * @example
 * ```typescript
 * import { fileLoader, dotenvLoader, remoteLoader } from '@hl8/config';
 *
 * // 文件加载器
 * const fileConfigLoader = fileLoader({ path: './config/app.yml' });
 *
 * // 环境变量加载器
 * const envConfigLoader = dotenvLoader({ separator: '__' });
 *
 * // 远程加载器
 * const remoteConfigLoader = remoteLoader('http://config-server/api/config');
 *
 * // 组合使用
 * const config = [
 *   fileConfigLoader,
 *   envConfigLoader,
 *   remoteConfigLoader
 * ];
 * ```
 */

// 文件加载器
export { fileLoader } from "./file.loader.js";

// 环境变量加载器
export { dotenvLoader } from "./dotenv.loader.js";

// 远程加载器
export { remoteLoader } from "./remote.loader.js";

// 目录加载器
export { directoryLoader } from "./directory.loader.js";
