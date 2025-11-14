import rootConfig from "../eslint.config.mjs";

/**
 * 统一 libs 子包的 ESLint 配置，复用根配置并提供默认忽略项。
 *
 * @remarks 若子包需要添加专属规则，可在局部配置文件追加新的对象以合并。
 */
const libsSharedConfig = [
  ...rootConfig,
  {
    // 忽略测试框架配置文件，避免影响业务规则校验。
    ignores: ["jest.config.ts"],
  },
];

export default libsSharedConfig;

