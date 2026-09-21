/**
 * 按确认支出计算每人净额（单位：元，保留两位小数）。
 * net = 本人垫付总额 - 人均均摊；正为应收、负为应付。
 * 均摊除不尽时，把舍入余数（最多每人 1 分）补给垫付最多的成员，保证净额严格零和。
 */
export function calculateNetAmounts(
  memberIds: number[],
  paidMap: Record<number, number>
): { total: number; perPerson: number; items: Array<{ userId: number; paid: number; share: number; net: number }> } {
  const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const members = memberIds.length > 0 ? memberIds : [];
  const headcount = members.length;

  const paidByUser: Record<number, number> = {};
  let total = 0;
  for (const userId of members) {
    const paid = round2(paidMap[userId] ?? 0);
    paidByUser[userId] = paid;
    total = round2(total + paid);
  }

  const baseShare = headcount > 0 ? Math.floor((total * 100) / headcount) / 100 : 0;
  const remainderCents = headcount > 0 ? Math.round(total * 100) - Math.round(baseShare * 100) * headcount : 0;

  // 余数补给垫付金额最高的若干成员，避免凭空多出/少掉几分钱。
  const shareCents: Record<number, number> = {};
  members.forEach(userId => {
    shareCents[userId] = Math.round(baseShare * 100);
  });
  const byPaidDesc = [...members].sort((a, b) => paidByUser[b] - paidByUser[a] || a - b);
  for (let i = 0; i < remainderCents; i += 1) {
    const userId = byPaidDesc[i % byPaidDesc.length];
    shareCents[userId] += 1;
  }

  const items = members.map(userId => {
    const paid = paidByUser[userId];
    const share = round2(shareCents[userId] / 100);
    return { userId, paid, share, net: round2(paid - share) };
  });
  const netSum = round2(items.reduce((sum, item) => sum + item.net, 0));

  return { total, perPerson: headcount > 0 ? round2(total / headcount) : 0, items: normalizeZeroSum(items, netSum, round2) };
}

/** 兜底：若浮点层面仍有残余，把差值计入垫付最多者，确保净额为零和。 */
function normalizeZeroSum(
  items: Array<{ userId: number; paid: number; share: number; net: number }>,
  netSum: number,
  round2: (v: number) => number
) {
  if (netSum === 0 || items.length === 0) return items;
  const target = [...items].sort((a, b) => b.paid - a.paid || a.userId - b.userId)[0];
  return items.map(item =>
    item.userId === target.userId ? { ...item, net: round2(item.net - netSum), share: round2(item.share + netSum) } : item
  );
}
