export interface UserInfo {
  id: number;
  email: string;
  nickname: string;
  bio?: string | null;
}

export interface AuthResult {
  token: string;
  user: UserInfo;
}

export interface Trip {
  id: number;
  ownerId: number;
  destination: string;
  departDate: string;
  days: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  transport: string;
  companionCount: number;
  genderPreference?: string | null;
  status: string;
  memberIds?: number[];
}

export type ExpenseStatusValue = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'FROZEN';

export interface Expense {
  id: number;
  tripId: number;
  payerId: number;
  payerName: string;
  receiptNo: string;
  title: string;
  category: string;
  amount: number;
  status: ExpenseStatusValue;
  confirmedBy?: number | null;
  confirmerName?: string | null;
  rejectedBy?: number | null;
  rejecterName?: string | null;
  rejectReason?: string | null;
  frozenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCategoryStat {
  category: string;
  planned: number;
  spent: number;
  overBudget: boolean;
  overAmount: number;
}

export interface BudgetSummary {
  totalPlanned: number;
  totalSpent: number;
  totalOverBudget: boolean;
  totalExceeded: boolean;
  totalOverAmount: number;
  categoryOverAmount: number;
  budgetSource: 'CATEGORY' | 'TRIP_MAX';
  categories: BudgetCategoryStat[];
}

export interface SettlementItem {
  id: number;
  settlementId: number;
  tripId: number;
  userId: number;
  paid: number;
  share: number;
  net: number;
}

export interface Settlement {
  id: number;
  tripId: number;
  createdBy: number;
  status: string;
  totalAmount: number;
  perPerson: number;
  netSum: number;
  overBudget: boolean;
  overBudgetDetail: {
    totalExceeded: boolean;
    totalOverAmount: number;
    categoryOverAmount: number;
    categories: Array<{ category: string; planned: number; spent: number; overAmount: number }>;
  } | null;
  memberCount: number;
  createdAt: string;
  items: SettlementItem[];
}

export interface Todo {
  type: 'CONFIRM' | 'RESUBMIT';
  expenseId: number;
  title: string;
  amount: number;
  payerName?: string;
  reason?: string | null;
}

export interface Anomaly {
  type: 'REJECTED' | 'OVER_BUDGET' | 'PENDING_BLOCKER';
  level: 'warning' | 'danger';
  message: string;
  expenseId?: number;
}

export interface ProjectedNet {
  total: number;
  perPerson: number;
  items: Array<{ userId: number; paid: number; share: number; net: number }>;
}

export interface Overview {
  trip: Trip;
  members: Array<{ userId: number; nickname: string }>;
  counts: { pending: number; confirmed: number; rejected: number; frozen: number; total: number };
  todos: Todo[];
  anomalies: Anomaly[];
  budget: BudgetSummary;
  expenses: Expense[];
  settlement: Settlement | null;
  projectedNet: ProjectedNet;
  canSettle: boolean;
  frozen: boolean;
}
