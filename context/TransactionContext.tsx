import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { fetchUserTransactions, saveTransaction as saveTxToSupabase, deleteTransactionFromSupabase } from '../lib/financeService';

export interface TransactionItem {
  id: string;
  title: string;
  amount: number;
  isIncome: boolean;
  category: string;
  account: string;
  accountId?: string;
  date: string;
  rawDate?: string;
  icon?: string;
  color?: string;
  method?: string;
  type?: string;
  currencySymbol?: string;
  currencyCode?: string;
}

const DEFAULT_TRANSACTIONS: TransactionItem[] = [];

interface TransactionContextType {
  transactions: TransactionItem[];
  addTransaction: (tx: Omit<TransactionItem, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => void;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNet: number;
}

const TransactionContext = createContext<TransactionContextType>({
  transactions: DEFAULT_TRANSACTIONS,
  addTransaction: async () => {},
  deleteTransaction: () => {},
  totalIncome: 3950,
  totalExpenses: 1275.99,
  netBalance: 2674.01,
  monthlyIncome: 3950,
  monthlyExpenses: 1275.99,
  monthlyNet: 2674.01,
});

export const TransactionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<TransactionItem[]>(DEFAULT_TRANSACTIONS);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const getStorageKey = (uid?: string | null) => {
    const id = uid || currentUserId;
    return id ? `@user_${id}_transactions` : '@user_transactions';
  };

  // Load user transactions from Supabase or AsyncStorage
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || null;
        setCurrentUserId(userId);
        const storageKey = getStorageKey(userId);

        // Load local storage first to capture any offline transactions
        const stored = await AsyncStorage.getItem(storageKey);
        let localTxs: TransactionItem[] = [];
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) localTxs = parsed;
          } catch (e) {}
        }

        if (user) {
          const dbTx = await fetchUserTransactions(user.id);
          if (dbTx && dbTx.length > 0) {
            const formattedDbTx: TransactionItem[] = dbTx.map((t: any) => ({
              id: t.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              title: t.title,
              amount: t.amount,
              isIncome: t.isIncome,
              category: t.category || 'General',
              account: t.account || t.accountId || 'Overall',
              accountId: t.accountId || 'acc-overall',
              date: t.date || new Date().toLocaleString(),
              rawDate: t.rawDate || (t.date && !isNaN(Date.parse(t.date)) ? new Date(t.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
              icon: t.icon || (t.isIncome ? 'cash-outline' : 'card-outline'),
              color: t.color || (t.isIncome ? '#73f218' : '#ef4444'),
              method: t.accountId || 'Digital Card',
              type: t.isIncome ? 'Income' : 'Expense',
            }));

            // Offline Merge Strategy: Keep local offline transactions not yet synced
            const dbIds = new Set(formattedDbTx.map(t => t.id));
            const offlineOnly = localTxs.filter(t => !dbIds.has(t.id) && t.id.startsWith('tx-'));
            const mergedList = [...formattedDbTx, ...offlineOnly];

            setTransactions(mergedList);
            AsyncStorage.setItem(storageKey, JSON.stringify(mergedList));
            return;
          }
        }

        if (localTxs.length > 0) {
          setTransactions(localTxs);
        }
      } catch (e) {
        console.warn('Error loading transactions', e);
      }
    };
    loadTransactions();
  }, []);

  const saveTransactionsState = (updated: TransactionItem[]) => {
    setTransactions(updated);
    AsyncStorage.setItem(getStorageKey(), JSON.stringify(updated));
  };

  const addTransaction = async (newTxData: Omit<TransactionItem, 'id'>) => {
    const newTx: TransactionItem = {
      ...newTxData,
      id: `tx-${Date.now()}`,
      date: newTxData.date || 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rawDate: newTxData.rawDate || new Date().toISOString().slice(0, 10),
      icon: newTxData.icon || (newTxData.isIncome ? 'cash-outline' : 'card-outline'),
      color: newTxData.color || (newTxData.isIncome ? '#73f218' : '#ef4444'),
      type: newTxData.isIncome ? 'Income' : 'Expense',
    };

    const updatedList = [newTx, ...transactions];
    saveTransactionsState(updatedList);

    // Save to Supabase if authenticated
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await saveTxToSupabase({
          title: newTx.title,
          amount: newTx.amount,
          category: newTx.category,
          type: newTx.isIncome ? 'income' : 'expense',
          accountId: newTx.account,
          date: newTx.date,
        });
      }
    } catch (err) {
      console.warn('Supabase tx save warning:', err);
    }
  };

  const deleteTransaction = async (id: string) => {
    const updated = transactions.filter(t => t.id !== id);
    saveTransactionsState(updated);
    try {
      await deleteTransactionFromSupabase(id);
    } catch (e) {
      console.warn('Supabase tx delete warning:', e);
    }
  };

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthlyTransactions = transactions.filter(t => {
    const raw = t.rawDate || (t.date && !isNaN(Date.parse(t.date)) ? new Date(t.date).toISOString().slice(0, 10) : null);
    if (!raw) return true;
    return raw.startsWith(currentMonthPrefix);
  });

  const monthlyIncome = monthlyTransactions.filter(t => t.isIncome).reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpenses = monthlyTransactions.filter(t => !t.isIncome).reduce((sum, t) => sum + t.amount, 0);
  const monthlyNet = monthlyIncome - monthlyExpenses;

  const totalIncome = transactions.filter(t => t.isIncome).reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => !t.isIncome).reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        addTransaction,
        deleteTransaction,
        totalIncome,
        totalExpenses,
        netBalance,
        monthlyIncome,
        monthlyExpenses,
        monthlyNet,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => useContext(TransactionContext);
