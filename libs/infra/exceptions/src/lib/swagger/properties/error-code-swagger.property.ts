interface SwaggerSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
}

/**
 * @description 构造错误码字段的 Swagger 属性描述
 * @param errorCodes - 可选的错误码枚举
 * @returns 包含 `errorCode` 属性的 schema 片段
 */
export const errorCodeSwaggerProperty = (
  ...errorCodes: string[]
): Record<string, SwaggerSchemaProperty> => {
  if (!errorCodes.length) {
    return {
      errorCode: {
        type: "string",
        description: "业务错误码",
      },
    } satisfies Record<string, SwaggerSchemaProperty>;
  }

  return {
    errorCode: {
      type: "string",
      description: "业务错误码",
      enum: errorCodes,
    },
  } satisfies Record<string, SwaggerSchemaProperty>;
};
