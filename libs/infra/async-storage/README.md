# @hl8/async-storage

异步上下文存储模块，基于 `nestjs-cls` 为 NestJS 应用提供统一的请求级数据隔离能力，可快速获取请求 ID、租户信息等上下文数据。

## 功能特性

- **全局化配置**：`setupAsyncStorageModule` 默认启用全局中间件，自动生成请求 ID
- **便捷服务**：`AsyncStorageService` 封装常用 `set/get/run` 方法，降低直接依赖 `ClsService` 的复杂度
- **一致命名**：内置常量 `ASYNC_STORAGE_NAMESPACE`、`ASYNC_STORAGE_REQUEST_ID`，规范上下文键名
- **注入友好**：提供 `InjectAsyncStorage` 装饰器，保持依赖注入时的可读性

## 快速开始

```ts
import { Module } from "@nestjs/common";
import { setupAsyncStorageModule, AsyncStorageModule } from "@hl8/async-storage";

@Module({
  imports: [setupAsyncStorageModule(), AsyncStorageModule],
})
export class AppModule {}
```

在业务服务中使用：

```ts
import { Injectable } from "@nestjs/common";
import { AsyncStorageService, ASYNC_STORAGE_REQUEST_ID } from "@hl8/async-storage";

@Injectable()
export class UserService {
  constructor(private readonly asyncStorage: AsyncStorageService) {}

  getRequestId(): string | undefined {
    return this.asyncStorage.get<string>(ASYNC_STORAGE_REQUEST_ID);
  }
}
```

## TODO

- [ ] 增加对多租户场景的最佳实践示例
- [ ] 提供拦截器示例以自动写入业务上下文字段
