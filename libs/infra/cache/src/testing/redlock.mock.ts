export class RedlockService {
  async using<T>(
    _resources: string[],
    _duration: number,
    routine: (signal: { aborted: boolean; error?: Error }) => Promise<T>,
  ): Promise<T> {
    return routine({ aborted: false });
  }
}
