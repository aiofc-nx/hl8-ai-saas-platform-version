import { HttpStatus } from "@nestjs/common";
import { ConflictEntityCreationException } from "./conflict-entity-creation.exception.js";
import { GeneralForbiddenException } from "./general-forbidden.exception.js";
import { GeneralInternalServerException } from "./general-internal-server.exception.js";
import { GeneralNotFoundException } from "./general-not-found.exception.js";
import { GeneralUnauthorizedException } from "./general-unauthorized.exception.js";
import { GeneralUnprocessableEntityException } from "./general-unprocessable-entity.exception.js";
import { InternalServiceUnavailableException } from "./internal-service-unavailable.exception.js";
import { MissingConfigurationForFeatureException } from "./missing-configuration-for-feature.exception.js";
import { ObjectNotFoundException } from "./object-not-found.exception.js";
import { OptimisticLockException } from "./optimistic-lock.exception.js";

describe("通用异常类", () => {
  it("ConflictEntityCreationException 应返回 409", () => {
    const exception = new ConflictEntityCreationException();
    const response = exception.toErrorResponse("req-1");

    expect(response).toMatchObject({
      title: "数据冲突",
      status: HttpStatus.CONFLICT,
      instance: "req-1",
    });
  });

  it("GeneralForbiddenException 默认 403", () => {
    const exception = new GeneralForbiddenException();
    const response = exception.toErrorResponse("req-2");

    expect(response).toMatchObject({
      title: "禁止访问",
      status: HttpStatus.FORBIDDEN,
      detail: "当前账户没有执行该操作的权限",
      instance: "req-2",
    });
  });

  it("GeneralInternalServerException 可自定义 detail 与错误码", () => {
    const exception = new GeneralInternalServerException(
      "服务异常",
      "INTERNAL",
    );
    const response = exception.toErrorResponse("req-3");

    expect(response).toMatchObject({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: "服务异常",
      errorCode: "INTERNAL",
    });
  });

  it("GeneralNotFoundException 默认 404", () => {
    const exception = new GeneralNotFoundException();
    const response = exception.toErrorResponse("req-4");

    expect(response).toMatchObject({
      status: HttpStatus.NOT_FOUND,
      title: "资源不存在",
      detail: "请求的资源不存在或已被删除",
    });
  });

  it("GeneralUnauthorizedException 默认 401", () => {
    const exception = new GeneralUnauthorizedException();
    const response = exception.toErrorResponse("req-5");

    expect(response).toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
      title: "未授权",
      detail: "认证失败，请重新登录",
    });
  });

  it("GeneralUnprocessableEntityException 默认 422", () => {
    const exception = new GeneralUnprocessableEntityException();
    const response = exception.toErrorResponse("req-6");

    expect(response).toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      title: "无法处理的实体",
      detail: "请求已接收，但当前状态无法完成处理",
    });
  });

  it("InternalServiceUnavailableException 应包含 service 信息", () => {
    const exception = new InternalServiceUnavailableException(
      "payment",
      "支付服务异常",
      "SERVICE_DOWN",
    );
    const response = exception.toErrorResponse("req-7");

    expect(response).toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      detail: "支付服务异常",
      errorCode: "SERVICE_DOWN",
    });
    expect(response.data).toEqual({ service: "payment" });
  });

  it("MissingConfigurationForFeatureException 应携带缺失配置", () => {
    const exception = new MissingConfigurationForFeatureException(
      "sms",
      "sms.enabled",
    );
    const response = exception.toErrorResponse("req-8");

    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.data).toEqual({ feature: "sms", configKey: "sms.enabled" });
  });

  it("ObjectNotFoundException 应包含资源信息", () => {
    const exception = new ObjectNotFoundException(
      "User",
      "u-001",
      "用户不存在",
      "USER_NOT_FOUND",
    );
    const response = exception.toErrorResponse("req-9");

    expect(response).toMatchObject({
      title: "资源不存在",
      detail: "用户不存在",
      errorCode: "USER_NOT_FOUND",
    });
    expect(response.data).toEqual({
      resourceType: "User",
      identifier: "u-001",
    });
  });

  it("OptimisticLockException 应暴露版本信息", () => {
    const exception = new OptimisticLockException(5, 4);
    const response = exception.toErrorResponse("req-10");

    expect(response.status).toBe(HttpStatus.CONFLICT);
    expect(response.data).toEqual({ currentVersion: 5, expectedVersion: 4 });
  });
});
