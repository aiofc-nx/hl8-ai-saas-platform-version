# @hl8/exceptions

统一的异常处理与文档化工具集，基于 RFC7807 规范提供一致的错误响应、异常过滤器与 Swagger 装饰器，方便快速集成到 NestJS 应用中。

## 功能特性

- **标准化响应**：通过 `AbstractHttpException` 与一系列通用异常类，统一错误结构与业务字段
- **统一过滤器**：封装 `AnyExceptionFilter`、`HttpExceptionFilter` 等过滤器，简化异常捕获流程
- **Swagger 集成**：提供 `ApiBadRequest`、`ApiEntityNotFound` 等装饰器，自动生成错误模型文档
- **零 i18n 依赖**：默认中文提示，支持自定义 detail、errorCode 与数据载荷

## 快速开始

```ts
import { AnyExceptionFilter, HttpExceptionFilter, ApiBadRequest, GeneralBadRequestException } from "@hl8/exceptions";

@Controller("/users")
@UseFilters(AnyExceptionFilter, HttpExceptionFilter)
export class UserController {
  @Post()
  @ApiBadRequest("USER_DUPLICATED")
  create(@Body() dto: CreateUserDto) {
    throw new GeneralBadRequestException({ field: "email", message: "邮箱格式不正确" }, "请求参数不合法", "USER_DUPLICATED");
  }
}
```

## 培训教程

- [异常处理培训教程](./docs/培训教程.md)：适合作为团队内部训练材料，含课程安排、练习与自检清单

## 可用异常

- `GeneralBadRequestException`
- `GeneralForbiddenException`
- `GeneralNotFoundException`
- `GeneralUnauthorizedException`
- `GeneralUnprocessableEntityException`
- `GeneralInternalServerException`
- `ConflictEntityCreationException`
- `OptimisticLockException`
- `ObjectNotFoundException`
- `MissingConfigurationForFeatureException`
- `InternalServiceUnavailableException`

## Swagger 装饰器

- `ApiBadRequest`
- `ApiEntityNotFound`
- `ApiConflictEntityCreation`
- `ApiOptimisticLock`
- `ApiForbiddenError`
- `ApiUnprocessableEntity`

## 过滤器

- `AnyExceptionFilter`
- `HttpExceptionFilter`
- `ForbiddenExceptionFilter`
- `NotFoundExceptionFilter`

## 默认响应结构

所有异常均返回符合 RFC7807 的响应体：

```json
{
  "type": "about:blank",
  "title": "资源不存在",
  "detail": "请求的资源不存在或已被删除",
  "status": 404,
  "instance": "请求ID",
  "errorCode": "RESOURCE_NOT_FOUND",
  "data": {
    "identifier": "123"
  }
}
```

## TODO

- [ ] 补充单元测试
- [ ] 支持自定义异常文档链接
- [ ] 提供与配置中心的集成示例
