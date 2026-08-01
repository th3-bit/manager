import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface BillItem {
  id: string;
  title: string;
  amount: number;
  daysLeft: number;
  dueDate: string;
  icon: string;
  category: 'Subscription' | 'Bill';
  isPaid: boolean;
  currencySymbol?: string;
  isPrimary?: boolean;
}

const DEFAULT_BILLS: BillItem[] = [];

interface BillContextType {
  bills: BillItem[];
  addBill: (bill: Omit<BillItem, 'id' | 'isPaid'>) => void;
  markAsPaid: (id: string) => void;
  deleteBill: (id: string) => void;
  totalUpcomingAmount: number;
}

const BillContext = createContext<BillContextType>({
  bills: DEFAULT_BILLS,
  addBill: () => {},
  markAsPaid: () => {},
  deleteBill: () => {},
  totalUpcomingAmount: 1053.98,
});

import { fetchUserBills, saveBillToSupabase, deleteBillFromSupabase } from '../lib/financeService';

export const BillProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bills, setBills] = useState<BillItem[]>(DEFAULT_BILLS);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const getStorageKey = (uid?: string | null) => {
    const id = uid || currentUserId;
    return id ? `@user_${id}_bills` : '@user_bills';
  };

  const recomputeDaysLeft = (list: BillItem[]): BillItem[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return list.map(b => {
      if (!b.dueDate) return b;
      const due = new Date(b.dueDate);
      if (isNaN(due.getTime())) return b;
      due.setHours(0, 0, 0, 0);
      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { ...b, daysLeft: diffDays >= 0 ? diffDays : 0 };
    });
  };

  useEffect(() => {
    const loadBills = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || null;
        setCurrentUserId(userId);
        const storageKey = getStorageKey(userId);

        if (user) {
          const dbBills = await fetchUserBills(user.id);
          if (dbBills && dbBills.length > 0) {
            const recalculated = recomputeDaysLeft(dbBills);
            setBills(recalculated);
            AsyncStorage.setItem(storageKey, JSON.stringify(recalculated));
            return;
          }
        }

        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const updated = recomputeDaysLeft(parsed);
            setBills(updated);
            AsyncStorage.setItem(storageKey, JSON.stringify(updated));
            return;
          }
        }
        setBills(recomputeDaysLeft(DEFAULT_BILLS));
      } catch (e) {
        console.warn('Error loading bills', e);
      }
    };
    loadBills();
  }, []);

  const saveBillsState = (updated: BillItem[]) => {
    const recalculated = recomputeDaysLeft(updated);
    setBills(recalculated);
    AsyncStorage.setItem(getStorageKey(), JSON.stringify(recalculated));
  };

  const addBill = (billData: Omit<BillItem, 'id' | 'isPaid'>) => {
    const newBill: BillItem = {
      ...billData,
      id: `bill-${Date.now()}`,
      isPaid: false,
    };
    const updated = [newBill, ...bills];
    saveBillsState(updated);
    saveBillToSupabase(newBill);
  };

  const markAsPaid = (id: string) => {
    const updated = bills.map(b => (b.id === id ? { ...b, isPaid: true } : b));
    saveBillsState(updated);
    const target = updated.find(b => b.id === id);
    if (target) saveBillToSupabase(target);
  };

  const deleteBill = (id: string) => {
    const updated = bills.filter(b => b.id !== id);
    saveBillsState(updated);
    deleteBillFromSupabase(id);
  };

  const activeBills = bills.filter(b => !b.isPaid);
  const totalUpcomingAmount = activeBills.reduce((acc, b) => acc + b.amount, 0);

  return (
    <BillContext.Provider
      value={{
        bills,
        addBill,
        markAsPaid,
        deleteBill,
        totalUpcomingAmount,
      }}
    >
      {children}
    </BillContext.Provider>
  );
};

export const useBills = () => useContext(BillContext);
