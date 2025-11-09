# 开发环境 Redis 内存占位备忘

## 背景

- 本地网络暂时无法访问真实 Redis 服务，导致 Fastify 应用在启动阶段抛出 `Redis 客户端连接失败`。
- `CacheClientProvider` 原生支持在缺少 `REDIS_CLIENTS` 注入时自动回落到内存 Map 实现，但构建阶段仍会尝试连接真实 Redis。

## 临时方案

- 通过新增配置开关 `CacheConfig.useMemoryFallback`，允许在引导阶段跳过真实 Redis 连接与 Redlock 初始化。
- 当设置环境变量 `CACHE_REDIS_USE_MEMORY=true`（或 `CACHE_USE_MEMORY_FALLBACK=true`）后：
  - `createRedisClients` 直接返回 `undefined`，触发 `CacheClientProvider` 的内存占位逻辑。
  - `createRedlock` 同样返回 `undefined`，`CacheConsistencyService` 会自动切换到 Mock Redlock。
  - 应用可以在无 Redis 环境下继续开发与调试。

## 使用指引

1. 在应用启动前导出环境变量：
   - Linux/macOS: `export CACHE_REDIS_USE_MEMORY=true`
   - Windows PowerShell: `setx CACHE_REDIS_USE_MEMORY true`
2. 重新运行 `pnpm run start`，观察日志应出现：
   - `已启用内存缓存占位，跳过 Redis 客户端连接`
   - `分布式锁服务未注册，已降级为内存锁实现`
3. 业务代码仍可通过 `CacheClientProvider` / `CacheConsistencyService` 正常工作，只是使用内存 Map 模拟 Redis。

## 恢复真实 Redis

- 移除上述环境变量或将其设置为 `false`。
- 确保本地 Docker Compose 中的 `redis` 服务启动后，再执行 `pnpm run start` 验证连接。

## 注意事项

- 内存占位实现仅用于开发/测试环境，不具备持久化与分布式锁语义。
- 当切换回真实 Redis 时，需要重新校验缓存一致性与锁竞争逻辑。
