import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { fetchUserAccounts } from '../lib/financeService';
import { useTransactions } from './TransactionContext';

export interface AccountItem {
  id: string;
  name: string;
  institution: string;
  type: 'Checking' | 'Savings' | 'MobileMoney' | 'Cash' | 'CreditCard' | 'Investment' | 'Overall';
  balance: number;
  currency: string;
  isDefault: boolean;
  cardNo?: string;
  expDate?: string;
  color?: string[];
  income?: number;
  expenses?: number;
}

const DEFAULT_ACCOUNTS: AccountItem[] = [];

interface AccountContextType {
  accounts: AccountItem[];
  addAccount: (acc: Omit<AccountItem, 'id'>) => void;
  updateAccountBalance: (id: string, newBalance: number) => void;
  transferBetweenAccounts: (fromId: string, toId: string, amount: number) => boolean;
  setDefaultAccount: (id: string) => void;
  deleteAccount: (id: string) => void;
  totalNetWorthUSD: number;
}

const AccountContext = createContext<AccountContextType>({
  accounts: DEFAULT_ACCOUNTS,
  addAccount: () => {},
  updateAccountBalance: () => {},
  transferBetweenAccounts: () => false,
  setDefaultAccount: () => {},
  deleteAccount: () => {},
  totalNetWorthUSD: 0,
});

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<AccountItem[]>(DEFAULT_ACCOUNTS);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { transactions, totalIncome, totalExpenses } = useTransactions();
  const netTxBalance = totalIncome - totalExpenses;

  const getStorageKey = (uid?: string | null) => {
    const id = uid || currentUserId;
    return id ? `@user_${id}_accounts` : '@user_accounts';
  };

  const getAccountTxTotals = (accId: string, accName: string, accType: string) => {
    const accTxs = transactions.filter(t => {
      if (t.accountId && (t.accountId === accId || t.accountId === accType || t.accountId.toLowerCase() === accName.toLowerCase())) return true;
      if (!t.account) return false;
      const tAcc = t.account.toLowerCase();
      const name = accName.toLowerCase();
      const type = accType.toLowerCase();
      return (
        tAcc === name ||
        tAcc === type ||
        (type === 'mobilemoney' && (tAcc.includes('momo') || tAcc.includes('mtn') || tAcc.includes('mobile'))) ||
        ((type === 'creditcard' || type === 'checking' || type === 'cards') && (tAcc.includes('visa') || tAcc.includes('card') || tAcc.includes('checking') || tAcc.includes('credit'))) ||
        (type === 'cash' && (tAcc.includes('cash') || tAcc.includes('physical')))
      );
    });

    const inc = accTxs.filter(t => t.isIncome).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const exp = accTxs.filter(t => !t.isIncome).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return { income: inc, expenses: exp, net: inc - exp };
  };

  const recalculateAccounts = (rawList: AccountItem[]): AccountItem[] => {
    const updatedSubAccounts = rawList.map(a => {
      if (a.type === 'Overall' || a.id === 'acc-overall') return a;

      const txTotals = getAccountTxTotals(a.id, a.name, a.type);
      const baseBal = Number(a.balance) || 0;
      const baseInc = Number(a.income) || 0;
      const baseExp = Number(a.expenses) || 0;

      const calcInc = baseInc > 0 ? baseInc : txTotals.income;
      const calcExp = baseExp > 0 ? baseExp : txTotals.expenses;
      const calcBal = baseBal !== 0 ? baseBal : (txTotals.net !== 0 ? txTotals.net : baseBal);

      return {
        ...a,
        balance: calcBal,
        income: calcInc,
        expenses: calcExp,
      };
    });

    const nonOverall = updatedSubAccounts.filter(a => a.type !== 'Overall' && a.id !== 'acc-overall');
    const sumBalances = nonOverall.reduce((sum, a) => {
      const bal = Number(a.balance) || 0;
      if (a.currency === 'RWF') return sum + (bal / 1380);
      return sum + bal;
    }, 0);
    const sumIncome = nonOverall.reduce((sum, a) => sum + (Number(a.income) || 0), 0);
    const sumExpenses = nonOverall.reduce((sum, a) => sum + (Number(a.expenses) || 0), 0);

    const effectiveBalance = sumBalances + netTxBalance;
    const effectiveIncome = Math.max(sumIncome, totalIncome);
    const effectiveExpenses = Math.max(sumExpenses, totalExpenses);

    const hasOverall = updatedSubAccounts.some(a => a.type === 'Overall' || a.id === 'acc-overall');

    if (hasOverall) {
      return updatedSubAccounts.map(a => {
        if (a.type === 'Overall' || a.id === 'acc-overall') {
          return {
            ...a,
            balance: effectiveBalance,
            income: effectiveIncome,
            expenses: effectiveExpenses,
          };
        }
        return a;
      });
    } else {
      const overallItem: AccountItem = {
        id: 'acc-overall',
        name: 'Net Worth Overall',
        institution: 'All Connected Accounts',
        type: 'Overall',
        balance: effectiveBalance,
        currency: 'USD',
        isDefault: true,
        cardNo: 'Portfolio Net',
        expDate: 'Active',
        color: ['#0f172a', '#1e293b', '#0f172a'],
        income: effectiveIncome,
        expenses: effectiveExpenses,
      };
      return [overallItem, ...updatedSubAccounts];
    }
  };

  useEffect(() => {
    setAccounts(prev => recalculateAccounts(prev));
  }, [totalIncome, totalExpenses, transactions]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || null;
        setCurrentUserId(userId);
        const storageKey = getStorageKey(userId);

        if (user) {
          const dbAccs = await fetchUserAccounts(user.id);
          if (dbAccs && dbAccs.length > 0) {
            const formatted: AccountItem[] = dbAccs.map(a => ({
              id: a.id,
              name: a.name,
              institution: a.bank || a.name,
              type: (a.type as any) || 'Checking',
              balance: a.balance,
              currency: 'USD',
              isDefault: a.type === 'Overall',
              cardNo: a.number || '•••• 8849',
              expDate: a.exp || 'Active',
              color: ['#0f172a', '#1e293b', '#0f172a'],
              income: a.income,
              expenses: a.expenses,
            }));
            const recalculated = recalculateAccounts(formatted);
            setAccounts(recalculated);
            AsyncStorage.setItem(storageKey, JSON.stringify(recalculated));
            return;
          }
        }

        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const recalculated = recalculateAccounts(parsed);
            setAccounts(recalculated);
            AsyncStorage.setItem(storageKey, JSON.stringify(recalculated));
            return;
          }
        }

        const recalculatedDefault = recalculateAccounts(DEFAULT_ACCOUNTS);
        setAccounts(recalculatedDefault);
      } catch (e) {
        console.warn('Error loading accounts', e);
      }
    };
    loadAccounts();
  }, []);

  const saveAccountsState = (rawList: AccountItem[]) => {
    const updated = recalculateAccounts(rawList);
    setAccounts(updated);
    AsyncStorage.setItem(getStorageKey(), JSON.stringify(updated));
  };

  const addAccount = (newAccData: Omit<AccountItem, 'id'>) => {
    const newAcc: AccountItem = {
      ...newAccData,
      id: `acc-${Date.now()}`,
      color: newAccData.color || ['#0f172a', '#1e293b', '#0f172a'],
    };
    saveAccountsState([...accounts, newAcc]);
  };

  const updateAccountBalance = (id: string, newBalance: number) => {
    const updated = accounts.map(a => (a.id === id ? { ...a, balance: newBalance } : a));
    saveAccountsState(updated);
  };

  const transferBetweenAccounts = (fromId: string, toId: string, amount: number): boolean => {
    const source = accounts.find(a => a.id === fromId);
    if (!source || source.balance < amount) return false;

    const updated = accounts.map(a => {
      if (a.id === fromId) return { ...a, balance: a.balance - amount, expenses: (a.expenses || 0) + amount };
      if (a.id === toId) return { ...a, balance: a.balance + amount, income: (a.income || 0) + amount };
      return a;
    });

    saveAccountsState(updated);
    return true;
  };

  const setDefaultAccount = (id: string) => {
    const updated = accounts.map(a => ({ ...a, isDefault: a.id === id }));
    saveAccountsState(updated);
  };

  const deleteAccount = (id: string) => {
    saveAccountsState(accounts.filter(a => a.id !== id));
  };

  const overallAcc = accounts.find(a => a.type === 'Overall' || a.id === 'acc-overall');
  const totalNetWorthUSD = overallAcc ? overallAcc.balance : netTxBalance;

  return (
    <AccountContext.Provider
      value={{
        accounts,
        addAccount,
        updateAccountBalance,
        transferBetweenAccounts,
        setDefaultAccount,
        deleteAccount,
        totalNetWorthUSD,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccounts = () => useContext(AccountContext);
