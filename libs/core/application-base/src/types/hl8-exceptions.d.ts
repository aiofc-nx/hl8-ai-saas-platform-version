declare module "@hl8/exceptions" {
  export interface ValidationIssue {
    field: string;
    message: string;
    code?: string;
    rejectedValue?: unknown;
  }

  export class GeneralBadRequestException extends Error {
    constructor(
      issues: ValidationIssue | ValidationIssue[],
      detail?: string,
      errorCode?: string,
      rootCause?: unknown,
    );
  }

  export class GeneralForbiddenException extends Error {
    constructor(detail?: string, errorCode?: string, rootCause?: unknown);
  }

  export class GeneralInternalServerException extends Error {
    constructor(detail?: string, errorCode?: string, rootCause?: unknown);
  }

  export class MissingConfigurationForFeatureException extends Error {
    constructor(detail?: string, errorCode?: string, rootCause?: unknown);
  }
}
