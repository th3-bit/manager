import { supabase } from './supabase';

export interface DBTransaction {
  id: string;
  user_id?: string;
  account_id?: string;
  title: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  frequency?: string;
  date: string;
  created_at?: string;
}

export interface DBAccount {
  id: string;
  user_id?: string;
  name: string;
  type: 'Overall' | 'MobileMoney' | 'Cards' | 'Cash';
  balance: number;
  income: number;
  expenses: number;
  number?: string;
  bank?: string;
  exp?: string;
}

export const initialZeroAccounts: DBAccount[] = [
  {
    id: 'acc-overall',
    name: 'Net Worth Overall',
    type: 'Overall',
    balance: 0,
    income: 0,
    expenses: 0,
  },
  {
    id: 'acc-momo',
    name: 'MTN Mobile Money',
    type: 'MobileMoney',
    balance: 0,
    income: 0,
    expenses: 0,
    number: '',
  },
  {
    id: 'acc-cards',
    name: 'Visa Debit Card',
    type: 'Cards',
    balance: 0,
    income: 0,
    expenses: 0,
    bank: 'Ecobank',
  },
  {
    id: 'acc-cash',
    name: 'Physical Cash Box',
    type: 'Cash',
    balance: 0,
    income: 0,
    expenses: 0,
  },
];

/**
 * Fetches user transactions live from Supabase.
 */
export async function fetchUserTransactions(userId?: string): Promise<any[]> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    const targetId = userId || user?.id;
    if (!targetId) return [];

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((tx: any) => ({
      id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: tx.title,
      amount: parseFloat(tx.amount) || 0,
      category: tx.category || 'General',
      isIncome: tx.type === 'income',
      date: tx.date ? (isNaN(Date.parse(tx.date)) ? tx.date : new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : 'Recently',
      rawDate: tx.date ? (isNaN(Date.parse(tx.date)) ? new Date().toISOString().slice(0, 10) : new Date(tx.date).toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10),
      icon: tx.type === 'income' ? 'arrow-down-circle-outline' : 'cart-outline',
      accountId: tx.account_id || 'acc-overall',
      account: tx.account_id || 'Overall',
    }));
  } catch (e) {
    console.warn('Supabase fetchUserTransactions error:', e);
    return [];
  }
}

/**
 * Fetches user accounts from Supabase or returns 0-balance accounts.
 */
export async function fetchUserAccounts(userId?: string): Promise<DBAccount[]> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    const targetId = userId || user?.id;
    if (!targetId) return initialZeroAccounts;

    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('user_id', targetId);

    if (error || !data || data.length === 0) {
      return initialZeroAccounts;
    }

    return data.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: parseFloat(a.balance) || 0,
      income: parseFloat(a.income) || 0,
      expenses: parseFloat(a.expenses) || 0,
      number: a.number,
      bank: a.bank,
      exp: a.exp,
    }));
  } catch (e) {
    console.warn('Supabase fetchUserAccounts fallback:', e);
    return initialZeroAccounts;
  }
}

/**
 * Saves a new transaction (Income Source or Expense Payment) live to Supabase.
 */
export async function saveTransaction(tx: {
  title: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  frequency?: string;
  accountId?: string;
  date?: string;
}): Promise<boolean> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    const payload = {
      user_id: user.id,
      account_id: tx.accountId || 'acc-overall',
      title: tx.title,
      amount: tx.amount,
      category: tx.category,
      type: tx.type,
      frequency: tx.frequency || 'One-off',
      date: tx.date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('transactions').insert([payload]);
    if (error) {
      console.warn('Error inserting transaction in Supabase:', error.message);
      return false;
    }

    return true;
  } catch (e) {
    console.warn('Error in saveTransaction:', e);
    return false;
  }
}

/**
 * Deletes a transaction from Supabase table.
 */
export async function deleteTransactionFromSupabase(id: string): Promise<boolean> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.warn('Error deleting transaction from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Error in deleteTransactionFromSupabase:', e);
    return false;
  }
}

/**
 * Fetches user bills from Supabase.
 */
export async function fetchUserBills(userId?: string): Promise<any[]> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    const targetId = userId || user?.id;
    if (!targetId) return [];

    const { data, error } = await supabase
      .from('user_bills')
      .select('*')
      .eq('user_id', targetId);

    if (error || !data) return [];

    return data.map((b: any) => ({
      id: b.id,
      title: b.title,
      amount: parseFloat(b.amount) || 0,
      daysLeft: parseInt(b.days_left) || 0,
      dueDate: b.due_date,
      icon: b.icon || 'card-outline',
      color: b.color || '#3b82f6',
      isPaid: b.is_paid || false,
      isPrimary: b.is_primary || false,
      category: b.category || 'Subscription',
    }));
  } catch (e) {
    console.warn('Supabase fetchUserBills error:', e);
    return [];
  }
}

/**
 * Saves or updates a bill in Supabase.
 */
export async function saveBillToSupabase(bill: any): Promise<boolean> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    const payload = {
      id: bill.id,
      user_id: user.id,
      title: bill.title,
      amount: bill.amount,
      days_left: bill.daysLeft,
      due_date: bill.dueDate,
      icon: bill.icon,
      color: bill.color,
      is_paid: bill.isPaid,
      is_primary: bill.isPrimary,
      category: bill.category,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('user_bills').upsert(payload);
    if (error) {
      console.warn('Error saving bill in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Error in saveBillToSupabase:', e);
    return false;
  }
}

/**
 * Deletes a bill from Supabase.
 */
export async function deleteBillFromSupabase(id: string): Promise<boolean> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    const { error } = await supabase.from('user_bills').delete().eq('id', id).eq('user_id', user.id);
    if (error) {
      console.warn('Error deleting bill from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Error in deleteBillFromSupabase:', e);
    return false;
  }
}

/**
 * Fetches user savings goals from Supabase.
 */
export async function fetchUserGoals(userId?: string): Promise<any[]> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    const targetId = userId || user?.id;
    if (!targetId) return [];

    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', targetId);

    if (error || !data) return [];

    return data.map((g: any) => ({
      id: g.id,
      label: g.label,
      icon: g.icon || 'trophy-outline',
      saved: parseFloat(g.saved) || 0,
      target: parseFloat(g.target) || 0,
      color: g.color || '#73f218',
      deadline: g.deadline,
      monthlyContrib: parseFloat(g.monthly_contrib) || 0,
    }));
  } catch (e) {
    console.warn('Supabase fetchUserGoals error:', e);
    return [];
  }
}

/**
 * Saves or updates a savings goal in Supabase.
 */
export async function saveGoalToSupabase(goal: any): Promise<boolean> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    const payload = {
      id: goal.id,
      user_id: user.id,
      label: goal.label,
      icon: goal.icon,
      saved: goal.saved,
      target: goal.target,
      color: goal.color,
      deadline: goal.deadline,
      monthly_contrib: goal.monthlyContrib,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('savings_goals').upsert(payload);
    if (error) {
      console.warn('Error saving goal in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Error in saveGoalToSupabase:', e);
    return false;
  }
}

/**
 * Deletes a savings goal from Supabase.
 */
export async function deleteGoalFromSupabase(id: string): Promise<boolean> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return false;

    const { error } = await supabase.from('savings_goals').delete().eq('id', id).eq('user_id', user.id);
    if (error) {
      console.warn('Error deleting goal from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Error in deleteGoalFromSupabase:', e);
    return false;
  }
}
