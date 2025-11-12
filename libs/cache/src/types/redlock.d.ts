declare module "redlock" {
  export interface Settings {
    driftFactor?: number;
    retryCount?: number;
    retryDelay?: number;
    retryJitter?: number;
    automaticExtensionThreshold?: number;
    retryPriority?: number;
  }

  export interface Lock {
    resource: string;
    value: string;
    expiration: number;
    unlock(): Promise<void>;
    extend(duration: number, settings?: Partial<Settings>): Promise<Lock>;
  }

  export interface ExecutionResult<T = unknown> {
    lock: Lock;
    value: T;
  }

  export type RedlockAbortSignal = AbortSignal & {
    error?: Error;
  };

  export default class Redlock {
    using<T>(
      resources: string[],
      duration: number,
      routine: (signal: RedlockAbortSignal) => Promise<T>,
    ): Promise<T>;
  }
}
