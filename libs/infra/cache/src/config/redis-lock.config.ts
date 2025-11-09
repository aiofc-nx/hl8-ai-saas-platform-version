import { Type } from "class-transformer";
import { IsInt, IsNumber, Min } from "class-validator";

/**
 * @description 分布式锁相关配置，基于 Redlock 实现。
 */
export class RedisLockConfig {
  /**
   * @description 漂移因子，用于 Redlock 计算锁的有效时间。
   */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  driftFactor: number = 0.01;

  /**
   * @description 获取锁的最大重试次数。
   */
  @IsInt()
  @Min(0)
  retryCount: number = 10;

  /**
   * @description 两次重试之间的等待时间（毫秒）。
   */
  @IsInt()
  @Min(0)
  retryDelay: number = 200;

  /**
   * @description 重试抖动时间（毫秒），缓解雪崩。
   */
  @IsInt()
  @Min(0)
  retryJitter: number = 200;

  /**
   * @description 自动续期阈值（毫秒），剩余时间低于该值时尝试延长。
   */
  @IsInt()
  @Min(0)
  automaticExtensionThreshold: number = 500;

  /**
   * @description 装饰器默认锁定时间（毫秒）。
   */
  @IsInt()
  @Min(0)
  defaultDecoratorLockDuration: number = 1000;
}
