declare module "redlock" {
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
