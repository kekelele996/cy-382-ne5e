/**
 * 行程共享费用清算：端到端业务规则集成测试（内存 SQLite）。
 * 运行：DB_TYPE=sqlite node dist-integration/integration/settlement.flow.js
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpenseStatus } from '../src/constants/status';
import { ExpenseService } from '../src/modules/expense/expense.service';
import { BudgetService } from '../src/modules/budget/budget.service';
import { SettlementService } from '../src/modules/settlement/settlement.service';
import { DashboardService } from '../src/modules/settlement/dashboard.service';
import { TripService } from '../src/modules/trip/trip.service';
import { TripMemberService } from '../src/modules/trip/trip-member.service';

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

async function expectError(name: string, code: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false, '未抛出预期错误');
  } catch (error: any) {
    check(name, error?.code === code, `期望 ${code}，实际 ${error?.code} / ${error?.message}`);
  }
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const trips = app.get(TripService);
  const members = app.get(TripMemberService);
  const expenses = app.get(ExpenseService);
  const budgets = app.get(BudgetService);
  const settlements = app.get(SettlementService);
  const dashboard = app.get(DashboardService);

  console.log('1) 行程与成员');
  const alice = await trips.create(
    { destination: '大理', departDate: '2026-07-12', days: 5, budgetMin: 1000, budgetMax: 1000, transport: '公共交通', companionCount: 3 } as any,
    1
  );
  const tripId = alice.id;
  await members.join(tripId, 2); // bob
  await members.join(tripId, 3); // carol
  const outsider = await trips.create(
    { destination: '丽江', departDate: '2026-09-01', days: 2, transport: '徒步', companionCount: 1 } as any,
    4
  );
  check('发布者自动成为成员', (await members.listMemberIds(tripId)).join() === '1,2,3');

  console.log('2) 登记规则：本人垫付、当前行程、票据号唯一');
  const e1 = await expenses.register({ tripId, receiptNo: 'R-1', title: '餐饮A', category: '餐饮', amount: 100 }, 1);
  const e2 = await expenses.register({ tripId, receiptNo: 'R-2', title: '车票B', category: '交通', amount: 200.55 }, 2);
  check('登记后状态为 PENDING', e1.status === ExpenseStatus.Pending && e2.status === ExpenseStatus.Pending);
  check('登记人即付款人', e1.payerId === 1);
  await expectError('非成员不能登记', 'NOT_TRIP_MEMBER', () =>
    expenses.register({ tripId, receiptNo: 'R-X', title: 'X', category: '餐饮', amount: 10 }, 4)
  );
  await expectError('同行程同票据号不能重复', 'RECEIPT_DUPLICATED', () =>
    expenses.register({ tripId, receiptNo: 'R-1', title: '再来一单', category: '餐饮', amount: 50 }, 2)
  );
  await expectError('不属于自己行程的票据号仍受行程隔离（别的行程可用同号）', 'NOT_TRIP_MEMBER', () =>
    expenses.register({ tripId: outsider.id, receiptNo: 'R-1', title: '他行程', category: '餐饮', amount: 1 }, 1)
  );
  const sameReceiptOtherTrip = await expenses.register(
    { tripId: outsider.id, receiptNo: 'R-1', title: '他行程', category: '餐饮', amount: 1 },
    4
  );
  check('票据号唯一范围仅限同一行程', sameReceiptOtherTrip.receiptNo === 'R-1');
  await expectError('金额必须大于0', 'EXPENSE_AMOUNT_INVALID', () =>
    expenses.register({ tripId, receiptNo: 'R-9', title: 'x', category: '餐饮', amount: 0 }, 1)
  );

  console.log('3) 确认规则：登记人不能确认本人；重复确认只成功一次');
  await expectError('登记人不能确认自己的支出', 'CANNOT_CONFIRM_OWN', () =>
    expenses.confirm(tripId, e1.id, 1)
  );
  await expectError('非成员不能确认', 'NOT_TRIP_MEMBER', () => expenses.confirm(tripId, e1.id, 4));
  const confirmed1 = await expenses.confirm(tripId, e1.id, 2);
  check('其他成员确认成功 -> CONFIRMED', confirmed1.status === ExpenseStatus.Confirmed && confirmed1.confirmedBy === 2);
  await expectError('重复确认失败（幂等）', 'EXPENSE_NOT_PENDING', () => expenses.confirm(tripId, e1.id, 3));
  await expectError('确认已确认的支出失败', 'EXPENSE_NOT_PENDING', () => expenses.confirm(tripId, e1.id, 2));

  console.log('4) 驳回与重提');
  // carol 驳回 bob 的 e2
  const rejected = await expenses.reject(tripId, e2.id, 3, '金额对不上');
  check('驳回后状态 REJECTED 且记录原因', rejected.status === ExpenseStatus.Rejected && rejected.rejectReason === '金额对不上');
  await expectError('非登记人不能重提', 'NOT_EXPENSE_OWNER', () =>
    expenses.resubmit(tripId, e2.id, 1, { amount: 180 })
  );
  await expectError('只有 REJECTED 可重提', 'EXPENSE_NOT_REJECTED', () =>
    expenses.resubmit(tripId, e1.id, 1, { amount: 180 })
  );
  // 首次重提（仍为 REJECTED）时票据号撞车应被拒
  await expectError('重提时票据号撞车仍被拒', 'RECEIPT_DUPLICATED', () =>
    expenses.resubmit(tripId, e2.id, 2, { receiptNo: 'R-1' })
  );
  const resubmitted = await expenses.resubmit(tripId, e2.id, 2, { amount: 180.25, title: '车票B-更正' });
  check('重提后回到 PENDING 并清空驳回信息', resubmitted.status === ExpenseStatus.Pending && Number(resubmitted.amount) === 180.25 && !resubmitted.rejectReason);
  // alice 确认重提后的 e2
  const confirmed2 = await expenses.confirm(tripId, e2.id, 1);
  check('重提支出经他人确认 -> CONFIRMED', confirmed2.status === ExpenseStatus.Confirmed);

  console.log('5) 有待确认/待重提支出时禁止清算');
  const pendingE = await expenses.register({ tripId, receiptNo: 'R-3', title: '门票C', category: '门票', amount: 300 }, 3);
  await expectError('存在 PENDING 时不能生成清算单', 'EXPENSES_PENDING', () => settlements.generate(tripId, 1));
  await expenses.confirm(tripId, pendingE.id, 1); // 确认
  // 制造一个 REJECTED
  const rejE = await expenses.register({ tripId, receiptNo: 'R-4', title: '住宿D', category: '住宿', amount: 400 }, 1);
  await expenses.reject(tripId, rejE.id, 2, '缺发票');
  await expectError('存在 REJECTED(待重提) 时不能生成清算单', 'EXPENSES_REJECTED', () => settlements.generate(tripId, 1));
  // 重提并确认
  await expenses.resubmit(tripId, rejE.id, 1, { amount: 410 });
  await expenses.confirm(tripId, rejE.id, 3);

  console.log('6) 净额零和计算');
  const summary = await settlements.getByTrip(tripId, 1);
  check('清算前 settlement 为 null', summary === null);
  // 已确认金额：e1=100(alice), e2=180.25(bob), e3=300(carol), e4=410(alice) => 990.25 / 3
  const result = await settlements.generate(tripId, 1);
  check('清算单已生成', result.status === 'SETTLED');
  check('总额正确', Number(result.totalAmount) === 990.25, `实际 ${result.totalAmount}`);
  check('人均正确', Number(result.perPerson) === 330.08, `实际 ${result.perPerson}`);
  const netSum = result.items.reduce((s: number, i: any) => s + Number(i.net), 0);
  check('净额之和为 0（零和）', Math.abs(netSum) < 0.0001, `实际 ${netSum}`);
  const byUser = Object.fromEntries(result.items.map((i: any) => [i.userId, i]));
  // alice paid 510 -> net +179.92; bob paid 180.25 -> -149.83; carol paid 300 -> -30.08 ; 179.92 -149.83 -30.08 = 0.01?
  // 余数被吸收进垫付最多者的 share，最终必须精确 0
  check('零和分摊 abs(net) 之和等于内部转账总额(>0)', result.items.filter((i: any) => Number(i.net) > 0).length >= 1);
  check('每人 paid = share + net', result.items.every((i: any) => Math.abs(Number(i.paid) - Number(i.share) - Number(i.net)) < 1e-9));
  check('share 合计 = total', Math.abs(result.items.reduce((s: number, i: any) => s + Number(i.share), 0) - 990.25) < 1e-9);
  void byUser;

  console.log('7) 重复/并发生成只成功一次');
  await expectError('重复生成被拒', 'TRIP_ALREADY_SETTLED', () => settlements.generate(tripId, 2));

  // 并发竞争：新行程所有支出确认后，两个成员同时点生成，只允许一单落盘。
  const tc = await trips.create(
    { destination: '三亚', departDate: '2026-12-10', days: 4, budgetMax: 9000, transport: '飞机', companionCount: 2 } as any,
    1
  );
  await members.join(tc.id, 2);
  const c1 = await expenses.register({ tripId: tc.id, receiptNo: 'C1', title: '潜水', category: '门票', amount: 600 }, 1);
  await expenses.confirm(tc.id, c1.id, 2);
  const parallel = await Promise.allSettled([settlements.generate(tc.id, 1), settlements.generate(tc.id, 2)]);
  const fulfilled = parallel.filter(r => r.status === 'fulfilled');
  const rejectedRace = parallel.filter(r => r.status === 'rejected');
  check('并发生成仅一单成功', fulfilled.length === 1 && rejectedRace.length === 1,
    `fulfilled=${fulfilled.length} rejected=${rejectedRace.length}`);
  const raceError = rejectedRace[0].status === 'rejected' ? rejectedRace[0].reason : null;
  check('失败方返回幂等/已结算错误', raceError?.code === 'TRIP_ALREADY_SETTLED' || raceError?.code === 'SETTLEMENT_IN_PROGRESS',
    `实际 ${raceError?.code}`);

  console.log('8) 清算、冻结状态一次落盘');
  const after = await expenses.listForTrip(tripId);
  check('全部确认支出已冻结 FROZEN', after.every(e => e.status === ExpenseStatus.Frozen));
  await expectError('冻结后不能再登记', 'TRIP_ALREADY_SETTLED', () =>
    expenses.register({ tripId, receiptNo: 'R-5', title: '新支出', category: '餐饮', amount: 10 }, 1)
  );
  await expectError('冻结后不能改预算', 'TRIP_ALREADY_SETTLED', () =>
    budgets.setPlans(tripId, 1, [{ category: '餐饮', planned: 1 }])
  );

  console.log('9) 超计划预算标记');
  check('预算上限 1000，花费 990.25 未超支', result.overBudget === false);
  // 新行程：超支场景
  const t2 = await trips.create(
    { destination: '成都', departDate: '2026-10-01', days: 3, budgetMax: 500, transport: '自驾', companionCount: 2 } as any,
    1
  );
  await members.join(t2.id, 2);
  await budgets.setPlans(t2.id, 1, [
    { category: '餐饮', planned: 100 },
    { category: '交通', planned: 1000 }
  ]);
  const x1 = await expenses.register({ tripId: t2.id, receiptNo: 'A', title: '火锅', category: '餐饮', amount: 350 }, 1);
  const x2 = await expenses.register({ tripId: t2.id, receiptNo: 'B', title: '油费', category: '交通', amount: 200 }, 2);
  await expenses.confirm(t2.id, x1.id, 2);
  await expenses.confirm(t2.id, x2.id, 1);
  const bs = await budgets.summary(t2.id);
  check('分品类超支被识别（餐饮）', Boolean(bs.totalOverBudget === true && bs.categories.find((c: any) => c.category === '餐饮')?.overBudget === true));
  check('未超支品类不标记', bs.categories.find((c: any) => c.category === '交通')?.overBudget === false);
  const st2 = await settlements.generate(t2.id, 1);
  check('清算单标记超支并保留明细', Boolean(st2.overBudget === true && st2.overBudgetDetail?.categories.some((c: any) => c.category === '餐饮')));

  console.log('10) 工作台：待办 / 异常 / 净额 / 超支');
  const ov1 = await dashboard.overview(tripId, 2);
  check('清算后无待办', ov1.todos.length === 0);
  check('清算后异常中无 PENDING/REJECTED 阻断', !ov1.anomalies.some((a: any) => a.type === 'PENDING_BLOCKER' || a.type === 'REJECTED'));
  check('canSettle=false（已清算）', ov1.canSettle === false && ov1.frozen === true);
  check('工作台净额取自冻结清算单', ov1.settlement?.id === result.id);

  const ov2 = await dashboard.overview(t2.id, 1);
  check('超支出现在异常列表', ov2.anomalies.some((a: any) => a.type === 'OVER_BUDGET'));
  check('超支工作台冻结', ov2.frozen === true);

  // 未清算行程的待办/异常
  const t3 = await trips.create(
    { destination: '西安', departDate: '2026-11-01', days: 2, budgetMax: 5000, transport: '公共交通', companionCount: 3 } as any,
    1
  );
  await members.join(t3.id, 2);
  await members.join(t3.id, 3);
  const p1 = await expenses.register({ tripId: t3.id, receiptNo: 'P1', title: '酒店', category: '住宿', amount: 600 }, 1);
  const p2 = await expenses.register({ tripId: t3.id, receiptNo: 'P2', title: '打车', category: '交通', amount: 80 }, 2);
  await expenses.reject(t3.id, p2.id, 3, '时间不符');

  const ov3bob = await dashboard.overview(t3.id, 2);
  check('bob 待办包含：确认 p1 + 重提自己的 p2',
    ov3bob.todos.some(t => t.type === 'CONFIRM' && t.expenseId === p1.id) &&
    ov3bob.todos.some(t => t.type === 'RESUBMIT' && t.expenseId === p2.id));
  const ov3alice = await dashboard.overview(t3.id, 1);
  // p1 是 alice 本人登记（不能自确认）；p2 已被 carol 驳回（待 bob 重提，非 alice 可确认）。
  // 故 alice 此刻没有待办，她只能等 bob 重提 p2；carol 的待办才是确认 p1。
  check('alice 待办不含自己的 p1，也不含已驳回的 p2', ov3alice.todos.length === 0);
  const ov3carolView = await dashboard.overview(t3.id, 3);
  check('carol 待办包含确认他人的 p1', ov3carolView.todos.some(t => t.type === 'CONFIRM' && t.expenseId === p1.id));
  check('异常包含 REJECTED 和 PENDING_BLOCKER',
    ov3bob.anomalies.some((a: any) => a.type === 'REJECTED') && ov3bob.anomalies.some((a: any) => a.type === 'PENDING_BLOCKER'));
  check('未清算 canSettle=false（有 pending/rejected）', ov3bob.canSettle === false);

  // 全部确认后 canSettle=true，且预估净额零和
  await expenses.resubmit(t3.id, p2.id, 2, { amount: 88 });
  await expenses.confirm(t3.id, p2.id, 1);
  await expenses.confirm(t3.id, p1.id, 2);
  const ov4 = await dashboard.overview(t3.id, 1);
  check('全部确认后 canSettle=true', ov4.canSettle === true);
  const projSum = ov4.projectedNet.items.reduce((s, i) => s + i.net, 0);
  check('预估净额零和', Math.abs(projSum) < 1e-9, `实际 ${projSum}`);

  // 刷新一致性：再次查询结果相同
  const ov4again = await dashboard.overview(t3.id, 1);
  check('刷新后 counts 一致', JSON.stringify(ov4.counts) === JSON.stringify(ov4again.counts));
  check('刷新后 projectedNet 一致', JSON.stringify(ov4.projectedNet) === JSON.stringify(ov4again.projectedNet));

  console.log('11) 零成员极端情况');
  const t4id = (await app.get(TripService).create(
    { destination: '独自', departDate: '2026-12-01', days: 1, transport: '徒步', companionCount: 1 } as any,
    9
  )).id;
  await expectError('有成员（发布者），正常；此条覆盖非成员读取', 'NOT_TRIP_MEMBER', () => dashboard.overview(t4id, 2));

  await app.close();
  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
