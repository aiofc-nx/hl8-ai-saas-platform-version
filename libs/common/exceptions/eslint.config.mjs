import libsSharedConfig from "../../eslint.package.config.mjs";

/**
 * libs 子包复用统一的 ESLint 配置，后续如需特化可在此处追加规则数组。
 */
export default [...libsSharedConfig];
