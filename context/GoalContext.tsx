import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface SavingsGoal {
  id: string;
  label: string;
  icon: string;
  saved: number;
  target: number;
  color: string;
  deadline?: string;
  category?: string;
  monthlyContrib?: number;
  fuelSourceId?: string;
  fuelMode?: 'percent' | 'flat';
  fuelValue?: number;
}

const DEFAULT_GOALS: SavingsGoal[] = [];

interface GoalContextType {
  savingsGoals: SavingsGoal[];
  addGoal: (goal: Omit<SavingsGoal, 'id'>) => void;
  updateGoalProgress: (id: string, amountAdded: number) => void;
  updateGoal: (id: string, updatedData: Partial<SavingsGoal>) => void;
  deleteGoal: (id: string) => void;
}

const GoalContext = createContext<GoalContextType>({
  savingsGoals: DEFAULT_GOALS,
  addGoal: () => {},
  updateGoalProgress: () => {},
  updateGoal: () => {},
  deleteGoal: () => {},
});

import { fetchUserGoals, saveGoalToSupabase, deleteGoalFromSupabase } from '../lib/financeService';

export const GoalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(DEFAULT_GOALS);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const getStorageKey = (uid?: string | null) => {
    const id = uid || currentUserId;
    return id ? `@user_${id}_savings_goals` : '@savings_goals';
  };

  useEffect(() => {
    const loadGoals = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || null;
        setCurrentUserId(userId);
        const storageKey = getStorageKey(userId);

        if (user) {
          const dbGoals = await fetchUserGoals(user.id);
          if (dbGoals && dbGoals.length > 0) {
            setSavingsGoals(dbGoals);
            AsyncStorage.setItem(storageKey, JSON.stringify(dbGoals));
            return;
          }
        }

        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSavingsGoals(parsed);
          }
        }
      } catch (e) {
        console.warn('Error loading savings goals', e);
      }
    };
    loadGoals();
  }, []);

  const saveGoals = (updated: SavingsGoal[]) => {
    setSavingsGoals(updated);
    AsyncStorage.setItem(getStorageKey(), JSON.stringify(updated));
  };

  const addGoal = (newGoalData: Omit<SavingsGoal, 'id'>) => {
    const newGoal: SavingsGoal = {
      ...newGoalData,
      id: `g-${Date.now()}`,
    };
    const updated = [newGoal, ...savingsGoals];
    saveGoals(updated);
    saveGoalToSupabase(newGoal);
  };

  const updateGoalProgress = (id: string, amountAdded: number) => {
    const updated = savingsGoals.map(g => {
      if (g.id === id) {
        return { ...g, saved: Math.min(g.saved + amountAdded, g.target) };
      }
      return g;
    });
    saveGoals(updated);
    const target = updated.find(g => g.id === id);
    if (target) saveGoalToSupabase(target);
  };

  const updateGoal = (id: string, updatedData: Partial<SavingsGoal>) => {
    const updated = savingsGoals.map(g => {
      if (g.id === id) {
        return { ...g, ...updatedData };
      }
      return g;
    });
    saveGoals(updated);
    const target = updated.find(g => g.id === id);
    if (target) saveGoalToSupabase(target);
  };

  const deleteGoal = (id: string) => {
    saveGoals(savingsGoals.filter(g => g.id !== id));
    deleteGoalFromSupabase(id);
  };

  return (
    <GoalContext.Provider value={{ savingsGoals, addGoal, updateGoalProgress, updateGoal, deleteGoal }}>
      {children}
    </GoalContext.Provider>
  );
};

export const useGoals = () => useContext(GoalContext);
