import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const resolveImportMetaUrl = (): string | undefined => {
  try {
    return Function("return import.meta.url")() as string;
  } catch {
    return undefined;
  }
};

const resolveModuleDir = (): string => {
  if (typeof __dirname === "string") {
    return __dirname;
  }
  const metaUrl = resolveImportMetaUrl();
  if (metaUrl) {
    return path.dirname(fileURLToPath(metaUrl));
  }
  return process.cwd();
};

const moduleDir = resolveModuleDir();
const packageRootDir = path.resolve(moduleDir, "..", "..");
const requireModule = createRequire(
  path.resolve(packageRootDir, "package.json"),
);

let redlockExports: Record<string, unknown>;
try {
  redlockExports = requireModule("@anchan828/nest-redlock");
} catch {
  const candidates = [
    path.resolve(moduleDir, "../testing/redlock.mock.cjs"),
    path.resolve(moduleDir, "../testing/redlock.mock.js"),
    path.resolve(packageRootDir, "src/testing/redlock.mock.cjs"),
    path.resolve(process.cwd(), "src/testing/redlock.mock.cjs"),
    path.resolve(
      process.cwd(),
      "libs/infra/cache/src/testing/redlock.mock.cjs",
    ),
  ];
  const fallbackPath = candidates.find((candidate) => existsSync(candidate));
  if (!fallbackPath) {
    throw new Error("无法解析 Redlock 桩模块文件，请检查测试依赖。");
  }
  redlockExports = requireModule(fallbackPath);
}

/**
 * @description 导出 Redlock 模块与服务，优先引用真实依赖，缺省时退回测试桩。
 */
export const { RedlockModule, RedlockService } = redlockExports as {
  RedlockModule: typeof import("@anchan828/nest-redlock").RedlockModule;
  RedlockService: typeof import("@anchan828/nest-redlock").RedlockService;
};
