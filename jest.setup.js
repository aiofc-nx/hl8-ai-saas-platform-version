// Jest 全局设置文件
// 用于配置测试环境的全局设置

// 导入 reflect-metadata 以支持装饰器
require("reflect-metadata");

// 设置测试超时时间
jest.setTimeout(10000);

// 确保 jest 在全局范围内可用
if (typeof global.jest === "undefined") {
  global.jest = jest;
}

// 全局测试配置
global.console = {
  ...console,
  // 在测试中禁用 console.log，除非明确需要
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
