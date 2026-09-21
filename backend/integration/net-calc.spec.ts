/**
 * 净额零和算法的纯函数测试（不依赖 Nest/数据库）。
 * 覆盖：均摊除不尽余数、垫付集中、无人垫付、2~8 人随机金额、大额。
 */
import { calculateNetAmounts } from '../src/modules/settlement/net-calc';

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function assertZeroSum(name: string, memberIds: number[], paidMap: Record<number, number>) {
  const r = calculateNetAmounts(memberIds, paidMap);
  const netSum = round2(r.items.reduce((s, i) => s + i.net, 0));
  const shareSum = round2(r.items.reduce((s, i) => s + i.share, 0));
  const paidSum = round2(r.items.reduce((s, i) => s + i.paid, 0));
  const identity = r.items.every(i => round2(i.paid - i.share - i.net) === 0);
  check(
    `${name}: 净额零和`,
    Math.abs(netSum) === 0 && Math.abs(shareSum - r.total) < 1e-9 && paidSum === r.total && identity,
    `netSum=${netSum} shareSum=${shareSum} total=${r.total} paidSum=${paidSum}`
  );
}

// 固定用例
assertZeroSum('2 人整除', [1, 2], { 1: 100, 2: 0 });
assertZeroSum('3 人均分整除', [1, 2, 3], { 1: 300, 2: 0, 3: 0 });
assertZeroSum('3 人 100 除不尽', [1, 2, 3], { 1: 100, 2: 0, 3: 0 });
assertZeroSum('3 人 990.25', [1, 2, 3], { 1: 510, 2: 180.25, 3: 300 });
assertZeroSum('余数给垫付最多者', [1, 2, 3], { 1: 10, 2: 10, 3: 0.01 });
assertZeroSum('全员零垫付', [1, 2, 3], {});
assertZeroSum('全员等额', [1, 2, 3, 4], { 1: 25, 2: 25, 3: 25, 4: 25 });
assertZeroSum('单人行程', [1], { 1: 999.99 });
assertZeroSum('大额', [1, 2], { 1: 9_999_999.99, 2: 0 });
assertZeroSum('7 人奇数总额', [1, 2, 3, 4, 5, 6, 7], { 1: 100, 3: 0.01, 5: 0.02 });

// 随机用例
let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
for (let iter = 0; iter < 500; iter += 1) {
  const n = 2 + Math.floor(rand() * 7);
  const memberIds = Array.from({ length: n }, (_, i) => i + 1);
  const paidMap: Record<number, number> = {};
  memberIds.forEach(id => {
    if (rand() > 0.4) paidMap[id] = round2(rand() * 1000);
  });
  assertZeroSum(`随机#${iter} (${n}人)`, memberIds, paidMap);
}

console.log(`\n净额算法：${passed} 通过，${failed} 失败`);
process.exit(failed === 0 ? 0 : 1);
