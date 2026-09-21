export interface Trip {
  id: number;
  ownerId: number;
  destination: string;
  departDate: string;
  days: number;
  budgetMin?: string | null;
  budgetMax?: string | null;
  transport: string;
  companionCount: number;
  genderPreference?: string | null;
  status: string;
}

export interface Member {
  id: number;
  tripId: number;
  userId: number;
  nickname: string;
}

export interface Budget {
  id: number;
  tripId: number;
  category: string;
  planned: string;
  spent: string;
}

export type ExpenseStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'SETTLED';

export interface Expense {
  id: number;
  tripId: number;
  payerId: number;
  receiptNo: string;
  category: string;
  amount: string;
  note?: string | null;
  status: ExpenseStatus;
  confirmedBy?: number | null;
  confirmedAt?: string | null;
  createdAt: string;
}

export interface SettlementShare {
  id: number;
  settlementId: number;
  userId: number;
  paid: string;
  share: string;
  net: string;
}

export interface Settlement {
  id: number;
  tripId: number;
  totalAmount: string;
  plannedBudget: string;
  memberCount: number;
  overBudget: boolean;
  status: string;
  createdAt: string;
  shares: SettlementShare[];
}

export interface CurrentUser {
  id: number;
  nickname: string;
}
