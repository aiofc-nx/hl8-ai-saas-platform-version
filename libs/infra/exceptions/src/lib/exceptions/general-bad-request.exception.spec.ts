import { GeneralBadRequestException } from "./general-bad-request.exception.js";

describe("GeneralBadRequestException", () => {
  it("单个校验错误时应自动包装为数组", () => {
    const exception = new GeneralBadRequestException({
      field: "email",
      message: "邮箱格式不正确",
      code: "INVALID_EMAIL",
    });

    expect(Array.isArray(exception.data)).toBe(true);
    const issues = Array.isArray(exception.data) ? exception.data : [];
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      field: "email",
      message: "邮箱格式不正确",
      code: "INVALID_EMAIL",
    });
  });

  it("toErrorResponse 应包含自定义错误码与请求 ID", () => {
    const exception = new GeneralBadRequestException(
      [
        {
          field: "password",
          message: "密码长度不足",
        },
      ],
      "请求参数不符合要求，请检查后重试",
      "PASSWORD_TOO_SHORT",
    );

    const response = exception.toErrorResponse("req-123");

    expect(response).toMatchObject({
      type: "about:blank",
      title: "请求参数错误",
      status: 400,
      instance: "req-123",
      errorCode: "PASSWORD_TOO_SHORT",
    });
    expect(response.data).toEqual([
      {
        field: "password",
        message: "密码长度不足",
      },
    ]);
  });
});
