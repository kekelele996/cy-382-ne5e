export enum TripStatus { Open = 'OPEN', Matched = 'MATCHED', Finished = 'FINISHED' }
export enum TransportType { SelfDrive = '自驾', Public = '公共交通', Hiking = '徒步' }

/** 支出登记后的流转状态：待确认 -> 已确认（清算生成后批量冻结）/ 已驳回（可由登记人重提回到待确认） */
export enum ExpenseStatus {
  Pending = 'PENDING',
  Confirmed = 'CONFIRMED',
  Rejected = 'REJECTED',
  Frozen = 'FROZEN'
}

/** 清算单状态：生成即落盘冻结，不可重复生成 */
export enum SettlementStatus {
  Settled = 'SETTLED'
}
