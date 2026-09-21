import { ValueTransformer } from 'typeorm';

/** MySQL DECIMAL 经 mysql2 驱动返回字符串，统一转成 number 写回 number，金额保留两位小数。 */
export class DecimalTransformer implements ValueTransformer {
  to(value?: number | null): string | null {
    if (value === null || value === undefined) return null;
    return Number(value).toFixed(2);
  }
  from(value?: string | number | null): number | null {
    if (value === null || value === undefined) return null;
    return Number(value);
  }
}
