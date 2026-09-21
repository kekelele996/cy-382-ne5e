export interface ShareInput {
  userId: number;
  paidCents: number;
}

export interface ShareResult {
  userId: number;
  paidCents: number;
  shareCents: number;
  netCents: number;
}

export function toCents(amount: number | string | null | undefined): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * 按成员均摊确认支出总额（整数分计算）。
 * 余数按 userId 升序逐个多摊 1 分，保证 Σshare = Σpaid，从而净额零和。
 */
export function splitShares(inputs: ShareInput[]): ShareResult[] {
  const sorted = [...inputs].sort((a, b) => a.userId - b.userId);
  const total = sorted.reduce((sum, item) => sum + item.paidCents, 0);
  const count = sorted.length;
  const base = count > 0 ? Math.floor(total / count) : 0;
  let remainder = count > 0 ? total - base * count : 0;
  return sorted.map(item => {
    let shareCents = base;
    if (remainder > 0) {
      shareCents += 1;
      remainder -= 1;
    }
    return { userId: item.userId, paidCents: item.paidCents, shareCents, netCents: item.paidCents - shareCents };
  });
}
