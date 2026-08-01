import React, { useState, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Dimensions, TouchableOpacity,
  TextInput, Modal, Alert, Switch, Image, Platform, KeyboardAvoidingView, Share
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCurrency } from '../../context/CurrencyContext';
import { useGoals } from '../../context/GoalContext';
import { useBills } from '../../context/BillContext';
import { useTransactions } from '../../context/TransactionContext';

const { width, height } = Dimensions.get('window');

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flagUrl: 'https://flagcdn.com/w80/us.png' },
  { code: 'EUR', symbol: '€', name: 'Euro', flagUrl: 'https://flagcdn.com/w80/eu.png' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flagUrl: 'https://flagcdn.com/w80/gb.png' },
  { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc', flagUrl: 'https://flagcdn.com/w80/rw.png' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', flagUrl: 'https://flagcdn.com/w80/ke.png' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flagUrl: 'https://flagcdn.com/w80/ca.png' },
];

const getDefaultCurrency = () => {
  try {
    const locale = (Intl.DateTimeFormat().resolvedOptions().locale || (typeof navigator !== 'undefined' ? navigator?.language : '') || '').toUpperCase();
    if (locale.includes('-RW') || locale.includes('_RW')) return CURRENCIES.find(c => c.code === 'RWF') || CURRENCIES[0];
    if (locale.includes('-KE') || locale.includes('_KE')) return CURRENCIES.find(c => c.code === 'KES') || CURRENCIES[0];
    if (locale.includes('-GB') || locale.includes('_GB')) return CURRENCIES.find(c => c.code === 'GBP') || CURRENCIES[0];
    if (locale.includes('-CA') || locale.includes('_CA')) return CURRENCIES.find(c => c.code === 'CAD') || CURRENCIES[0];

    const timeZone = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    if (timeZone.includes('kigali') || timeZone.includes('rwanda')) return CURRENCIES.find(c => c.code === 'RWF') || CURRENCIES[0];
    if (timeZone.includes('nairobi') || timeZone.includes('kenya')) return CURRENCIES.find(c => c.code === 'KES') || CURRENCIES[0];
    if (timeZone.includes('london') || timeZone.includes('gb') || timeZone.includes('uk')) return CURRENCIES.find(c => c.code === 'GBP') || CURRENCIES[0];
    if (timeZone.includes('toronto') || timeZone.includes('vancouver') || timeZone.includes('edmonton') || timeZone.includes('winnipeg') || timeZone.includes('canada')) return CURRENCIES.find(c => c.code === 'CAD') || CURRENCIES[0];
    if (timeZone.includes('europe/') || timeZone.includes('paris') || timeZone.includes('berlin') || timeZone.includes('madrid') || timeZone.includes('rome') || timeZone.includes('amsterdam') || timeZone.includes('brussels')) return CURRENCIES.find(c => c.code === 'EUR') || CURRENCIES[0];
  } catch (e) {
    console.log('Error detecting default currency:', e);
  }
  return CURRENCIES[0];
};

// ── Financial Health Score Gauge ───────────────────────────────────────────────
const HealthScoreGauge = ({ score }: { score: number }) => {
  const size = 110;
  const stroke = 8;
  const pct = score;
  const color = score > 80 ? '#73f218' : score > 50 ? '#f59e0b' : '#ef4444';
  
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: stroke, borderColor: 'rgba(255,255,255,0.06)'
      }} />
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: stroke, borderColor: 'transparent',
        borderTopColor: color,
        borderRightColor: pct > 25 ? color : 'transparent',
        borderBottomColor: pct > 50 ? color : 'transparent',
        borderLeftColor: pct > 75 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }]
      }} />
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{score}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Health</Text>
      </View>
    </View>
  );
};

// ── Main Dashboard Screen ──────────────────────────────────────────────────────
export function BudgetScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { currency, setCurrency, formatAmount } = useCurrency();
  const CALENDAR_WIDTH = Math.min(width - 32, 340);
  const CELL_WIDTH = (CALENDAR_WIDTH - 40) / 7;
  
  const MAP_CONTAINER_WIDTH = width - 64; // screen width - margins (16*2) - card padding (16*2)
  const MAP_CELL_WIDTH = Math.floor((MAP_CONTAINER_WIDTH - 24) / 7);

  // Navigation states
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'categories' | 'analytics' | 'goals'>('overview');
  const [monthOffset, setMonthOffset] = useState(0); // 0 = July 2026, -1 = June 2026, etc.
  const [budgetPeriod, setBudgetPeriod] = useState('Monthly');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'warning' | 'completed'>('all');

  // Math references (Mock monthly pool values)
  const currentMonthData = useMemo(() => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const baseMonth = 6; // July
    const baseYear = 2026;
    let targetMonthIdx = baseMonth + monthOffset;
    let targetYear = baseYear + Math.floor(targetMonthIdx / 12);
    targetMonthIdx = ((targetMonthIdx % 12) + 12) % 12;
    return {
      monthName: months[targetMonthIdx],
      monthIdx: targetMonthIdx,
      year: targetYear,
      label: `${months[targetMonthIdx]} ${targetYear}`
    };
  }, [monthOffset]);

  const currentMonthLabel = currentMonthData.label;

  const dailySpendWeeks = useMemo(() => {
    const daysInMonth = new Date(currentMonthData.year, currentMonthData.monthIdx + 1, 0).getDate();
    const firstDayIndex = new Date(currentMonthData.year, currentMonthData.monthIdx, 1).getDay();

    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ id: `empty-${i}`, day: null });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ id: `day-${i}`, day: i });
    }

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [currentMonthData]);

  // Budget data states
  const [categories, setCategories] = useState([
    { id: '1', name: 'Housing', spent: 0, budget: 0, icon: 'home-outline', color: '#14b8a6', txCount: 0, dailyAvg: 0, forecast: 0 },
    { id: '2', name: 'Food', spent: 0, budget: 0, icon: 'fast-food-outline', color: '#f59e0b', txCount: 0, dailyAvg: 0, forecast: 0 },
    { id: '3', name: 'Transportation', spent: 0, budget: 0, icon: 'car-outline', color: '#6366f1', txCount: 0, dailyAvg: 0, forecast: 0 },
    { id: '4', name: 'Shopping', spent: 0, budget: 0, icon: 'shirt-outline', color: '#ec4899', txCount: 0, dailyAvg: 0, forecast: 0 },
    { id: '5', name: 'Health', spent: 0, budget: 0, icon: 'medkit-outline', color: '#73f218', txCount: 0, dailyAvg: 0, forecast: 0 },
    { id: '6', name: 'Entertainment', spent: 0, budget: 0, icon: 'game-controller-outline', color: '#a855f7', txCount: 0, dailyAvg: 0, forecast: 0 },
    { id: '7', name: 'Bills', spent: 0, budget: 0, icon: 'newspaper-outline', color: '#3b82f6', txCount: 0, dailyAvg: 0, forecast: 0 },
    { id: '8', name: 'Travel', spent: 0, budget: 0, icon: 'airplane-outline', color: '#06b6d4', txCount: 0, dailyAvg: 0, forecast: 0 },
    { id: '9', name: 'Miscellaneous', spent: 0, budget: 0, icon: 'wallet-outline', color: '#64748b', txCount: 0, dailyAvg: 0, forecast: 0 }
  ]);

  interface SavingsGoal {
    id: string;
    name: string;
    target: number;
    saved: number;
    deadline: string;
    monthlyContribution: number;
    fuelSourceId?: string;
    fuelMode?: 'percent' | 'flat';
    fuelValue?: number;
  }

  const { savingsGoals: rawGoals, addGoal, updateGoalProgress, updateGoal, deleteGoal } = useGoals();

  const savingsGoals = rawGoals.map(g => ({
    id: g.id,
    name: g.label,
    target: g.target,
    saved: g.saved,
    deadline: g.deadline || 'Dec 2026',
    monthlyContribution: g.monthlyContrib || Math.round(g.target / 12),
    icon: g.icon || '🎯',
    color: g.color || '#73f218',
    fuelSourceId: g.fuelSourceId,
    fuelMode: g.fuelMode,
    fuelValue: g.fuelValue,
  }));

  const { bills: globalBills, markAsPaid, addBill } = useBills();

  const upcomingBills = globalBills.map(b => ({
    id: b.id,
    name: b.title,
    amount: b.amount,
    date: b.dueDate,
    daysLeft: b.daysLeft,
    category: b.category,
    icon: b.icon || 'card-outline',
    color: b.daysLeft <= 3 ? '#ef4444' : b.daysLeft <= 7 ? '#f59e0b' : '#73f218',
    autoPay: b.isPrimary || false,
    paid: b.isPaid,
  }));

  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [financialNotes, setFinancialNotes] = useState<any[]>([]);

  const { transactions: globalTransactions, totalIncome: txTotalIncome, totalExpenses: txTotalExpenses } = useTransactions();

  const liveCategories = useMemo(() => {
    const targetMonthStr = `${currentMonthData.year}-${String(currentMonthData.monthIdx + 1).padStart(2, '0')}`;

    return categories.map(c => {
      const catExpenses = globalTransactions.filter(t => {
        if (t.isIncome) return false;
        if (!t.category) return false;

        // Period filter (Monthly cycle matching selected header month)
        if (t.date && budgetPeriod === 'Monthly') {
          const tDate = t.date.trim();
          if (tDate.length >= 7 && tDate.includes('-') && !tDate.startsWith(targetMonthStr)) {
            return false;
          }
        }

        const catName = c.name.toLowerCase();
        const txCat = t.category.toLowerCase();
        return (
          txCat === catName ||
          (catName.includes('housing') && (txCat.includes('house') || txCat.includes('rent') || txCat.includes('housing'))) ||
          (catName.includes('food') && (txCat.includes('food') || txCat.includes('grocer') || txCat.includes('dine') || txCat.includes('restaurant'))) ||
          (catName.includes('transportation') && (txCat.includes('transport') || txCat.includes('car') || txCat.includes('fuel') || txCat.includes('gas') || txCat.includes('uber') || txCat.includes('taxi'))) ||
          (catName.includes('shopping') && (txCat.includes('shop') || txCat.includes('cloth') || txCat.includes('retail'))) ||
          (catName.includes('health') && (txCat.includes('health') || txCat.includes('med') || txCat.includes('doctor') || txCat.includes('pharmacy'))) ||
          (catName.includes('entertainment') && (txCat.includes('entertain') || txCat.includes('movie') || txCat.includes('game') || txCat.includes('fun'))) ||
          (catName.includes('bills') && (txCat.includes('bill') || txCat.includes('subscript') || txCat.includes('utility')))
        );
      });

      const totalSpent = catExpenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const txCount = catExpenses.length;
      const remaining = c.budget - totalSpent;
      const pct = c.budget > 0 ? Math.round((totalSpent / c.budget) * 100) : 0;

      return {
        ...c,
        spent: totalSpent,
        remaining,
        pct,
        txCount,
      };
    });
  }, [categories, globalTransactions, currentMonthData, budgetPeriod]);

  // Aggregate sums
  const totalAllocatedBudget = useMemo(() => liveCategories.reduce((acc, curr) => acc + curr.budget, 0), [liveCategories]);
  const totalSpent = useMemo(() => {
    const catSpent = liveCategories.reduce((acc, curr) => acc + curr.spent, 0);
    return txTotalExpenses > 0 ? txTotalExpenses : catSpent;
  }, [liveCategories, txTotalExpenses]);
  const remainingBudget = totalAllocatedBudget - totalSpent;
  const budgetPctUsed = totalAllocatedBudget > 0 ? Math.min(Math.round((totalSpent / totalAllocatedBudget) * 100), 100) : 0;

  // Status computation
  const budgetStatus = useMemo(() => {
    if (budgetPctUsed > 95) return { label: 'Exceeded', color: '#ef4444' };
    if (budgetPctUsed > 80) return { label: 'Critical', color: '#f87171' };
    if (budgetPctUsed > 65) return { label: 'Warning', color: '#f59e0b' };
    if (budgetPctUsed > 40) return { label: 'Good', color: '#3b82f6' };
    return { label: 'Excellent', color: '#73f218' };
  }, [budgetPctUsed]);

  // Modals state
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [editCategory, setEditCategory] = useState<any>(null);
  const [editBudgetAmount, setEditBudgetAmount] = useState('');
  const [addCatModalVisible, setAddCatModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatBudget, setNewCatBudget] = useState('');
  const [newCatColor, setNewCatColor] = useState('#14b8a6');
  const [newCatIcon, setNewCatIcon] = useState('pricetag-outline');
  const [sortBy, setSortBy] = useState<'default' | 'spent' | 'pct' | 'budget' | 'name'>('default');
  
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [addTxModalVisible, setAddTxModalVisible] = useState(false);
  const [addBillModalVisible, setAddBillModalVisible] = useState(false);
  const [newBillTitle, setNewBillTitle] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillDueDate, setNewBillDueDate] = useState('');
  const [newBillCategory, setNewBillCategory] = useState<'Subscription' | 'Bill'>('Bill');
  const [newBillIcon, setNewBillIcon] = useState('receipt-outline');
  
  // Export & Settings Modals
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState('PDF');
  const [exportTimeRange, setExportTimeRange] = useState('This Month');
  const [exportIncludeIncExp, setExportIncludeIncExp] = useState(true);
  const [exportIncludeBudgets, setExportIncludeBudgets] = useState(true);
  const [exportIncludeGoals, setExportIncludeGoals] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('2026-07-01');
  const [exportEndDate, setExportEndDate] = useState('2026-07-30');
  
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [rolloverBudget, setRolloverBudget] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [showSettingsCurrencyPicker, setShowSettingsCurrencyPicker] = useState(false);
  
  const [newTxMerchant, setNewTxMerchant] = useState('');
  const [newTxCategory, setNewTxCategory] = useState('Food');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxDate, setNewTxDate] = useState('2026-07-16');
  const [newTxFrequency, setNewTxFrequency] = useState('One-off');
  const [newTxIsContinuous, setNewTxIsContinuous] = useState(true);
  const [newTxEndDate, setNewTxEndDate] = useState('');
  const [newNoteInput, setNewNoteInput] = useState('');

  // Income streams state
  const [incomeStreams, setIncomeStreams] = useState<any[]>([]);

  const [addIncModalVisible, setAddIncModalVisible] = useState(false);
  const [newIncName, setNewIncName] = useState('');
  const [newIncAmount, setNewIncAmount] = useState('');
  const [newIncCategory, setNewIncCategory] = useState('Salary');
  const [newIncFrequency, setNewIncFrequency] = useState('Monthly');
  const [newIncDate, setNewIncDate] = useState('2026-07-16');
  const [newIncIsContinuous, setNewIncIsContinuous] = useState(true);
  const [newIncEndDate, setNewIncEndDate] = useState('');

  // Currency States for Modals (bound to global currency)
  const [incCurrency, setIncCurrency] = useState(currency);
  const [showIncCurrencyPicker, setShowIncCurrencyPicker] = useState(false);
  const [txCurrency, setTxCurrency] = useState(currency);
  const [showTxCurrencyPicker, setShowTxCurrencyPicker] = useState(false);
  const [goalCurrency, setGoalCurrency] = useState(currency);
  const [showGoalCurrencyPicker, setShowGoalCurrencyPicker] = useState(false);

  useEffect(() => {
    if (currency) {
      setIncCurrency(currency);
      setTxCurrency(currency);
      setGoalCurrency(currency);
    }
  }, [currency]);

  const activeIncCurrency = incCurrency && incCurrency.code ? incCurrency : currency;
  const activeTxCurrency = txCurrency && txCurrency.code ? txCurrency : currency;
  const activeGoalCurrency = goalCurrency && goalCurrency.code ? goalCurrency : currency;
  
  // picker nested states
  const [isSpecifyingOtherIncome, setIsSpecifyingOtherIncome] = useState(false);
  const [tempOtherIncomeName, setTempOtherIncomeName] = useState('');
  const [analyticsTimeFrame, setAnalyticsTimeFrame] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [isSpecifyingOtherMerchant, setIsSpecifyingOtherMerchant] = useState(false);
  const [tempOtherMerchantName, setTempOtherMerchantName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
  const [breakdownModalVisible, setBreakdownModalVisible] = useState(false);
  const [breakdownTitle, setBreakdownTitle] = useState('');
  const [breakdownTxs, setBreakdownTxs] = useState<any[]>([]);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [editGoalModalVisible, setEditGoalModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editGoalIcon, setEditGoalIcon] = useState('🎯');
  const [editGoalSaved, setEditGoalSaved] = useState('');
  const [editGoalTarget, setEditGoalTarget] = useState('');
  const [editGoalMonthlyContrib, setEditGoalMonthlyContrib] = useState('');
  const [editGoalDeadline, setEditGoalDeadline] = useState('');
  const [addGoalModalVisible, setAddGoalModalVisible] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalInitialSaved, setNewGoalInitialSaved] = useState('');
  const [newGoalPaceMode, setNewGoalPaceMode] = useState<'date' | 'monthly'>('date');
  const [newGoalMonthsRemaining, setNewGoalMonthsRemaining] = useState(6);
  const [newGoalMonthlySaving, setNewGoalMonthlySaving] = useState('');
  const [selectedGoalPreset, setSelectedGoalPreset] = useState('Emergency Fund');
  const [goalNamePickerVisible, setGoalNamePickerVisible] = useState(false);
  const [isSpecifyingOtherGoal, setIsSpecifyingOtherGoal] = useState(false);
  const [tempOtherGoalName, setTempOtherGoalName] = useState('');
  const [newGoalFuelSourceId, setNewGoalFuelSourceId] = useState('none');
  const [newGoalFuelMode, setNewGoalFuelMode] = useState<'percent' | 'flat'>('flat');
  const [newGoalFuelValue, setNewGoalFuelValue] = useState('');
  const [fuelSourcePickerVisible, setFuelSourcePickerVisible] = useState(false);

  // Picker Modals Visibility
  const [incSourcePickerVisible, setIncSourcePickerVisible] = useState(false);
  const [expCatPickerVisible, setExpCatPickerVisible] = useState(false);
  const [presetMerchantPickerVisible, setPresetMerchantPickerVisible] = useState(false);

  // Custom Calendar Picker States
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'expense' | 'income' | 'exportStart' | 'exportEnd'>('expense');
  const [calMonth, setCalMonth] = useState(6); // July
  const [calYear, setCalYear] = useState(2026);
  const [calSelectedDay, setCalSelectedDay] = useState(16);

  const openCalendarPicker = (target: 'expense' | 'income' | 'exportStart' | 'exportEnd', currentDateStr: string) => {
    setCalendarTarget(target);
    const parts = currentDateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      const day = parseInt(parts[2], 10);
      setCalYear(year);
      setCalMonth(month);
      setCalSelectedDay(day);
    } else {
      setCalYear(2026);
      setCalMonth(6);
      setCalSelectedDay(16);
    }
    setCalendarVisible(true);
  };

  const handleSelectCalendarDay = (day: number) => {
    const formattedMonth = String(calMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${calYear}-${formattedMonth}-${formattedDay}`;
    if (calendarTarget === 'expense') {
      setNewTxDate(dateStr);
    } else if (calendarTarget === 'income') {
      setNewIncDate(dateStr);
    } else if (calendarTarget === 'exportStart') {
      setExportStartDate(dateStr);
    } else if (calendarTarget === 'exportEnd') {
      setExportEndDate(dateStr);
    }
    setCalendarVisible(false);
  };

  const monthsList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const changeCalMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (calMonth === 0) {
        setCalMonth(11);
        setCalYear(prev => prev - 1);
      } else {
        setCalMonth(prev => prev - 1);
      }
    } else {
      if (calMonth === 11) {
        setCalMonth(0);
        setCalYear(prev => prev + 1);
      } else {
        setCalMonth(prev => prev + 1);
      }
    }
  };

  const calendarCells = useMemo(() => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();

    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ id: `empty-${i}`, day: null });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ id: `day-${i}`, day: i });
    }
    return cells;
  }, [calMonth, calYear]);

  const streamIncome = useMemo(() => incomeStreams.reduce((acc, curr) => acc + curr.amount, 0), [incomeStreams]);
  const totalIncome = useMemo(() => streamIncome + (txTotalIncome || 0), [streamIncome, txTotalIncome]);
  const totalSavings = useMemo(() => savingsGoals.reduce((acc, curr) => acc + (Number(curr.saved) || 0), 0), [savingsGoals]);

  // Dynamic Financial Health Score computation
  const healthMetrics = useMemo(() => {
    let budgetPts = 40;
    if (totalAllocatedBudget > 0) {
      const pct = (totalSpent / totalAllocatedBudget) * 100;
      if (pct <= 70) budgetPts = 40;
      else if (pct <= 85) budgetPts = 32;
      else if (pct <= 100) budgetPts = 24;
      else budgetPts = Math.max(0, Math.round(24 - (pct - 100) * 0.4));
    }

    let savingsPts = 20;
    if (totalIncome > 0) {
      const savRatio = (totalIncome - totalSpent) / totalIncome;
      if (savRatio >= 0.30) savingsPts = 35;
      else if (savRatio >= 0.15) savingsPts = 28;
      else if (savRatio >= 0) savingsPts = 20;
      else savingsPts = Math.max(0, Math.round(20 + savRatio * 40));
    }

    let billPts = 25;
    if (globalBills.length > 0) {
      const paidCount = globalBills.filter(b => b.isPaid).length;
      billPts = Math.round((paidCount / globalBills.length) * 25);
    }

    const totalScore = Math.min(100, Math.max(0, budgetPts + savingsPts + billPts));

    let label = 'Good';
    let color = '#73f218';
    let subtitle = 'Your savings rate and bill history are well balanced.';

    if (totalScore >= 90) {
      label = 'Excellent';
      color = '#73f218';
      subtitle = 'Your savings rate, budget discipline, and bill history are outstanding!';
    } else if (totalScore >= 75) {
      label = 'Good';
      color = '#14b8a6';
      subtitle = 'Your spending is well-controlled with healthy cash flow and savings.';
    } else if (totalScore >= 55) {
      label = 'Moderate';
      color = '#f59e0b';
      subtitle = 'Consider lowering category expenses to boost your monthly savings.';
    } else {
      label = 'Needs Attention';
      color = '#ef4444';
      subtitle = 'Expenses exceed your budget limit. Review your categories to improve health.';
    }

    return { score: totalScore, label, color, subtitle };
  }, [totalAllocatedBudget, totalSpent, totalIncome, globalBills]);

  const getTransactionsForDay = (dayNum: number) => {
    const targetMonthIdx = currentMonthData.monthIdx;
    const targetYear = currentMonthData.year;

    return globalTransactions.filter(tx => {
      if (tx.isIncome) return false;
      const d = parseTxDate(tx.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonthIdx && d.getDate() === dayNum;
    });
  };

  // Date parsing helper in local time
  const parseTxDate = (dateStr?: string): Date => {
    if (!dateStr) return new Date();
    const str = dateStr.trim().toLowerCase();
    const today = new Date();
    if (str.startsWith('today')) return today;
    if (str.startsWith('yesterday')) {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      return y;
    }
    if (str.includes('-')) {
      const parts = str.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          return new Date(year, month, day);
        }
      }
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? today : parsed;
  };

  const getTransactionsForWeekday = (weekdayLabel: string) => {
    const labelMap: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    const targetDay = labelMap[weekdayLabel];
    const targetMonthIdx = currentMonthData.monthIdx;
    const targetYear = currentMonthData.year;

    return globalTransactions.filter(tx => {
      if (tx.isIncome) return false;
      const d = parseTxDate(tx.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonthIdx && d.getDay() === targetDay;
    });
  };

  const getTransactionsForWeek = (weekLabel: string) => {
    let startDay = 1, endDay = 7;
    if (weekLabel === 'Week 1') { startDay = 1; endDay = 7; }
    else if (weekLabel === 'Week 2') { startDay = 8; endDay = 14; }
    else if (weekLabel === 'Week 3') { startDay = 15; endDay = 21; }
    else if (weekLabel === 'Week 4') { startDay = 22; endDay = 31; }

    const targetMonthIdx = currentMonthData.monthIdx;
    const targetYear = currentMonthData.year;

    return globalTransactions.filter(tx => {
      if (tx.isIncome) return false;
      const d = parseTxDate(tx.date);
      const day = d.getDate();
      return d.getFullYear() === targetYear && d.getMonth() === targetMonthIdx && day >= startDay && day <= endDay;
    });
  };

  const getTransactionsForMonth = (monthLabel: string) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const targetMonthIdx = monthNames.indexOf(monthLabel);
    const targetYear = currentMonthData.year;

    return globalTransactions.filter(tx => {
      if (tx.isIncome) return false;
      const d = parseTxDate(tx.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonthIdx;
    });
  };

  const getTransactionsForYear = (yearLabel: string) => {
    const targetYear = parseInt(yearLabel, 10);
    return globalTransactions.filter(tx => {
      if (tx.isIncome) return false;
      const d = parseTxDate(tx.date);
      return d.getFullYear() === targetYear;
    });
  };

  // Handle transaction logging
  const handleLogTransaction = () => {
    if (!newTxMerchant || !newTxAmount) {
      Alert.alert('Error', 'Please fill in merchant and amount.');
      return;
    }
    const val = parseFloat(newTxAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    const catObj = categories.find(c => c.name.toLowerCase() === newTxCategory.toLowerCase());
    const cColor = catObj ? catObj.color : '#64748b';
    const cIcon = catObj ? catObj.icon : 'wallet-outline';

    // 1. Add to transactions list
    const newTx = {
      id: 'tx-' + Date.now(),
      merchant: newTxMerchant,
      category: newTxCategory,
      amount: val,
      date: newTxDate,
      method: 'Cash/Wallet',
      icon: cIcon,
      color: cColor
    };
    setRecentTransactions([newTx, ...recentTransactions]);

    // 2. Add to category spent
    setCategories(categories.map(c => {
      if (c.name.toLowerCase() === newTxCategory.toLowerCase()) {
        return {
          ...c,
          spent: c.spent + val,
          txCount: c.txCount + 1,
          dailyAvg: parseFloat(((c.spent + val) / 16).toFixed(2)), // assumes 16 days elapsed
          forecast: Math.round(((c.spent + val) / 16) * 31)
        };
      }
      return c;
    }));

    setNewTxMerchant('');
    setNewTxAmount('');
    setNewTxCategory('Food');
    setNewTxDate('2026-07-16');
    setNewTxFrequency('One-off');
    setNewTxIsContinuous(true);
    setNewTxEndDate('');
    setAddTxModalVisible(false);
    Alert.alert('Success', 'Payment logged and budget updated!');
  };

  const handleSaveIncome = () => {
    if (!newIncName || !newIncAmount) {
      Alert.alert('Error', 'Please fill in income name and amount.');
      return;
    }
    const val = parseFloat(newIncAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    const newInc = {
      id: 'inc-' + Date.now(),
      name: newIncName,
      amount: val,
      freq: newIncFrequency,
      date: newIncDate
    };

    setIncomeStreams([newInc, ...incomeStreams]);
    setNewIncName('');
    setNewIncAmount('');
    setNewIncCategory('Salary');
    setNewIncFrequency('Monthly');
    setNewIncDate('2026-07-16');
    setNewIncIsContinuous(true);
    setNewIncEndDate('');
    setAddIncModalVisible(false);
    Alert.alert('Success', 'Income stream added successfully!');
  };

  // Handle budget edit
  const handleSaveBudgetEdit = () => {
    const val = parseFloat(editBudgetAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Error', 'Please enter a valid budget limit.');
      return;
    }

    setCategories(categories.map(c => {
      if (c.id === editCategory.id) {
        return { ...c, budget: val };
      }
      return c;
    }));

    setEditCategory(null);
    setEditBudgetAmount('');
    Alert.alert('Success', 'Category budget updated.');
  };

  // Add notes
  const handleAddNote = () => {
    if (!newNoteInput.trim()) return;
    setFinancialNotes([
      { id: 'n-' + Date.now(), text: newNoteInput.trim() },
      ...financialNotes
    ]);
    setNewNoteInput('');
  };

  // Delete note
  const handleDeleteNote = (id: string) => {
    setFinancialNotes(financialNotes.filter(n => n.id !== id));
  };

  // Generate & Export Financial Report (CSV, JSON, PDF)
  const handleGenerateReport = () => {
    if (!exportIncludeIncExp && !exportIncludeBudgets && !exportIncludeGoals) {
      Alert.alert('Selection Required', 'Please select at least one data section to include in the report.');
      return;
    }

    // 1. Filter Transactions by Selected Time Range
    let filteredTxs = [...recentTransactions];
    if (exportTimeRange === 'This Month') {
      filteredTxs = recentTransactions.filter(t => t.date.includes('Today') || t.date.includes('Jul') || t.date.includes('Yesterday'));
    } else if (exportTimeRange === 'Last Month') {
      filteredTxs = recentTransactions.filter(t => t.date.includes('Jun'));
    } else if (exportTimeRange === 'Year to Date') {
      filteredTxs = recentTransactions;
    } else if (exportTimeRange === 'Custom Range') {
      if (exportStartDate > exportEndDate) {
        Alert.alert('Invalid Date Range', 'From Date cannot be later than Upto Date.');
        return;
      }
      filteredTxs = recentTransactions.filter(t => {
        const d = (t as any).rawDate || '2026-07-27';
        return d >= exportStartDate && d <= exportEndDate;
      });
    }

    const timestampStr = new Date().toISOString().split('T')[0];
    const fileNameBase = `Financial_Report_${exportTimeRange.replace(/ /g, '_')}_${timestampStr}`;

    // 2. CSV EXPORT
    if (exportFormat === 'CSV') {
      let csvContent = '\uFEFF'; // UTF-8 BOM for Excel/Sheets compatibility

      if (exportIncludeIncExp) {
        csvContent += '--- INCOME & EXPENSES ---\r\n';
        csvContent += 'ID,Date & Time,Merchant / Title,Category,Payment Method,Amount (' + currency.code + ')\r\n';
        filteredTxs.forEach(tx => {
          csvContent += `"${tx.id}","${tx.date}","${tx.merchant.replace(/"/g, '""')}","${tx.category}","${tx.method}","${tx.amount.toFixed(2)}"\r\n`;
        });
        incomeStreams.forEach(inc => {
          csvContent += `"${inc.id}","${inc.date}","${inc.name.replace(/"/g, '""')}","Income","${inc.freq}","+${inc.amount.toFixed(2)}"\r\n`;
        });
        csvContent += '\r\n';
      }

      if (exportIncludeBudgets) {
        csvContent += '--- BUDGET CATEGORY BREAKDOWN ---\r\n';
        csvContent += 'Category,Allocated (' + currency.code + '),Spent (' + currency.code + '),Remaining (' + currency.code + '),Usage %\r\n';
        categories.forEach(c => {
          const remaining = c.budget - c.spent;
          const pct = Math.round((c.spent / c.budget) * 100);
          csvContent += `"${c.name}","${c.budget.toFixed(2)}","${c.spent.toFixed(2)}","${remaining.toFixed(2)}","${pct}%"\r\n`;
        });
        csvContent += '\r\n';
      }

      if (exportIncludeGoals) {
        csvContent += '--- SAVINGS GOALS PROGRESS ---\r\n';
        csvContent += 'Goal Name,Target Amount (' + currency.code + '),Saved Amount (' + currency.code + '),Monthly Contribution (' + currency.code + '),Progress %\r\n';
        savingsGoals.forEach(g => {
          const pct = Math.min(Math.round((g.saved / g.target) * 100), 100);
          csvContent += `"${g.name}","${g.target.toFixed(2)}","${g.saved.toFixed(2)}","${g.monthlyContribution.toFixed(2)}","${pct}%"\r\n`;
        });
        csvContent += '\r\n';
      }

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileNameBase}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Report Downloaded', `CSV financial report downloaded for ${exportTimeRange}.`);
      } else {
        Share.share({ title: `${fileNameBase}.csv`, message: csvContent });
      }
    }
    // 3. JSON EXPORT
    else if (exportFormat === 'JSON') {
      const jsonObj: any = {
        reportName: 'Financial Analytics & Budget Report',
        timeRange: exportTimeRange,
        currency: currency.code,
        generatedAt: new Date().toISOString(),
        sectionsIncluded: {
          incomeAndExpenses: exportIncludeIncExp,
          budgetCategoryBreakdown: exportIncludeBudgets,
          savingsGoalsProgress: exportIncludeGoals,
        },
        data: {}
      };

      if (exportIncludeIncExp) {
        jsonObj.data.transactions = filteredTxs;
        jsonObj.data.incomeStreams = incomeStreams;
      }
      if (exportIncludeBudgets) {
        jsonObj.data.budgetCategories = categories.map(c => ({
          name: c.name,
          budget: c.budget,
          spent: c.spent,
          remaining: c.budget - c.spent,
          pctUsed: Math.round((c.spent / c.budget) * 100),
          dailyAvg: c.dailyAvg,
          forecast: c.forecast
        }));
      }
      if (exportIncludeGoals) {
        jsonObj.data.savingsGoals = savingsGoals.map(g => ({
          name: g.name,
          target: g.target,
          saved: g.saved,
          monthlyContribution: g.monthlyContribution,
          pctCompleted: Math.min(Math.round((g.saved / g.target) * 100), 100),
          deadline: g.deadline
        }));
      }

      const jsonStr = JSON.stringify(jsonObj, null, 2);

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileNameBase}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Report Downloaded', `JSON financial report downloaded for ${exportTimeRange}.`);
      } else {
        Share.share({ title: `${fileNameBase}.json`, message: jsonStr });
      }
    }
    // 4. PDF / HTML STYLED REPORT EXPORT
    else if (exportFormat === 'PDF') {
      let htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Financial Report - ${exportTimeRange}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #070d1a; color: #fff; padding: 30px; }
    .container { max-width: 800px; margin: 0 auto; background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 36px; }
    .header { text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 24px; margin-bottom: 28px; }
    .badge { display: inline-block; background: rgba(115,242,24,0.15); color: #73f218; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 12px; letter-spacing: 1px; margin-bottom: 10px; }
    h1 { font-size: 26px; font-weight: 900; margin: 0 0 6px 0; }
    .subtitle { color: rgba(255,255,255,0.5); font-size: 13px; }
    .section-title { font-size: 15px; font-weight: 800; color: #73f218; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; margin: 28px 0 14px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 13px; }
    th { text-align: left; padding: 10px; color: rgba(255,255,255,0.45); font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; }
    td { padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .num { text-align: right; font-weight: bold; }
    .progress-bg { background: rgba(255,255,255,0.08); height: 6px; border-radius: 3px; width: 100px; display: inline-block; vertical-align: middle; margin-right: 8px; }
    .progress-fill { height: 6px; border-radius: 3px; background: #73f218; }
    .footer { text-align: center; margin-top: 36px; font-size: 11px; color: rgba(255,255,255,0.4); border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">FINANCIAL EXECUTIVE REPORT</div>
      <h1>Official Statement</h1>
      <div class="subtitle">Time Period: <strong>${exportTimeRange}</strong> • Currency: <strong>${currency.name} (${currency.code})</strong></div>
    </div>`;

      if (exportIncludeIncExp) {
        htmlBody += `
    <div class="section-title">1. Income & Expenses</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th>Method</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>`;
        filteredTxs.forEach(tx => {
          htmlBody += `
        <tr>
          <td>${tx.date}</td>
          <td><strong>${tx.merchant}</strong></td>
          <td>${tx.category}</td>
          <td>${tx.method}</td>
          <td class="num" style="color: #ef4444;">-${formatAmount(tx.amount)}</td>
        </tr>`;
        });
        incomeStreams.forEach(inc => {
          htmlBody += `
        <tr>
          <td>${inc.date}</td>
          <td><strong>${inc.name}</strong></td>
          <td>Income</td>
          <td>${inc.freq}</td>
          <td class="num" style="color: #73f218;">+${formatAmount(inc.amount)}</td>
        </tr>`;
        });
        htmlBody += `
      </tbody>
    </table>`;
      }

      if (exportIncludeBudgets) {
        htmlBody += `
    <div class="section-title">2. Budget Category Breakdown</div>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Allocated</th>
          <th>Spent</th>
          <th>Remaining</th>
          <th>Usage</th>
        </tr>
      </thead>
      <tbody>`;
        categories.forEach(c => {
          const remaining = c.budget - c.spent;
          const pct = Math.round((c.spent / c.budget) * 100);
          htmlBody += `
        <tr>
          <td><strong>${c.name}</strong></td>
          <td>${formatAmount(c.budget)}</td>
          <td>${formatAmount(c.spent)}</td>
          <td style="color: ${remaining < 0 ? '#ef4444' : '#73f218'}; font-weight: bold;">${formatAmount(remaining)}</td>
          <td>
            <div class="progress-bg"><div class="progress-fill" style="width: ${Math.min(pct, 100)}%; background: ${pct > 80 ? '#ef4444' : '#73f218'};"></div></div>
            <strong>${pct}%</strong>
          </td>
        </tr>`;
        });
        htmlBody += `
      </tbody>
    </table>`;
      }

      if (exportIncludeGoals) {
        htmlBody += `
    <div class="section-title">3. Savings Goals Progress</div>
    <table>
      <thead>
        <tr>
          <th>Goal Name</th>
          <th>Target</th>
          <th>Saved</th>
          <th>Contribution</th>
          <th>Progress</th>
        </tr>
      </thead>
      <tbody>`;
        savingsGoals.forEach(g => {
          const pct = Math.min(Math.round((g.saved / g.target) * 100), 100);
          htmlBody += `
        <tr>
          <td><strong>${g.name}</strong></td>
          <td>${formatAmount(g.target)}</td>
          <td>${formatAmount(g.saved)}</td>
          <td>${formatAmount(g.monthlyContribution)}/mo</td>
          <td>
            <div class="progress-bg"><div class="progress-fill" style="width: ${pct}%;"></div></div>
            <strong>${pct}%</strong>
          </td>
        </tr>`;
        });
        htmlBody += `
      </tbody>
    </table>`;
      }

      htmlBody += `
    <div class="footer">
      Report generated on ${new Date().toLocaleDateString()} • Verified Financial Document
    </div>
  </div>
</body>
</html>`;

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([htmlBody], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileNameBase}.html`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Report Downloaded', `PDF statement prepared and downloaded for ${exportTimeRange}.`);
      } else {
        Share.share({ title: `${fileNameBase}.html`, message: `Financial Statement for ${exportTimeRange}` });
      }
    }

    setExportModalVisible(false);
  };

  // Save Budget Preferences
  const handleSavePreferences = async () => {
    try {
      const preferencesObj = {
        budgetPeriod,
        rolloverBudget,
        alertThreshold,
      };
      await AsyncStorage.setItem('@user_budget_preferences', JSON.stringify(preferencesObj));
      Alert.alert(
        'Preferences Saved',
        `Your budget preferences have been updated:\n\n• Budget Period: ${budgetPeriod}\n• Rollover Leftovers: ${rolloverBudget ? 'Enabled' : 'Disabled'}\n• Overspending Alert: ${alertThreshold}%\n• Currency: ${currency.name} (${currency.code})`
      );
      setSettingsModalVisible(false);
    } catch (e) {
      console.warn('Error saving budget preferences:', e);
      Alert.alert('Error', 'Failed to save budget preferences.');
    }
  };

  // Toggle bill paid status
  const handleToggleBill = (id: string) => {
    markAsPaid(id);
  };

  const handleAddFunds = () => {
    const val = parseFloat(addFundsAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    if (selectedGoal) {
      updateGoalProgress(selectedGoal.id, val);
      setSelectedGoal({ ...selectedGoal, saved: Math.min(selectedGoal.saved + val, selectedGoal.target) });
    }
    setAddFundsAmount('');
    Alert.alert('Success', `Added ${formatAmount(val)} to ${selectedGoal?.name}!`);
  };

  const handleSaveEditedGoal = () => {
    if (!editingGoal) return;
    if (!editGoalName.trim()) {
      Alert.alert('Error', 'Please enter a goal name.');
      return;
    }
    const targetVal = parseFloat(editGoalTarget);
    if (isNaN(targetVal) || targetVal <= 0) {
      Alert.alert('Error', 'Please enter a valid target amount.');
      return;
    }
    const savedVal = editGoalSaved !== '' ? parseFloat(editGoalSaved) : editingGoal.saved;
    const monthlyContrib = parseFloat(editGoalMonthlyContrib) || Math.round(targetVal / 12);

    updateGoal(editingGoal.id, {
      label: editGoalName.trim(),
      icon: editGoalIcon || editingGoal.icon || '🎯',
      saved: isNaN(savedVal) ? editingGoal.saved : Math.min(savedVal, targetVal),
      target: targetVal,
      monthlyContrib: monthlyContrib,
      deadline: editGoalDeadline.trim() || editingGoal.deadline || 'Dec 2026',
    });

    setEditGoalModalVisible(false);
    setEditingGoal(null);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch(e){}
    Alert.alert('Success', 'Goal updated successfully!');
  };

  const handleDeleteEditedGoal = () => {
    if (!editingGoal) return;
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete "${editingGoal.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteGoal(editingGoal.id);
            setEditGoalModalVisible(false);
            setEditingGoal(null);
          }
        }
      ]
    );
  };

  const handleCreateGoal = () => {
    if (!newGoalName.trim()) {
      Alert.alert('Error', 'Please enter a goal name.');
      return;
    }
    const targetVal = parseFloat(newGoalTarget);
    if (isNaN(targetVal) || targetVal <= 0) {
      Alert.alert('Error', 'Please enter a valid target amount.');
      return;
    }
    const initialSavedVal = parseFloat(newGoalInitialSaved) || 0;
    if (initialSavedVal < 0 || initialSavedVal > targetVal) {
      Alert.alert('Error', 'Initial savings must be between 0 and the target amount.');
      return;
    }

    let calculatedMonthly = 0;
    let deadlineStr = '';

    // Check if fueling source is selected
    if (newGoalFuelSourceId !== 'none') {
      const stream = incomeStreams.find(s => s.id === newGoalFuelSourceId);
      if (!stream) {
        Alert.alert('Error', 'Selected fueling source not found.');
        return;
      }
      const fuelVal = parseFloat(newGoalFuelValue);
      if (isNaN(fuelVal) || fuelVal <= 0) {
        Alert.alert('Error', 'Please enter a valid fueling contribution value.');
        return;
      }
      
      const allocation = getIncomeSourceAllocation(stream.id);
      if (newGoalFuelMode === 'percent') {
        if (fuelVal > (100 - allocation.pct)) {
          Alert.alert('Error', `You have already allocated ${allocation.pct.toFixed(0)}% of ${stream.name}. The maximum percentage you can allocate is ${(100 - allocation.pct).toFixed(0)}%.`);
          return;
        }
        calculatedMonthly = Math.round(stream.amount * (fuelVal / 100));
      } else {
        if (fuelVal > (stream.amount - allocation.flat)) {
          Alert.alert('Error', `You have already allocated $${allocation.flat} of ${stream.name}. The maximum flat amount you can allocate is $${stream.amount - allocation.flat}.`);
          return;
        }
        calculatedMonthly = fuelVal;
      }
      const remains = targetVal - initialSavedVal;
      const monthsRem = remains > 0 ? Math.ceil(remains / calculatedMonthly) : 0;
      deadlineStr = getEstimatedTargetDate(monthsRem);
    } else {
      if (newGoalPaceMode === 'date') {
        const remains = targetVal - initialSavedVal;
        calculatedMonthly = remains > 0 ? Math.ceil(remains / newGoalMonthsRemaining) : 0;
        deadlineStr = getEstimatedTargetDate(newGoalMonthsRemaining);
      } else {
        const customMonthly = parseFloat(newGoalMonthlySaving);
        if (isNaN(customMonthly) || customMonthly <= 0) {
          Alert.alert('Error', 'Please enter a valid monthly saving amount.');
          return;
        }
        calculatedMonthly = customMonthly;
        const remains = targetVal - initialSavedVal;
        const monthsRem = remains > 0 ? Math.ceil(remains / customMonthly) : 0;
        deadlineStr = getEstimatedTargetDate(monthsRem);
      }
    }

    addGoal({
      label: newGoalName.trim(),
      icon: '🎯',
      target: targetVal,
      saved: initialSavedVal,
      color: '#73f218',
      deadline: deadlineStr,
    });

    setAddGoalModalVisible(false);
    
    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalInitialSaved('');
    setNewGoalMonthlySaving('');
    setNewGoalMonthsRemaining(6);
    setNewGoalFuelSourceId('none');
    setNewGoalFuelValue('');

    Alert.alert('Success', `Savings Goal "${newGoalName.trim()}" created successfully!`);
  };

  const getEstimatedTargetDate = (monthsOffset: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = 6; // July
    const currentYear = 2026;
    
    let targetMonthIdx = currentMonthIdx + monthsOffset;
    let targetYear = currentYear + Math.floor(targetMonthIdx / 12);
    targetMonthIdx = ((targetMonthIdx % 12) + 12) % 12;
    return `${months[targetMonthIdx]} ${targetYear}`;
  };

  const getIncomeSourceAllocation = (sourceId: string, excludeGoalId?: string) => {
    const stream = incomeStreams.find(s => s.id === sourceId);
    if (!stream || stream.amount <= 0) return { pct: 0, flat: 0 };
    
    let totalFlat = 0;
    let totalPct = 0;
    
    savingsGoals.forEach(g => {
      if (excludeGoalId && g.id === excludeGoalId) return;
      
      if (g.fuelSourceId === sourceId) {
        if (g.fuelMode === 'percent' && g.fuelValue) {
          totalPct += g.fuelValue;
          totalFlat += Math.round(stream.amount * (g.fuelValue / 100));
        } else if (g.fuelMode === 'flat' && g.fuelValue) {
          totalFlat += g.fuelValue;
          totalPct += (g.fuelValue / stream.amount) * 100;
        }
      }
    });
    
    return { pct: Math.min(totalPct, 100), flat: Math.min(totalFlat, stream.amount) };
  };

  // Delete category goal
  const handleDeleteCategory = (id: string) => {
    setCategoryToDelete(id);
  };

  // Add new custom category
  const handleAddCategory = () => {
    if (!newCatName.trim()) {
      Alert.alert('Error', 'Please enter a category name.');
      return;
    }
    const budgetNum = parseFloat(newCatBudget) || 100;
    const newCat = {
      id: Date.now().toString(),
      name: newCatName.trim(),
      spent: 0,
      budget: budgetNum,
      icon: newCatIcon,
      color: newCatColor,
      txCount: 0,
      dailyAvg: 0,
      forecast: 0,
    };

    setCategories(prev => [...prev, newCat]);
    setNewCatName('');
    setNewCatBudget('');
    setAddCatModalVisible(false);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}
  };

  // Add new bill
  const handleAddBill = () => {
    if (!newBillTitle.trim()) {
      Alert.alert('Error', 'Please enter a bill title.');
      return;
    }
    const amt = parseFloat(newBillAmount) || 10;
    const dueDate = newBillDueDate.trim() || 'Aug 15, 2026';

    addBill({
      title: newBillTitle.trim(),
      amount: amt,
      daysLeft: 10,
      dueDate,
      icon: newBillIcon,
      category: newBillCategory,
    });

    setNewBillTitle('');
    setNewBillAmount('');
    setNewBillDueDate('');
    setAddBillModalVisible(false);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}
  };

  // Selected category dynamic details & transactions
  const selectedCatDetails = useMemo(() => {
    if (!selectedCategory) return null;
    const catName = selectedCategory.name.toLowerCase();
    const catTxs = globalTransactions.filter(t => {
      if (t.isIncome) return false;
      if (!t.category) return false;
      const txCat = t.category.toLowerCase();
      return (
        txCat === catName ||
        (catName.includes('housing') && (txCat.includes('house') || txCat.includes('rent') || txCat.includes('housing'))) ||
        (catName.includes('food') && (txCat.includes('food') || txCat.includes('grocer') || txCat.includes('dine') || txCat.includes('restaurant'))) ||
        (catName.includes('transportation') && (txCat.includes('transport') || txCat.includes('car') || txCat.includes('fuel') || txCat.includes('gas') || txCat.includes('uber') || txCat.includes('taxi'))) ||
        (catName.includes('shopping') && (txCat.includes('shop') || txCat.includes('cloth') || txCat.includes('retail'))) ||
        (catName.includes('health') && (txCat.includes('health') || txCat.includes('med') || txCat.includes('doctor') || txCat.includes('pharmacy'))) ||
        (catName.includes('entertainment') && (txCat.includes('entertain') || txCat.includes('movie') || txCat.includes('game') || txCat.includes('fun'))) ||
        (catName.includes('bills') && (txCat.includes('bill') || txCat.includes('subscript') || txCat.includes('utility')))
      );
    });

    const amounts = catTxs.map(t => Number(t.amount || 0));
    const largest = amounts.length > 0 ? Math.max(...amounts) : 0;
    const smallest = amounts.length > 0 ? Math.min(...amounts) : 0;
    const count = catTxs.length > 0 ? catTxs.length : selectedCategory.txCount;
    const spent = selectedCategory.spent;
    const budget = selectedCategory.budget;
    const remaining = budget - spent;
    const dailyAvg = spent > 0 ? spent / 30 : 0;
    const weeklyAvg = dailyAvg * 7;
    const forecast = dailyAvg * 30;

    return {
      catTxs,
      largest,
      smallest,
      count,
      spent,
      budget,
      remaining,
      dailyAvg,
      weeklyAvg,
      forecast,
    };
  }, [selectedCategory, globalTransactions]);

  // Days left in current active month
  const daysLeftInMonth = useMemo(() => {
    const today = new Date();
    const daysInMonth = new Date(currentMonthData.year, currentMonthData.monthIdx + 1, 0).getDate();
    const currentDay = (currentMonthData.year === today.getFullYear() && currentMonthData.monthIdx === today.getMonth()) ? today.getDate() : 1;
    return Math.max(1, daysInMonth - currentDay + 1);
  }, [currentMonthData]);

  // Categories search filtering & sorting
  const filteredCategories = useMemo(() => {
    let list = liveCategories.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (filterType === 'warning') {
        const pct = (c.spent / c.budget) * 100;
        return matchSearch && pct >= 80;
      }
      if (filterType === 'completed') {
        const pct = (c.spent / c.budget) * 100;
        return matchSearch && pct >= 100;
      }
      return matchSearch;
    });

    if (sortBy === 'spent') {
      list = [...list].sort((a, b) => b.spent - a.spent);
    } else if (sortBy === 'pct') {
      list = [...list].sort((a, b) => b.pct - a.pct);
    } else if (sortBy === 'budget') {
      list = [...list].sort((a, b) => b.budget - a.budget);
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [liveCategories, searchQuery, filterType, sortBy]);

  // Analytics dynamic statistics & calculations
  const analyticsStats = useMemo(() => {
    const activeSpentCategories = [...liveCategories].filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent);
    const highestCat = activeSpentCategories.length > 0 ? activeSpentCategories[0] : null;
    const lowestCat = activeSpentCategories.length > 0 ? activeSpentCategories[activeSpentCategories.length - 1] : null;

    const merchantMap: Record<string, { count: number; total: number }> = {};
    globalTransactions.forEach(t => {
      if (t.isIncome) return;
      const title = t.title || 'Expense';
      if (!merchantMap[title]) {
        merchantMap[title] = { count: 0, total: 0 };
      }
      merchantMap[title].count += 1;
      merchantMap[title].total += Number(t.amount || 0);
    });

    let topMerchantName = 'N/A';
    let topMerchantCount = 0;
    Object.entries(merchantMap).forEach(([name, data]) => {
      if (data.count > topMerchantCount) {
        topMerchantCount = data.count;
        topMerchantName = name;
      }
    });

    const today = new Date();
    const daysElapsed = Math.max(1, today.getDate());
    const avgDailySpend = totalSpent / daysElapsed;

    const daysInMonth = new Date(currentMonthData.year, currentMonthData.monthIdx + 1, 0).getDate();
    const projectedSpent = avgDailySpend * daysInMonth;
    let riskLabel = 'Low / On Track';
    let riskColor = '#73f218';

    if (totalAllocatedBudget > 0) {
      const projRatio = projectedSpent / totalAllocatedBudget;
      if (projRatio > 1.1) {
        riskLabel = 'High / Overrun Risk';
        riskColor = '#ef4444';
      } else if (projRatio > 0.9) {
        riskLabel = 'Moderate / Near Limit';
        riskColor = '#f59e0b';
      }
    }

    return {
      highestCat,
      lowestCat,
      topMerchantName,
      topMerchantCount,
      avgDailySpend,
      riskLabel,
      riskColor,
    };
  }, [liveCategories, globalTransactions, totalSpent, totalAllocatedBudget, currentMonthData]);

  // Daily breakdown (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
  const dailyChartData = useMemo(() => {
    const days = [
      { label: 'Mon', col: '#3b82f6' },
      { label: 'Tue', col: '#14b8a6' },
      { label: 'Wed', col: '#ec4899' },
      { label: 'Thu', col: '#73f218' },
      { label: 'Fri', col: '#f59e0b' },
      { label: 'Sat', col: '#a855f7' },
      { label: 'Sun', col: '#06b6d4' },
    ];

    const chartItems = days.map(d => {
      const txs = getTransactionsForWeekday(d.label);
      const num = txs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      return { ...d, num };
    });

    const maxVal = Math.max(1, ...chartItems.map(d => d.num));
    return chartItems.map(d => ({
      ...d,
      height: d.num > 0 ? Math.max(15, Math.round((d.num / maxVal) * 95)) : 4,
    }));
  }, [globalTransactions, currentMonthData]);

  // Weekly breakdown (Week 1, Week 2, Week 3, Week 4)
  const weeklyChartData = useMemo(() => {
    const weeks = [
      { label: 'Week 1', col: '#3b82f6' },
      { label: 'Week 2', col: '#14b8a6' },
      { label: 'Week 3', col: '#ec4899' },
      { label: 'Week 4', col: '#73f218' },
    ];

    const chartItems = weeks.map(w => {
      const txs = getTransactionsForWeek(w.label);
      const num = txs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      return { ...w, num };
    });

    const maxVal = Math.max(1, ...chartItems.map(w => w.num));
    return chartItems.map(w => ({
      ...w,
      height: w.num > 0 ? Math.max(15, Math.round((w.num / maxVal) * 95)) : 4,
    }));
  }, [globalTransactions, currentMonthData]);

  // Monthly breakdown (Jan - Dec)
  const monthlyChartData = useMemo(() => {
    const months = [
      { label: 'Jan', col: '#3b82f6' },
      { label: 'Feb', col: '#14b8a6' },
      { label: 'Mar', col: '#ec4899' },
      { label: 'Apr', col: '#3b82f6' },
      { label: 'May', col: '#14b8a6' },
      { label: 'Jun', col: '#ec4899' },
      { label: 'Jul', col: '#73f218' },
      { label: 'Aug', col: '#f59e0b' },
      { label: 'Sep', col: '#a855f7' },
      { label: 'Oct', col: '#06b6d4' },
      { label: 'Nov', col: '#ec4899' },
      { label: 'Dec', col: '#3b82f6' },
    ];

    const chartItems = months.map(m => {
      const txs = getTransactionsForMonth(m.label);
      const num = txs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      return { ...m, num };
    });

    const maxVal = Math.max(1, ...chartItems.map(m => m.num));
    return chartItems.map(m => ({
      ...m,
      height: m.num > 0 ? Math.max(15, Math.round((m.num / maxVal) * 95)) : 4,
    }));
  }, [globalTransactions, currentMonthData]);

  // Yearly breakdown
  const yearlyChartData = useMemo(() => {
    const years = [
      { label: '2023', col: '#3b82f6' },
      { label: '2024', col: '#14b8a6' },
      { label: '2025', col: '#ec4899' },
      { label: '2026', col: '#73f218' },
    ];

    const chartItems = years.map(y => {
      const txs = getTransactionsForYear(y.label);
      const num = txs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      return { ...y, num };
    });

    const maxVal = Math.max(1, ...chartItems.map(y => y.num));
    return chartItems.map(y => ({
      ...y,
      height: y.num > 0 ? Math.max(15, Math.round((y.num / maxVal) * 95)) : 4,
    }));
  }, [globalTransactions]);

  // Month-over-Month comparison (Pure Actual Amounts)
  const monthComparison = useMemo(() => {
    const targetMonthIdx = currentMonthData.monthIdx;
    const targetYear = currentMonthData.year;

    const prevMonthIdx = ((targetMonthIdx - 1) + 12) % 12;
    const prevYear = targetMonthIdx === 0 ? targetYear - 1 : targetYear;

    let currInc = 0, currExp = 0;
    let lastInc = 0, lastExp = 0;

    globalTransactions.forEach(t => {
      const d = parseTxDate(t.date);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const amt = Number(t.amount || 0);

      if (yr === targetYear && mIdx === targetMonthIdx) {
        if (t.isIncome) currInc += amt;
        else currExp += amt;
      } else if (yr === prevYear && mIdx === prevMonthIdx) {
        if (t.isIncome) lastInc += amt;
        else lastExp += amt;
      }
    });

    // If transactions exist without specific month dates, attribute to current month actuals
    if (currInc === 0 && globalTransactions.some(t => t.isIncome)) {
      currInc = globalTransactions.filter(t => t.isIncome).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    }
    if (currExp === 0 && globalTransactions.some(t => !t.isIncome)) {
      currExp = globalTransactions.filter(t => !t.isIncome).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    }

    const currSav = currInc - currExp;
    const lastSav = lastInc - lastExp;

    return [
      { name: 'Income', last: lastInc, curr: currInc, format: (v: number) => `+${formatAmount(v)}` },
      { name: 'Expenses', last: lastExp, curr: currExp, format: (v: number) => `-${formatAmount(v)}` },
      { name: 'Savings', last: lastSav, curr: currSav, format: (v: number) => (v >= 0 ? `+${formatAmount(v)}` : `-${formatAmount(Math.abs(v))}`) },
    ];
  }, [globalTransactions, currentMonthData]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />

      {/* Decorative Orbs */}
      <View style={styles.radialGlow1} />
      <View style={styles.radialGlow2} />

      {/* ─── Header ─── */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.headerTitle}>Budget</Text>
            <Text style={styles.headerSubtitle}>Personal Planner</Text>
          </View>

          {/* Month Navigator */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => setMonthOffset(prev => prev - 1)} style={styles.arrowBtn}>
              <Ionicons name="chevron-back" size={16} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.monthText}>{currentMonthLabel}</Text>
            <TouchableOpacity onPress={() => setMonthOffset(prev => prev + 1)} style={styles.arrowBtn}>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings, Export & Profile Top Shortcuts */}
        <View style={styles.topShortcuts}>
          <TouchableOpacity onPress={() => setIncomeModalVisible(true)} style={styles.shortcutBtn}>
            <Ionicons name="wallet-outline" size={15} color="#73f218" />
            <Text style={styles.shortcutText}>Income Overview</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => setExportModalVisible(true)} style={styles.iconShortcut}>
              <Ionicons name="download-outline" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsModalVisible(true)} style={styles.iconShortcut}>
              <Ionicons name="settings-outline" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sub-Tabs Navigation */}
        <View style={styles.subTabsContainer}>
          {['Overview', 'Categories', 'Analytics', 'Goals & Bills'].map((tab) => {
            const tabKey = tab.toLowerCase().split(' ')[0] as any;
            const isSelected = activeSubTab === tabKey;
            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.8}
                onPress={() => setActiveSubTab(tabKey)}
                style={[styles.subTabButton, isSelected && styles.subTabActive]}
              >
                <Text style={[styles.subTabText, isSelected && styles.subTabActiveText]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 85 }}
      >
        {/* ────────────────── OVERVIEW TAB ────────────────── */}
        {activeSubTab === 'overview' && (
          <View>
            {/* Health Score & Stats Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              {/* Radial Gauge */}
              <View style={[styles.overviewCard, { flex: 1.1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }]}>
                <HealthScoreGauge score={healthMetrics.score} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                    Score: <Text style={{ color: healthMetrics.color }}>{healthMetrics.label}</Text>
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 4, lineHeight: 14 }}>
                    {healthMetrics.subtitle}
                  </Text>
                </View>
              </View>

              {/* Progress Panel (Upgraded Glassmorphic Usage Card) */}
              <LinearGradient
                colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  borderRadius: 22,
                  padding: 16,
                  borderWidth: 1.5,
                  borderColor: budgetStatus.color + '40',
                  justifyContent: 'space-between',
                  shadowColor: budgetStatus.color,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 5,
                }}
              >
                {/* Header: Label + Glowing Status Badge */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="speedometer-outline" size={14} color={budgetStatus.color} />
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>USAGE</Text>
                  </View>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: budgetStatus.color + '20',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: budgetStatus.color + '50',
                  }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: budgetStatus.color, marginRight: 5 }} />
                    <Text style={{ color: budgetStatus.color, fontSize: 10, fontWeight: '900' }}>{budgetStatus.label}</Text>
                  </View>
                </View>

                {/* Percentage Display */}
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: 10 }}>
                  {budgetPctUsed}%
                </Text>

                {/* Neon Progress Bar Track */}
                <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginVertical: 8 }}>
                  <View
                    style={{
                      width: `${Math.min(budgetPctUsed, 100)}%`,
                      height: '100%',
                      backgroundColor: budgetStatus.color,
                      borderRadius: 3,
                    }}
                  />
                </View>

                {/* Bottom Row: Amount & Remaining Pill */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                    {formatAmount(totalSpent)} <Text style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>of {formatAmount(totalAllocatedBudget)}</Text>
                  </Text>
                  <View style={{
                    backgroundColor: remainingBudget >= 0 ? 'rgba(115,242,24,0.12)' : 'rgba(244,63,94,0.12)',
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: remainingBudget >= 0 ? 'rgba(115,242,24,0.3)' : 'rgba(244,63,94,0.3)'
                  }}>
                    <Text style={{ color: remainingBudget >= 0 ? '#73f218' : '#f43f5e', fontSize: 9, fontWeight: '900' }}>
                      {remainingBudget >= 0 ? `${formatAmount(remainingBudget)} left` : `${formatAmount(Math.abs(remainingBudget))} over`}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Metrics Summaries Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {[
                { title: 'Total Budget', val: formatAmount(totalAllocatedBudget), icon: 'cash-outline', col: '#6366f1' },
                { title: 'Total Income', val: formatAmount(totalIncome), icon: 'trending-up-outline', col: '#73f218' },
                { title: 'Total Expenses', val: formatAmount(totalSpent), icon: 'trending-down-outline', col: '#ef4444' },
                { title: 'Remaining', val: formatAmount(remainingBudget), icon: 'pie-chart-outline', col: remainingBudget >= 0 ? '#73f218' : '#ef4444' },
                { title: 'Total Savings', val: formatAmount(totalSavings), icon: 'safe-outline', col: '#06b6d4' },
                { title: 'Net Cash Flow', val: `+${formatAmount(totalIncome - totalSpent)}`, icon: 'swap-horizontal-outline', col: '#14b8a6' }
              ].map((item, idx) => (
                <View key={idx} style={[styles.gridCell, { width: (width - 42) / 2 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: item.col + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={item.icon as any} size={12} color={item.col} />
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700' }}>{item.title}</Text>
                  </View>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>{item.val}</Text>
                </View>
              ))}
            </View>

            {/* Quick Actions Panel */}
            <Text style={styles.blockTitle}>Quick Actions</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              <TouchableOpacity onPress={() => setAddTxModalVisible(true)} style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>Add Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAddIncModalVisible(true)} style={[styles.actionBtn, { backgroundColor: '#73f218' }]}>
                <Ionicons name="trending-up-outline" size={18} color="#0f172a" />
                <Text style={[styles.actionBtnText, { color: '#0f172a' }]}>Add Income</Text>
              </TouchableOpacity>
            </View>

            {/* Budget Alerts */}
            <Text style={styles.blockTitle}>Budget Alerts</Text>
            <View style={{ gap: 8, marginBottom: 24 }}>
              {[
                { text: 'Food budget is almost exhausted (89% spent).', color: '#f59e0b', icon: 'warning-outline' },
                { text: 'Internet Subscription bill is due in 2 days.', color: '#3b82f6', icon: 'calendar-outline' },
                { text: 'Excellent job saving! Savings rate increased by 4.2% this week.', color: '#73f218', icon: 'trophy-outline' }
              ].map((alert, idx) => (
                <View key={idx} style={styles.alertRow}>
                  <Ionicons name={alert.icon as any} size={15} color={alert.color} />
                  <Text style={styles.alertText}>{alert.text}</Text>
                </View>
              ))}
            </View>

            {/* Smart Insights */}
            <Text style={styles.blockTitle}>Smart Insights</Text>
            <View style={styles.overviewCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Ionicons name="bulb-outline" size={20} color="#73f218" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>AI Saving Suggestions</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18 }}>
                You spent <Text style={{ color: '#73f218', fontWeight: '800' }}>{formatAmount(120)} less</Text> on Entertainment than last month. 
                However, Transportation costs rose by <Text style={{ color: '#ef4444', fontWeight: '800' }}>18%</Text> due to fuel price spikes. 
                Phone subscriptions are paid on time, keeping your credit standing strong.
              </Text>
            </View>
          </View>
        )}

        {/* ────────────────── CATEGORIES TAB ────────────────── */}
        {activeSubTab === 'categories' && (
          <View>
            {/* Search & Action Bar */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.3)" style={{ marginRight: 8 }} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search categories..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={{ flex: 1, color: '#fff', fontSize: 12, fontWeight: '600' }}
                />
              </View>

              <TouchableOpacity
                onPress={() => setAddCatModalVisible(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#73f218',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Ionicons name="add" size={16} color="#0f172a" />
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 12 }}>Add Category</Text>
              </TouchableOpacity>
            </View>

            {/* Filter & Sort Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {[
                { label: 'All', key: 'all' },
                { label: 'Warning ⚠️', key: 'warning' },
                { label: 'Sort: Spent 📉', sortKey: 'spent' },
                { label: 'Sort: % Used 📊', sortKey: 'pct' },
                { label: 'Sort: Limit 💰', sortKey: 'budget' },
                { label: 'Sort: Name 🔤', sortKey: 'name' },
              ].map((chip, idx) => {
                const isActive = chip.key ? filterType === chip.key : sortBy === chip.sortKey;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      if (chip.key) setFilterType(chip.key as any);
                      if (chip.sortKey) setSortBy(sortBy === chip.sortKey ? 'default' : (chip.sortKey as any));
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                      backgroundColor: isActive ? 'rgba(115, 242, 24, 0.15)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: isActive ? '#73f218' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <Text style={{ color: isActive ? '#73f218' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800' }}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* List Categories */}
            {filteredCategories.map((c) => {
              const pct = Math.round((c.spent / c.budget) * 100);
              const remaining = c.budget - c.spent;
              const dailyAllowance = remaining > 0 ? remaining / daysLeftInMonth : 0;
              
              return (
                <TouchableOpacity key={c.id} onPress={() => setSelectedCategory(c)} activeOpacity={0.85} style={styles.categoryCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={c.icon as any} size={18} color={c.color} />
                      </View>
                      <View>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{c.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 1 }}>
                          {c.txCount} {c.txCount === 1 ? 'payment' : 'payments'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ backgroundColor: pct > 80 ? 'rgba(239,68,68,0.15)' : 'rgba(115,242,24,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ color: pct > 80 ? '#ef4444' : '#73f218', fontSize: 11, fontWeight: '800' }}>{pct}%</Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 12 }}>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: pct > 80 ? '#ef4444' : c.color, width: `${Math.min(pct, 100)}%` as any }} />
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <View>
                        <Text style={styles.catMiniLabel}>Spent</Text>
                        <Text style={styles.catMiniValue}>{formatAmount(c.spent)}</Text>
                      </View>
                      <View>
                        <Text style={styles.catMiniLabel}>Remaining</Text>
                        <Text style={[styles.catMiniValue, { color: remaining < 0 ? '#ef4444' : '#73f218' }]}>
                          {remaining < 0 ? `-${formatAmount(Math.abs(remaining))}` : formatAmount(remaining)}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.catMiniLabel}>Budget Limit</Text>
                        <Text style={styles.catMiniValue}>{formatAmount(c.budget)}</Text>
                      </View>
                    </View>

                    {/* View Details Shortcuts */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditCategory(c);
                          setEditBudgetAmount(c.budget.toString());
                        }}
                        style={styles.catActionBtn}
                      >
                        <Ionicons name="create-outline" size={13} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteCategory(c.id)} style={styles.catActionBtn}>
                        <Ionicons name="trash-outline" size={13} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Daily Recommended Spend Allowance */}
                  {dailyAllowance > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' }}>
                      <Ionicons name="time-outline" size={11} color="rgba(115,242,24,0.8)" />
                      <Text style={{ color: 'rgba(115,242,24,0.9)', fontSize: 10, fontWeight: '700' }}>
                        Daily Allowance: <Text style={{ color: '#fff', fontWeight: '800' }}>{formatAmount(dailyAllowance)} / day left</Text>
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ────────────────── ANALYTICS TAB ────────────────── */}
        {activeSubTab === 'analytics' && (
          <View>
            {/* Visual Custom Spending Chart Placeholder */}
            <View style={styles.overviewCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.blockTitle, { marginTop: 0, marginBottom: 0 }]}>
                  {analyticsTimeFrame.charAt(0).toUpperCase() + analyticsTimeFrame.slice(1)} Breakdown
                </Text>
                
                {/* Segmented control */}
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((tf) => {
                    const active = analyticsTimeFrame === tf;
                    return (
                      <TouchableOpacity
                        key={tf}
                        onPress={() => setAnalyticsTimeFrame(tf)}
                        style={{
                          paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                          backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent'
                        }}
                      >
                        <Text style={{ color: active ? '#73f218' : 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800' }}>
                          {tf.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              
              {/* Visual custom bar charts */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120, paddingTop: 10 }}>
                {analyticsTimeFrame === 'daily' && dailyChartData.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    onPress={() => {
                      const txs = getTransactionsForWeekday(item.label);
                      setBreakdownTitle(`${item.label} spending`);
                      setBreakdownTxs(txs);
                      setBreakdownModalVisible(true);
                    }}
                    style={{ alignItems: 'center' }}
                  >
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '700', marginBottom: 4 }}>{formatAmount(item.num)}</Text>
                    <View style={{ width: 12, height: item.height, backgroundColor: item.col, borderRadius: 3 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8, marginTop: 6, fontWeight: '700' }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}

                {analyticsTimeFrame === 'weekly' && weeklyChartData.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    onPress={() => {
                      const txs = getTransactionsForWeek(item.label);
                      setBreakdownTitle(`${item.label} spending`);
                      setBreakdownTxs(txs);
                      setBreakdownModalVisible(true);
                    }}
                    style={{ alignItems: 'center' }}
                  >
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700', marginBottom: 4 }}>{formatAmount(item.num)}</Text>
                    <View style={{ width: 18, height: item.height, backgroundColor: item.col, borderRadius: 4 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 6, fontWeight: '700' }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}

                {analyticsTimeFrame === 'monthly' && monthlyChartData.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    onPress={() => {
                      const txs = getTransactionsForMonth(item.label);
                      setBreakdownTitle(`${item.label} spending`);
                      setBreakdownTxs(txs);
                      setBreakdownModalVisible(true);
                    }}
                    style={{ alignItems: 'center' }}
                  >
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '700', marginBottom: 4 }}>{formatAmount(item.num)}</Text>
                    <View style={{ width: 14, height: item.height, backgroundColor: item.col, borderRadius: 3 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8, marginTop: 6, fontWeight: '700' }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}

                {analyticsTimeFrame === 'yearly' && yearlyChartData.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    onPress={() => {
                      const txs = getTransactionsForYear(item.label);
                      setBreakdownTitle(`${item.label} spending`);
                      setBreakdownTxs(txs);
                      setBreakdownModalVisible(true);
                    }}
                    style={{ alignItems: 'center' }}
                  >
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700', marginBottom: 4 }}>{formatAmount(item.num)}</Text>
                    <View style={{ width: 16, height: item.height, backgroundColor: item.col, borderRadius: 3 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 6, fontWeight: '700' }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Quick Stats list */}
            <Text style={styles.blockTitle}>Analytics & Statistics</Text>
            <View style={[styles.overviewCard, { gap: 14 }]}>
              <View style={styles.insightRow}>
                <Text style={styles.insightLabel}>Highest Spending Category</Text>
                <Text style={styles.insightValue}>
                  {analyticsStats.highestCat ? `${analyticsStats.highestCat.name} (${formatAmount(analyticsStats.highestCat.spent)})` : 'None yet'}
                </Text>
              </View>
              <View style={styles.insightRow}>
                <Text style={styles.insightLabel}>Lowest Spending Category</Text>
                <Text style={styles.insightValue}>
                  {analyticsStats.lowestCat ? `${analyticsStats.lowestCat.name} (${formatAmount(analyticsStats.lowestCat.spent)})` : 'None yet'}
                </Text>
              </View>
              <View style={styles.insightRow}>
                <Text style={styles.insightLabel}>Most Frequent Expense</Text>
                <Text style={styles.insightValue}>
                  {analyticsStats.topMerchantName !== 'N/A' ? `${analyticsStats.topMerchantName} (${analyticsStats.topMerchantCount} txs)` : 'None yet'}
                </Text>
              </View>
              <View style={styles.insightRow}>
                <Text style={styles.insightLabel}>Average Daily Spend</Text>
                <Text style={styles.insightValue}>{formatAmount(analyticsStats.avgDailySpend)} / day</Text>
              </View>
              <View style={styles.insightRow}>
                <Text style={styles.insightLabel}>Expected Forecast Risk</Text>
                <Text style={[styles.insightValue, { color: analyticsStats.riskColor }]}>{analyticsStats.riskLabel}</Text>
              </View>
            </View>

            {/* Monthly Comparison */}
            <Text style={styles.blockTitle}>Month Comparison (Current vs Last)</Text>
            <View style={styles.overviewCard}>
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: 8, marginBottom: 8 }}>
                <Text style={{ flex: 1.5, color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700' }}>METRIC</Text>
                <Text style={{ flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', textAlign: 'right' }}>LAST MO</Text>
                <Text style={{ flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', textAlign: 'right' }}>CURR MO</Text>
                <Text style={{ flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', textAlign: 'right' }}>DIFF</Text>
              </View>
              {monthComparison.map((item, idx) => {
                const diff = item.curr - item.last;
                const isPos = diff >= 0;
                return (
                  <View key={idx} style={{ flexDirection: 'row', paddingVertical: 6 }}>
                    <Text style={{ flex: 1.5, color: '#fff', fontSize: 12, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ flex: 1, color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'right' }}>{item.format(item.last)}</Text>
                    <Text style={{ flex: 1, color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'right' }}>{item.format(item.curr)}</Text>
                    <Text style={{ flex: 1, color: item.name === 'Expenses' ? (diff > 0 ? '#ef4444' : '#73f218') : (isPos ? '#73f218' : '#ef4444'), fontSize: 11, fontWeight: '800', textAlign: 'right' }}>
                      {diff > 0 ? '+' : ''}{formatAmount(diff)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Daily Calendar Spend Map */}
            <Text style={styles.blockTitle}>Daily Calendar Spending Map</Text>
            <View style={styles.overviewCard}>
              {/* Weekdays header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, idx) => (
                  <Text
                    key={idx}
                    style={{
                      width: MAP_CELL_WIDTH, textAlign: 'center', color: 'rgba(255,255,255,0.3)',
                      fontSize: 9, fontWeight: '800'
                    }}
                  >
                    {wd}
                  </Text>
                ))}
              </View>

              {/* Grid cells */}
              <View style={{ gap: 4 }}>
                {dailySpendWeeks.map((week, weekIdx) => (
                  <View key={weekIdx} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    {week.map((cell) => {
                      if (cell.day === null) {
                        return (
                          <View
                            key={cell.id}
                            style={{ width: MAP_CELL_WIDTH, height: 26 }}
                          />
                        );
                      }
                      
                      const dayNum = cell.day;
                      const dayTxs = getTransactionsForDay(dayNum);
                      const spentVal = dayTxs.reduce((sum, tx) => sum + tx.amount, 0);
                      
                      const cellColor = spentVal > 100 
                        ? 'rgba(239, 68, 68, 0.4)' 
                        : spentVal > 0 
                          ? 'rgba(115, 242, 24, 0.35)' 
                          : 'rgba(255,255,255,0.04)';
                          
                      const cellBorderColor = spentVal > 100 
                        ? 'rgba(239, 68, 68, 0.6)' 
                        : spentVal > 0 
                          ? 'rgba(115, 242, 24, 0.5)' 
                          : 'rgba(255,255,255,0.02)';

                      return (
                        <TouchableOpacity
                          key={cell.id}
                          onPress={() => setSelectedCalendarDay(dayNum)}
                          style={{
                            width: MAP_CELL_WIDTH, height: 26, backgroundColor: cellColor,
                            borderRadius: 4, alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1, borderColor: cellBorderColor
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{dayNum}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    
                    {/* Last week padding to keep alignment consistent */}
                    {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, padIdx) => (
                      <View key={`pad-${padIdx}`} style={{ width: MAP_CELL_WIDTH, height: 26 }} />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ────────────────── GOALS & BILLS TAB ────────────────── */}
        {activeSubTab === 'goals' && (
          <View>
            {/* Savings Goals Header with Add Button (Now First!) */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.blockTitle, { marginTop: 0, marginBottom: 0 }]}>Savings Goals</Text>
              <TouchableOpacity
                onPress={() => {
                  setGoalCurrency(currency);
                  setNewGoalFuelSourceId('none');
                  setNewGoalFuelValue('');
                  setNewGoalName('Emergency Fund');
                  setSelectedGoalPreset('Emergency Fund');
                  setIsSpecifyingOtherGoal(false);
                  setTempOtherGoalName('');
                  setNewGoalTarget('');
                  setNewGoalInitialSaved('');
                  setNewGoalMonthlySaving('');
                  setNewGoalMonthsRemaining(6);
                  setNewGoalPaceMode('date');
                  setAddGoalModalVisible(true);
                }}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: 'rgba(115, 242, 24, 0.15)',
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                  borderWidth: 1, borderColor: 'rgba(115, 242, 24, 0.2)'
                }}
              >
                <Ionicons name="add" size={14} color="#73f218" />
                <Text style={{ color: '#73f218', fontSize: 10, fontWeight: '800' }}>Add Goal</Text>
              </TouchableOpacity>
            </View>
            {savingsGoals.map((g) => {
              const savedPct = Math.min(Math.round((g.saved / g.target) * 100), 100);
              
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => { setSelectedGoal(g); setAddFundsAmount(''); }}
                  activeOpacity={0.85}
                  style={styles.categoryCard}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 16 }}>{g.icon}</Text>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{g.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ color: '#73f218', fontWeight: '900', fontSize: 13 }}>{savedPct}%</Text>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setEditingGoal(g);
                          setEditGoalName(g.name);
                          setEditGoalIcon(g.icon || '🎯');
                          setEditGoalSaved(g.saved.toString());
                          setEditGoalTarget(g.target.toString());
                          setEditGoalMonthlyContrib(g.monthlyContribution.toString());
                          setEditGoalDeadline(g.deadline || '');
                          setEditGoalModalVisible(true);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="settings-outline" size={15} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 8 }}>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: '#73f218', width: `${savedPct}%` as any }} />
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Saved: {formatAmount(g.saved)} / {formatAmount(g.target)}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Contribution: {formatAmount(g.monthlyContribution)}/mo</Text>
                  </View>

                  {/* Auto-Fuel Income Stream Badge */}
                  {g.fuelSourceId && g.fuelSourceId !== 'none' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' }}>
                      <Ionicons name="flash" size={11} color="#f59e0b" />
                      <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '700' }}>
                        Auto-fueling {g.fuelMode === 'percent' ? `${g.fuelValue}%` : formatAmount(g.fuelValue || 0)} from linked income
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Upcoming Bills Header with Add Bill Button (Now Second!) */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
              <Text style={[styles.blockTitle, { marginTop: 0, marginBottom: 0 }]}>Upcoming Bills</Text>
              <TouchableOpacity
                onPress={() => setAddBillModalVisible(true)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                  borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)'
                }}
              >
                <Ionicons name="add" size={14} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '800' }}>Add Bill</Text>
              </TouchableOpacity>
            </View>

            {upcomingBills.map((b) => (
              <View key={b.id} style={styles.billCard}>
                <TouchableOpacity
                  onPress={() => setSelectedBill(b)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: b.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={b.icon as any} size={18} color={b.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{b.name}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>
                      Due {b.date} • {b.daysLeft} days left
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={{ color: b.paid ? 'rgba(255,255,255,0.3)' : '#ef4444', fontWeight: '900', fontSize: 14, textDecorationLine: b.paid ? 'line-through' : 'none' }}>
                    -{formatAmount(b.amount)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleToggleBill(b.id)}
                    activeOpacity={0.7}
                    style={{ backgroundColor: b.paid ? 'rgba(115,242,24,0.15)' : 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                  >
                    <Text style={{ color: b.paid ? '#73f218' : '#fff', fontSize: 9, fontWeight: '800' }}>
                      {b.paid ? 'Paid ✓' : 'Mark Paid'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Financial Notes */}
            <Text style={[styles.blockTitle, { marginTop: 24 }]}>Financial Notes & Reminders</Text>
            <View style={styles.overviewCard}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TextInput
                  value={newNoteInput}
                  onChangeText={setNewNoteInput}
                  placeholder="Write a financial reminder..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 12 }}
                />
                <TouchableOpacity onPress={handleAddNote} style={{ backgroundColor: '#73f218', paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="send" size={14} color="#0f172a" />
                </TouchableOpacity>
              </View>

              {financialNotes.map((note) => (
                <View key={note.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
                  <Ionicons name="document-text-outline" size={14} color="rgba(255,255,255,0.3)" style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 16 }}>{note.text}</Text>
                  <TouchableOpacity onPress={() => handleDeleteNote(note.id)}>
                    <Ionicons name="close" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ─── MODAL: ADD RECURRING BILL ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addBillModalVisible}
        onRequestClose={() => setAddBillModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { maxHeight: height * 0.85 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>Add Recurring Bill</Text>
              <TouchableOpacity onPress={() => setAddBillModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.inputLabel}>BILL TITLE</Text>
              <TextInput
                value={newBillTitle}
                onChangeText={setNewBillTitle}
                placeholder="e.g. Netflix, Rent, Wifi, Electricity..."
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              <Text style={styles.inputLabel}>AMOUNT ({currency.code})</Text>
              <TextInput
                value={newBillAmount}
                onChangeText={setNewBillAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              <Text style={styles.inputLabel}>DUE DATE</Text>
              <TextInput
                value={newBillDueDate}
                onChangeText={setNewBillDueDate}
                placeholder="e.g. Aug 15, 2026"
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              {/* Category selector */}
              <Text style={styles.inputLabel}>BILL TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                {(['Bill', 'Subscription'] as const).map(type => {
                  const isActive = newBillCategory === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setNewBillCategory(type)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: isActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.04)',
                        borderWidth: 1,
                        borderColor: isActive ? '#ef4444' : 'rgba(255,255,255,0.08)',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: isActive ? '#ef4444' : 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 12 }}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Icon Selector */}
              <Text style={styles.inputLabel}>CHOOSE ICON</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                {[
                  'receipt-outline', 'tv-outline', 'home-outline', 'flash-outline',
                  'musical-notes-outline', 'wifi-outline', 'fitness-outline', 'car-outline',
                  'card-outline', 'water-outline', 'phone-portrait-outline', 'shield-checkmark-outline'
                ].map(icon => (
                  <TouchableOpacity
                    key={icon}
                    onPress={() => setNewBillIcon(icon)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: newBillIcon === icon ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: newBillIcon === icon ? '#ef4444' : 'rgba(255,255,255,0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={icon as any} size={20} color={newBillIcon === icon ? '#ef4444' : 'rgba(255,255,255,0.6)'} />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleAddBill}
                activeOpacity={0.85}
                style={[styles.saveBtn, { backgroundColor: '#ef4444' }]}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Create Bill</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── MODAL: EDIT SAVINGS GOAL ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editGoalModalVisible}
        onRequestClose={() => {
          setEditGoalModalVisible(false);
          setEditingGoal(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { maxHeight: height * 0.85 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit Savings Goal</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', marginTop: 2 }}>
                  {editingGoal?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setEditGoalModalVisible(false); setEditingGoal(null); }}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Goal Icon Emoji Selector */}
              <Text style={styles.inputLabel}>CHOOSE EMOJI ICON</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {['🎯', '🎮', '✈️', '💻', '🚗', '🛡️', '🏡', '🎓', '💍', '🏖️', '💰', '📱'].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => setEditGoalIcon(emoji)}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: editGoalIcon === emoji ? 'rgba(115,242,24,0.2)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: editGoalIcon === emoji ? '#73f218' : 'rgba(255,255,255,0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>GOAL NAME</Text>
              <TextInput
                value={editGoalName}
                onChangeText={setEditGoalName}
                placeholder="e.g. Emergency Fund, PS5, Laptop..."
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>CURRENT SAVED ({currency.code})</Text>
                  <TextInput
                    value={editGoalSaved}
                    onChangeText={setEditGoalSaved}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#475569"
                    style={styles.modalInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>TARGET AMOUNT ({currency.code})</Text>
                  <TextInput
                    value={editGoalTarget}
                    onChangeText={setEditGoalTarget}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 5000"
                    placeholderTextColor="#475569"
                    style={styles.modalInput}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>MONTHLY SAVING CONTRIBUTION ({currency.code}/mo)</Text>
              <TextInput
                value={editGoalMonthlyContrib}
                onChangeText={setEditGoalMonthlyContrib}
                keyboardType="decimal-pad"
                placeholder="e.g. 250"
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              <Text style={styles.inputLabel}>TARGET DEADLINE</Text>
              <TextInput
                value={editGoalDeadline}
                onChangeText={setEditGoalDeadline}
                placeholder="e.g. 27 May 2027"
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              {/* Live Completion Estimate Banner */}
              {(() => {
                const tg = parseFloat(editGoalTarget) || 0;
                const sv = parseFloat(editGoalSaved) || 0;
                const mc = parseFloat(editGoalMonthlyContrib) || 0;
                const rem = Math.max(0, tg - sv);
                const mRem = mc > 0 ? Math.ceil(rem / mc) : 0;
                
                return (
                  <View style={{ backgroundColor: 'rgba(115, 242, 24, 0.08)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(115, 242, 24, 0.18)' }}>
                    <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '800' }}>
                      ⚡ Estimated Time to Complete: {rem === 0 ? 'Goal Met ✓' : `${mRem} ${mRem === 1 ? 'month' : 'months'} at ${formatAmount(mc)}/mo`}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 2 }}>
                      Remaining Balance to Save: {formatAmount(rem)}
                    </Text>
                  </View>
                );
              })()}

              <TouchableOpacity
                onPress={handleSaveEditedGoal}
                activeOpacity={0.85}
                style={[styles.saveBtn, { backgroundColor: '#73f218', marginBottom: 12 }]}
              >
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Save Changes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeleteEditedGoal}
                activeOpacity={0.85}
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 12 }}>Delete Savings Goal</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── MODAL: INCOME OVERVIEW ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={incomeModalVisible}
        onRequestClose={() => setIncomeModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>Income Streams</Text>
              <TouchableOpacity onPress={() => setIncomeModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10 }}>
              {incomeStreams.map((inc) => (
                <View key={inc.id} style={styles.billCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{inc.name}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>{inc.date} • {inc.freq}</Text>
                  </View>
                  <Text style={{ color: '#73f218', fontWeight: '900', fontSize: 14 }}>+{formatAmount(inc.amount)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ADD CUSTOM CATEGORY ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addCatModalVisible}
        onRequestClose={() => setAddCatModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { maxHeight: height * 0.85 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>Create Custom Category</Text>
              <TouchableOpacity onPress={() => setAddCatModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.inputLabel}>CATEGORY NAME</Text>
              <TextInput
                value={newCatName}
                onChangeText={setNewCatName}
                placeholder="e.g. Education, Pets, Fitness..."
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              <Text style={styles.inputLabel}>BUDGET LIMIT ({currency.code})</Text>
              <TextInput
                value={newCatBudget}
                onChangeText={setNewCatBudget}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              {/* Color Palette */}
              <Text style={styles.inputLabel}>CHOOSE COLOR</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {['#14b8a6', '#f59e0b', '#6366f1', '#ec4899', '#73f218', '#a855f7', '#3b82f6', '#06b6d4', '#64748b', '#ef4444'].map(color => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => setNewCatColor(color)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: color,
                      borderWidth: newCatColor === color ? 3 : 0,
                      borderColor: '#fff',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {newCatColor === color && <Ionicons name="checkmark" size={18} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Icon Palette */}
              <Text style={styles.inputLabel}>CHOOSE ICON</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                {[
                  'pricetag-outline', 'school-outline', 'fitness-outline', 'tv-outline',
                  'paw-outline', 'construct-outline', 'briefcase-outline', 'gift-outline',
                  'book-outline', 'camera-outline', 'color-palette-outline', 'barbell-outline'
                ].map(icon => (
                  <TouchableOpacity
                    key={icon}
                    onPress={() => setNewCatIcon(icon)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: newCatIcon === icon ? newCatColor + '30' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: newCatIcon === icon ? newCatColor : 'rgba(255,255,255,0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={icon as any} size={20} color={newCatIcon === icon ? newCatColor : 'rgba(255,255,255,0.6)'} />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleAddCategory}
                activeOpacity={0.85}
                style={[styles.saveBtn, { backgroundColor: newCatColor }]}
              >
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Create Category</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── MODAL: ADD INCOME ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addIncModalVisible}
        onRequestClose={() => setAddIncModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { maxHeight: height * 0.85 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>Add Income Source</Text>
              <TouchableOpacity onPress={() => setAddIncModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.inputLabel}>INCOME SOURCE NAME</Text>
              <TouchableOpacity
                onPress={() => setIncSourcePickerVisible(true)}
                style={[styles.modalInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }]}
              >
                <Text style={{ color: newIncName ? '#fff' : '#475569', fontSize: 13, fontWeight: '600' }}>
                  {newIncName || 'Select income source type...'}
                </Text>
                <Ionicons name="chevron-down-outline" size={16} color="#73f218" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>DEPOSIT CYCLE / FREQUENCY</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
                {['Weekly', 'Bi-weekly', 'Monthly', 'One-off'].map((freq) => {
                  const active = newIncFrequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      onPress={() => setNewIncFrequency(freq)}
                      style={{
                        flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1,
                        backgroundColor: active ? 'rgba(115, 242, 24, 0.15)' : 'rgba(255,255,255,0.02)',
                        borderColor: active ? '#73f218' : 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <Text style={{ color: active ? '#73f218' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800' }}>{freq}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>RECEIPT / CLEARING DATE</Text>
              <TouchableOpacity
                onPress={() => openCalendarPicker('income', newIncDate)}
                style={[styles.modalInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{newIncDate}</Text>
                <Ionicons name="calendar-outline" size={16} color="#73f218" />
              </TouchableOpacity>

              {newIncFrequency !== 'One-off' && (
                <View style={{ marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' }}>Continuous stream (Indefinite)</Text>
                    <Switch
                      value={newIncIsContinuous}
                      onValueChange={setNewIncIsContinuous}
                      trackColor={{ false: '#334155', true: '#73f218' }}
                      thumbColor={newIncIsContinuous ? '#0f172a' : '#94a3b8'}
                    />
                  </View>
                  {!newIncIsContinuous && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.inputLabel, { marginBottom: 6 }]}>END DATE / STOP CLEARING ON</Text>
                      <TextInput
                        value={newIncEndDate}
                        onChangeText={setNewIncEndDate}
                        placeholder="e.g. 2026-12-31"
                        placeholderTextColor="#475569"
                        style={[styles.modalInput, { marginBottom: 0 }]}
                      />
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.inputLabel}>AMOUNT & CURRENCY</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                {/* Amount Input Box */}
                <View style={[styles.modalInput, { flex: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 0, paddingHorizontal: 14 }]}>
                  <Text style={{ color: '#73f218', fontSize: (activeIncCurrency.symbol || '').length > 2 ? 14 : 18, fontWeight: '800', marginRight: 6 }}>
                    {activeIncCurrency.symbol}
                  </Text>
                  <TextInput
                    value={newIncAmount}
                    onChangeText={setNewIncAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#475569"
                    style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', outlineStyle: 'none' } as any}
                  />
                </View>

                {/* Currency Selector Box */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowIncCurrencyPicker(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    gap: 6,
                  }}
                >
                  <Image
                    source={{ uri: activeIncCurrency.flagUrl }}
                    style={{ width: 22, height: 16, borderRadius: 3, resizeMode: 'cover' }}
                  />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                    {activeIncCurrency.code}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleSaveIncome}
                activeOpacity={0.85}
                style={styles.saveBtn}
              >
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Save Income Source</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── MODAL: EDIT CATEGORY BUDGET ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editCategory !== null}
        onRequestClose={() => setEditCategory(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.calendarBackdrop}
        >
          <View style={styles.calendarSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>Set {editCategory?.name} Limit</Text>
              <TouchableOpacity onPress={() => setEditCategory(null)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>BUDGET LIMIT AMOUNT ({currency.symbol.trim()})</Text>
            <TextInput
              value={editBudgetAmount}
              onChangeText={setEditBudgetAmount}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="0.00"
              placeholderTextColor="#475569"
              style={styles.modalInput}
            />

            <TouchableOpacity
              onPress={handleSaveBudgetEdit}
              activeOpacity={0.85}
              style={[styles.saveBtn, { backgroundColor: editCategory?.color || '#73f218' }]}
            >
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Apply Allocation</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── MODAL: VIEW CATEGORY DETAILS ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={selectedCategory !== null}
        onRequestClose={() => setSelectedCategory(null)}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: selectedCategory?.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={selectedCategory?.icon} size={16} color={selectedCategory?.color} />
                </View>
                <Text style={styles.modalTitle}>{selectedCategory?.name} Statistics</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {selectedCategory && (() => {
              const details = selectedCatDetails;
              const budgetVal = details?.budget || selectedCategory.budget || 0;
              const spentVal = details?.spent || selectedCategory.spent || 0;
              const remVal = budgetVal - spentVal;
              const dailyAvgVal = details?.dailyAvg || (spentVal > 0 ? spentVal / 30 : 0);
              const weeklyAvgVal = details?.weeklyAvg || (dailyAvgVal * 7);
              const forecastVal = details?.forecast || (dailyAvgVal * 30);
              const txs = details?.catTxs || [];
              const countVal = txs.length;
              return (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Budget Limit</Text>
                    <Text style={styles.insightValue}>{formatAmount(budgetVal)}</Text>
                  </View>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Total Spent</Text>
                    <Text style={[styles.insightValue, { color: '#ef4444' }]}>{formatAmount(spentVal)}</Text>
                  </View>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Remaining Balance</Text>
                    <Text style={[styles.insightValue, { color: remVal < 0 ? '#ef4444' : '#73f218' }]}>
                      {remVal < 0 ? `-${formatAmount(Math.abs(remVal))}` : formatAmount(remVal)}
                    </Text>
                  </View>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Daily Average</Text>
                    <Text style={styles.insightValue}>{formatAmount(dailyAvgVal)} / day</Text>
                  </View>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Weekly Average</Text>
                    <Text style={styles.insightValue}>{formatAmount(weeklyAvgVal)} / wk</Text>
                  </View>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Expected Forecast</Text>
                    <Text style={styles.insightValue}>{formatAmount(forecastVal)} / mo</Text>
                  </View>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Payments Count</Text>
                    <Text style={styles.insightValue}>{countVal} {countVal === 1 ? 'tx' : 'txs'}</Text>
                  </View>

                  {/* ── Real Category Transactions List ── */}
                  <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>
                      Category Transactions ({txs.length})
                    </Text>
                    {txs.length === 0 ? (
                      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginVertical: 10 }}>
                        No individual transactions recorded yet for {selectedCategory.name}.
                      </Text>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {txs.map((t: any, idx: number) => (
                          <View
                            key={t.id || idx}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              borderRadius: 12,
                              padding: 12,
                              borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.05)',
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name={t.icon as any || 'card-outline'} size={16} color="#ef4444" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{t.title}</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>{t.date} · {t.account || 'Wallet'}</Text>
                              </View>
                            </View>
                            <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '800' }}>
                              -{formatAmount(t.amount)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ADD TRANSACTION ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addTxModalVisible}
        onRequestClose={() => setAddTxModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { maxHeight: height * 0.85 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>Log Expense Payment</Text>
              <TouchableOpacity onPress={() => setAddTxModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.inputLabel}>MERCHANT / DESC</Text>
              <TouchableOpacity
                onPress={() => setPresetMerchantPickerVisible(true)}
                style={[styles.modalInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }]}
              >
                <Text style={{ color: newTxMerchant ? '#fff' : '#475569', fontSize: 13, fontWeight: '600' }}>
                  {newTxMerchant || 'Select merchant / description...'}
                </Text>
                <Ionicons name="chevron-down-outline" size={16} color="#ef4444" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>CATEGORY</Text>
              <TouchableOpacity
                onPress={() => setExpCatPickerVisible(true)}
                style={[styles.modalInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }]}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  {newTxCategory}
                </Text>
                <Ionicons name="chevron-down-outline" size={16} color="#ef4444" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>TRANSACTION / VALUE DATE</Text>
              <TouchableOpacity
                onPress={() => openCalendarPicker('expense', newTxDate)}
                style={[styles.modalInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{newTxDate}</Text>
                <Ionicons name="calendar-outline" size={16} color="#ef4444" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>RECURRING CYCLE / FREQUENCY</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
                {['One-off', 'Weekly', 'Monthly', 'Yearly'].map((freq) => {
                  const active = newTxFrequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      onPress={() => setNewTxFrequency(freq)}
                      style={{
                        flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1,
                        backgroundColor: active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.02)',
                        borderColor: active ? '#ef4444' : 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <Text style={{ color: active ? '#ef4444' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800' }}>{freq}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {newTxFrequency !== 'One-off' && (
                <View style={{ marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' }}>Continuous payment (Indefinite)</Text>
                    <Switch
                      value={newTxIsContinuous}
                      onValueChange={setNewTxIsContinuous}
                      trackColor={{ false: '#334155', true: '#ef4444' }}
                      thumbColor={newTxIsContinuous ? '#fff' : '#94a3b8'}
                    />
                  </View>
                  {!newTxIsContinuous && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.inputLabel, { marginBottom: 6 }]}>END DATE / LAST PAYMENT ON</Text>
                      <TextInput
                        value={newTxEndDate}
                        onChangeText={setNewTxEndDate}
                        placeholder="e.g. 2027-07-16"
                        placeholderTextColor="#475569"
                        style={[styles.modalInput, { marginBottom: 0 }]}
                      />
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.inputLabel}>AMOUNT & CURRENCY</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                {/* Amount Input Box */}
                <View style={[styles.modalInput, { flex: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 0, paddingHorizontal: 14 }]}>
                  <Text style={{ color: '#ef4444', fontSize: (activeTxCurrency.symbol || '').length > 2 ? 14 : 18, fontWeight: '800', marginRight: 6 }}>
                    {activeTxCurrency.symbol}
                  </Text>
                  <TextInput
                    value={newTxAmount}
                    onChangeText={setNewTxAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#475569"
                    style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', outlineStyle: 'none' } as any}
                  />
                </View>

                {/* Currency Selector Box */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowTxCurrencyPicker(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    gap: 6,
                  }}
                >
                  <Image
                    source={{ uri: activeTxCurrency.flagUrl }}
                    style={{ width: 22, height: 16, borderRadius: 3, resizeMode: 'cover' }}
                  />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                    {activeTxCurrency.code}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleLogTransaction}
                activeOpacity={0.85}
                style={styles.saveBtn}
              >
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Log Expense</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── CUSTOM INCOME SOURCE PICKER MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={incSourcePickerVisible}
        onRequestClose={() => {
          setIncSourcePickerVisible(false);
          setIsSpecifyingOtherIncome(false);
          setTempOtherIncomeName('');
        }}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            {!isSpecifyingOtherIncome ? (
              <>
                <Text style={[styles.modalTitle, { fontSize: 16, marginBottom: 16, textAlign: 'center' }]}>Select Income Source</Text>
                
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                  {[
                    { name: 'Salary', icon: 'cash-outline', color: '#73f218' },
                    { name: 'Business', icon: 'briefcase-outline', color: '#f59e0b' },
                    { name: 'Freelance', icon: 'laptop-outline', color: '#3b82f6' },
                    { name: 'Investments', icon: 'trending-up-outline', color: '#10b981' },
                    { name: 'Bonuses', icon: 'gift-outline', color: '#a855f7' },
                    { name: 'Gifts', icon: 'heart-outline', color: '#ec4899' },
                    { name: 'Refunds', icon: 'refresh-outline', color: '#64748b' },
                    { name: 'Other Income', icon: 'wallet-outline', color: '#06b6d4' }
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.name}
                      onPress={() => {
                        if (item.name === 'Other Income') {
                          setIsSpecifyingOtherIncome(true);
                        } else {
                          setNewIncName(item.name);
                          setNewIncCategory(item.name);
                          setIncSourcePickerVisible(false);
                        }
                      }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
                        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)'
                      }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: item.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={item.icon as any} size={16} color={item.color} />
                      </View>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  onPress={() => {
                    setIncSourcePickerVisible(false);
                    setIsSpecifyingOtherIncome(false);
                    setTempOtherIncomeName('');
                  }}
                  style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.modalTitle, { fontSize: 16, marginBottom: 16, textAlign: 'center' }]}>Specify Other Income</Text>
                
                <Text style={styles.inputLabel}>OTHER INCOME NAME</Text>
                <TextInput
                  value={tempOtherIncomeName}
                  onChangeText={setTempOtherIncomeName}
                  placeholder="e.g. Birthday Gift, Sold Bike"
                  placeholderTextColor="#475569"
                  style={styles.modalInput}
                  autoFocus
                />

                <TouchableOpacity
                  onPress={() => {
                    const finalName = tempOtherIncomeName.trim() || 'Other Income';
                    setNewIncName(finalName);
                    setNewIncCategory('Other Income');
                    setIncSourcePickerVisible(false);
                    setIsSpecifyingOtherIncome(false);
                    setTempOtherIncomeName('');
                  }}
                  activeOpacity={0.85}
                  style={styles.saveBtn}
                >
                  <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Save Source</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setIsSpecifyingOtherIncome(false);
                    setTempOtherIncomeName('');
                  }}
                  style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Back to List</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM EXPENSE CATEGORY PICKER MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={expCatPickerVisible}
        onRequestClose={() => setExpCatPickerVisible(false)}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            <Text style={[styles.modalTitle, { fontSize: 16, marginBottom: 16, textAlign: 'center' }]}>Select Category</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => {
                    setNewTxCategory(c.name);
                    setExpCatPickerVisible(false);
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)'
                  }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={c.icon as any} size={16} color={c.color} />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setExpCatPickerVisible(false)}
              style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM PRESET MERCHANT PICKER MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={presetMerchantPickerVisible}
        onRequestClose={() => {
          setPresetMerchantPickerVisible(false);
          setIsSpecifyingOtherMerchant(false);
          setTempOtherMerchantName('');
        }}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            {!isSpecifyingOtherMerchant ? (
              <>
                <Text style={[styles.modalTitle, { fontSize: 16, marginBottom: 16, textAlign: 'center' }]}>Select Merchant / Presets</Text>
                
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                  {[
                    { name: 'Starbucks Coffee', category: 'Food', icon: 'fast-food-outline', color: '#f59e0b' },
                    { name: 'Whole Foods Market', category: 'Food', icon: 'fast-food-outline', color: '#f59e0b' },
                    { name: 'Netflix Subscription', category: 'Bills', icon: 'tv-outline', color: '#ec4899' },
                    { name: 'ExxonMobil Fuel', category: 'Transportation', icon: 'car-outline', color: '#6366f1' },
                    { name: 'Uber Rideshare', category: 'Transportation', icon: 'car-outline', color: '#6366f1' },
                    { name: 'Landlord Rent', category: 'Housing', icon: 'home-outline', color: '#14b8a6' },
                    { name: 'LA Fitness Gym', category: 'Health', icon: 'medkit-outline', color: '#73f218' },
                    { name: 'Delta Airlines Flights', category: 'Travel', icon: 'airplane-outline', color: '#06b6d4' },
                    { name: 'Other / Custom Merchant', category: 'Miscellaneous', icon: 'pencil-outline', color: '#64748b' }
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.name}
                      onPress={() => {
                        if (item.name === 'Other / Custom Merchant') {
                          setIsSpecifyingOtherMerchant(true);
                        } else {
                          setNewTxMerchant(item.name);
                          setNewTxCategory(item.category);
                          setPresetMerchantPickerVisible(false);
                        }
                      }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
                        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)'
                      }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: item.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={item.icon as any} size={16} color={item.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{item.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 1 }}>
                          {item.name === 'Other / Custom Merchant' ? 'Type a custom description' : `Auto-fills category: ${item.category}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  onPress={() => {
                    setPresetMerchantPickerVisible(false);
                    setIsSpecifyingOtherMerchant(false);
                    setTempOtherMerchantName('');
                  }}
                  style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.modalTitle, { fontSize: 16, marginBottom: 16, textAlign: 'center' }]}>Specify Custom Merchant</Text>
                
                <Text style={styles.inputLabel}>MERCHANT / DESC NAME</Text>
                <TextInput
                  value={tempOtherMerchantName}
                  onChangeText={setTempOtherMerchantName}
                  placeholder="e.g. Local Grocery Store, Cafe"
                  placeholderTextColor="#475569"
                  style={styles.modalInput}
                  autoFocus
                />

                <TouchableOpacity
                  onPress={() => {
                    const finalName = tempOtherMerchantName.trim() || 'Custom Merchant';
                    setNewTxMerchant(finalName);
                    setPresetMerchantPickerVisible(false);
                    setIsSpecifyingOtherMerchant(false);
                    setTempOtherMerchantName('');
                  }}
                  activeOpacity={0.85}
                  style={styles.saveBtn}
                >
                  <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Save Merchant</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setIsSpecifyingOtherMerchant(false);
                    setTempOtherMerchantName('');
                  }}
                  style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Back to List</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM DELETE CONFIRMATION MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={categoryToDelete !== null}
        onRequestClose={() => setCategoryToDelete(null)}
      >
        <View style={styles.calendarBackdrop}>
          <View style={[styles.calendarSheet, { alignItems: 'center' }]}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(239, 68, 68, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </View>
            <Text style={[styles.modalTitle, { fontSize: 16, marginBottom: 10, textAlign: 'center' }]}>Delete Category Limit?</Text>
            <Text style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 24 }}>
              Are you sure you want to remove this category limit from your budget dashboard? This action cannot be undone.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                onPress={() => setCategoryToDelete(null)}
                style={{
                  flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center'
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (categoryToDelete) {
                    setCategories(categories.filter(c => c.id !== categoryToDelete));
                    setCategoryToDelete(null);
                  }
                }}
                activeOpacity={0.85}
                style={{
                  flex: 1, backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 12, alignItems: 'center'
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM ADD SAVINGS GOAL MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={addGoalModalVisible}
        onRequestClose={() => setAddGoalModalVisible(false)}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(115, 242, 24, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="trending-up" size={18} color="#73f218" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>New Savings Goal</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', marginTop: 1 }}>
                    PLAN FOR THE FUTURE
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setAddGoalModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Form Input fields */}
              <View style={{ gap: 14, marginBottom: 16 }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>GOAL NAME</Text>
                  <TouchableOpacity
                    onPress={() => setGoalNamePickerVisible(true)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
                      paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                      {selectedGoalPreset === 'Other' && newGoalName ? newGoalName : selectedGoalPreset}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>

                  {/* Conditional input if 'Other' is selected */}
                  {selectedGoalPreset === 'Other' && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', marginBottom: 6 }}>SPECIFY OTHER GOAL NAME</Text>
                      <TextInput
                        value={newGoalName}
                        onChangeText={setNewGoalName}
                        placeholder="Enter custom goal name..."
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
                          paddingHorizontal: 14, paddingVertical: 12, color: '#fff',
                          fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                        }}
                      />
                    </View>
                  )}
                </View>

                {/* Goal Currency Selector Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800' }}>GOAL CURRENCY</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 1 }}>Select currency for this savings goal</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowGoalCurrencyPicker(true)}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: 'rgba(115,242,24,0.12)', paddingHorizontal: 12, paddingVertical: 6,
                      borderRadius: 10, borderWidth: 1, borderColor: '#73f218', gap: 6
                    }}
                  >
                    <Image source={{ uri: activeGoalCurrency.flagUrl }} style={{ width: 18, height: 13, borderRadius: 2, resizeMode: 'cover' }} />
                    <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '900' }}>
                      {activeGoalCurrency.code} ({activeGoalCurrency.symbol})
                    </Text>
                    <Ionicons name="chevron-down" size={13} color="#73f218" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>TARGET AMOUNT ({activeGoalCurrency.symbol})</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={newGoalTarget}
                      onChangeText={setNewGoalTarget}
                      placeholder="e.g. 5000"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
                        paddingHorizontal: 14, paddingVertical: 12, color: '#fff',
                        fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>INITIAL DEPOSIT ({activeGoalCurrency.symbol})</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={newGoalInitialSaved}
                      onChangeText={setNewGoalInitialSaved}
                      placeholder="e.g. 0 (Optional)"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
                        paddingHorizontal: 14, paddingVertical: 12, color: '#fff',
                        fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                      }}
                    />
                  </View>
                </View>

                {/* Fueling Source (Optional) */}
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>FUELING INCOME SOURCE (OPTIONAL)</Text>
                  <TouchableOpacity
                    onPress={() => setFuelSourcePickerVisible(true)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
                      paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                      {newGoalFuelSourceId === 'none' 
                        ? 'None (Manual Savings Contribution)' 
                        : (() => {
                            const stream = incomeStreams.find(s => s.id === newGoalFuelSourceId);
                            if (!stream) return 'None (Manual Savings Contribution)';
                            const label = newGoalFuelMode === 'percent' ? `${newGoalFuelValue}% of ` : `$${newGoalFuelValue}/mo of `;
                            return `${label}${stream.name}`;
                          })()
                      }
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </View>

                {newGoalFuelSourceId === 'none' && (
                  <>
                    {/* Pace Mode selection */}
                    <View>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>CALCULATION MODE</Text>
                      <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
                        <TouchableOpacity
                          onPress={() => setNewGoalPaceMode('date')}
                          style={{
                            flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                            backgroundColor: newGoalPaceMode === 'date' ? 'rgba(255,255,255,0.08)' : 'transparent'
                          }}
                        >
                          <Text style={{ color: newGoalPaceMode === 'date' ? '#73f218' : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>
                            BY DEADLINE DATE
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setNewGoalPaceMode('monthly')}
                          style={{
                            flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                            backgroundColor: newGoalPaceMode === 'monthly' ? 'rgba(255,255,255,0.08)' : 'transparent'
                          }}
                        >
                          <Text style={{ color: newGoalPaceMode === 'monthly' ? '#73f218' : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>
                            BY MONTHLY CONTRIBUTION
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {newGoalPaceMode === 'date' ? (
                      <View>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>
                          DEADLINE: {newGoalMonthsRemaining} MONTHS ({getEstimatedTargetDate(newGoalMonthsRemaining)})
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                          {[3, 6, 12, 18, 24, 36].map((months) => (
                            <TouchableOpacity
                              key={months}
                              onPress={() => setNewGoalMonthsRemaining(months)}
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 12, paddingVertical: 8,
                                borderRadius: 8, borderWidth: 1,
                                borderColor: newGoalMonthsRemaining === months ? '#73f218' : 'rgba(255,255,255,0.06)'
                              }}
                            >
                              <Text style={{ color: newGoalMonthsRemaining === months ? '#73f218' : '#fff', fontSize: 10, fontWeight: '800' }}>
                                {months} Mo.
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>MONTHLY SAVINGS CONTRIBUTION ($)</Text>
                        <TextInput
                          keyboardType="numeric"
                          value={newGoalMonthlySaving}
                          onChangeText={setNewGoalMonthlySaving}
                          placeholder="e.g. 250"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
                            paddingHorizontal: 14, paddingVertical: 12, color: '#fff',
                            fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                          }}
                        />
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Dynamic Live Recommendation Box / Frosted Estimator Card */}
              {(() => {
                const targetAmt = parseFloat(newGoalTarget) || 0;
                const initialSaved = parseFloat(newGoalInitialSaved) || 0;
                const remains = targetAmt - initialSaved;
                
                if (targetAmt <= 0) return null;

                let monthlyRate = 0;
                let calculationLabel = '';
                let monthsRem = 0;
                let estDate = '';

                if (newGoalFuelSourceId !== 'none') {
                  const stream = incomeStreams.find(s => s.id === newGoalFuelSourceId);
                  if (stream) {
                    const val = parseFloat(newGoalFuelValue) || 0;
                    if (val > 0) {
                      if (newGoalFuelMode === 'percent') {
                        monthlyRate = Math.round(stream.amount * (val / 100));
                      } else {
                        monthlyRate = val;
                      }
                      calculationLabel = `Fueling: ${newGoalFuelMode === 'percent' ? `${val}%` : `$${val}/mo`} of ${stream.name}`;
                      monthsRem = remains > 0 ? Math.ceil(remains / monthlyRate) : 0;
                      estDate = getEstimatedTargetDate(monthsRem);
                    }
                  }
                } else {
                  if (newGoalPaceMode === 'date') {
                    monthsRem = newGoalMonthsRemaining;
                    monthlyRate = remains > 0 ? Math.ceil(remains / newGoalMonthsRemaining) : 0;
                    estDate = getEstimatedTargetDate(newGoalMonthsRemaining);
                    calculationLabel = `Target Deadline: ${newGoalMonthsRemaining} Mo.`;
                  } else {
                    const customMonthly = parseFloat(newGoalMonthlySaving) || 0;
                    if (customMonthly > 0) {
                      monthlyRate = customMonthly;
                      monthsRem = remains > 0 ? Math.ceil(remains / customMonthly) : 0;
                      estDate = getEstimatedTargetDate(monthsRem);
                      calculationLabel = 'Manual Monthly Savings';
                    }
                  }
                }

                if (monthlyRate === 0 && newGoalPaceMode !== 'date') return null;

                return (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, marginBottom: 16 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', marginBottom: 10, letterSpacing: 0.5 }}>SMART TARGET ESTIMATOR</Text>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>MONTHS REMAINING</Text>
                        <Text style={{ color: remains <= 0 ? '#73f218' : '#fff', fontSize: 18, fontWeight: '900', marginTop: 2 }}>
                          {remains <= 0 ? 'Goal Met ✓' : `${monthsRem} months`}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>TARGET COMPLETION</Text>
                        <Text style={{ color: '#73f218', fontSize: 13, fontWeight: '800', marginTop: 2 }}>
                          {remains <= 0 ? 'Immediately' : estDate}
                        </Text>
                      </View>
                    </View>

                    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Required Rate</Text>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>${monthlyRate.toLocaleString()}/mo</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Remaining Balance</Text>
                        <Text style={{ color: remains > 0 ? '#ef4444' : '#73f218', fontSize: 10, fontWeight: '800' }}>
                          ${Math.max(0, remains).toLocaleString()}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Mode</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' }}>{calculationLabel}</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </ScrollView>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setAddGoalModalVisible(false)}
                style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateGoal}
                activeOpacity={0.85}
                style={{ flex: 1, backgroundColor: '#73f218', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '900' }}>Create Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM GOAL NAME PICKER MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={goalNamePickerVisible}
        onRequestClose={() => {
          setGoalNamePickerVisible(false);
          setIsSpecifyingOtherGoal(false);
        }}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            {!isSpecifyingOtherGoal ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Select Goal Name</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', marginTop: 1 }}>
                      CHOOSE A PRESET
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setGoalNamePickerVisible(false)}>
                    <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 250 }}>
                  {['Emergency Fund', 'Vacation Trip', 'Downpayment Car', 'New Gadget', 'Retirement', 'Other'].map((preset) => {
                    const active = selectedGoalPreset === preset;
                    return (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => {
                          if (preset !== 'Other') {
                            setSelectedGoalPreset(preset);
                            setNewGoalName(preset);
                            setGoalNamePickerVisible(false);
                          } else {
                            setIsSpecifyingOtherGoal(true);
                            setTempOtherGoalName('');
                          }
                        }}
                        style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          backgroundColor: active ? 'rgba(115, 242, 24, 0.08)' : 'rgba(255,255,255,0.02)',
                          paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginBottom: 8,
                          borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.04)'
                        }}
                      >
                        <Text style={{ color: active ? '#73f218' : '#fff', fontSize: 13, fontWeight: '700' }}>
                          {preset}
                        </Text>
                        {active && <Ionicons name="checkmark" size={16} color="#73f218" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  onPress={() => setGoalNamePickerVisible(false)}
                  style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Specify Other Goal</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', marginTop: 1 }}>
                      ENTER CUSTOM VALUE
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    setGoalNamePickerVisible(false);
                    setIsSpecifyingOtherGoal(false);
                  }}>
                    <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>SPECIFY OTHER GOAL NAME</Text>
                  <TextInput
                    value={tempOtherGoalName}
                    onChangeText={setTempOtherGoalName}
                    placeholder="e.g. Dream House Fund, Wedding Savings"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
                      paddingHorizontal: 14, paddingVertical: 12, color: '#fff',
                      fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                    }}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (!tempOtherGoalName.trim()) {
                      Alert.alert('Error', 'Please enter a goal name.');
                      return;
                    }
                    setNewGoalName(tempOtherGoalName.trim());
                    setSelectedGoalPreset('Other');
                    setIsSpecifyingOtherGoal(false);
                    setGoalNamePickerVisible(false);
                  }}
                  activeOpacity={0.85}
                  style={styles.saveBtn}
                >
                  <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Save Goal Name</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setIsSpecifyingOtherGoal(false);
                    setTempOtherGoalName('');
                  }}
                  style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Back to List</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM FUEL INCOME SOURCE PICKER MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={fuelSourcePickerVisible}
        onRequestClose={() => setFuelSourcePickerVisible(false)}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={styles.modalTitle}>Goal Fueling Source</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', marginTop: 1 }}>
                  LINK INCOME STREAM
                </Text>
              </View>
              <TouchableOpacity onPress={() => setFuelSourcePickerVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
              {/* Option 1: None */}
              <TouchableOpacity
                onPress={() => {
                  setNewGoalFuelSourceId('none');
                  setNewGoalFuelValue('');
                  setFuelSourcePickerVisible(false);
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: newGoalFuelSourceId === 'none' ? 'rgba(115, 242, 24, 0.08)' : 'rgba(255,255,255,0.02)',
                  paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginBottom: 12,
                  borderWidth: 1, borderColor: newGoalFuelSourceId === 'none' ? '#73f218' : 'rgba(255,255,255,0.04)'
                }}
              >
                <Text style={{ color: newGoalFuelSourceId === 'none' ? '#73f218' : '#fff', fontSize: 13, fontWeight: '700' }}>
                  None (Manual Savings Contribution)
                </Text>
                {newGoalFuelSourceId === 'none' && <Ionicons name="checkmark" size={16} color="#73f218" />}
              </TouchableOpacity>

              {/* List of active income streams */}
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 8, marginTop: 4 }}>CHOOSE INCOME STREAM</Text>
              
              {incomeStreams.map((stream) => {
                const isSelected = newGoalFuelSourceId === stream.id;
                const allocation = getIncomeSourceAllocation(stream.id);
                const remainingPct = Math.max(0, 100 - allocation.pct);
                const remainingFlat = Math.max(0, stream.amount - allocation.flat);
                
                return (
                  <View
                    key={stream.id}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 14, padding: 12, marginBottom: 10,
                      borderWidth: 1, borderColor: isSelected ? '#73f218' : 'rgba(255,255,255,0.04)'
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setNewGoalFuelSourceId(stream.id);
                        setNewGoalFuelValue('');
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: isSelected ? 12 : 0 }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{stream.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>
                          Amount: ${stream.amount.toLocaleString()} ({stream.freq}) • {remainingPct.toFixed(0)}% available
                        </Text>
                      </View>
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: isSelected ? '#73f218' : 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#73f218' }} />}
                      </View>
                    </TouchableOpacity>

                    {isSelected && (
                      <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 10 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', marginBottom: 6 }}>ALLOCATION TYPE</Text>
                        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 2, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
                          <TouchableOpacity
                            onPress={() => setNewGoalFuelMode('percent')}
                            style={{
                              flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center',
                              backgroundColor: newGoalFuelMode === 'percent' ? 'rgba(255,255,255,0.08)' : 'transparent'
                            }}
                          >
                            <Text style={{ color: newGoalFuelMode === 'percent' ? '#73f218' : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>
                              PERCENTAGE (%)
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setNewGoalFuelMode('flat')}
                            style={{
                              flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center',
                              backgroundColor: newGoalFuelMode === 'flat' ? 'rgba(255,255,255,0.08)' : 'transparent'
                            }}
                          >
                            <Text style={{ color: newGoalFuelMode === 'flat' ? '#73f218' : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>
                              FLAT AMOUNT ($)
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <TextInput
                            keyboardType="numeric"
                            value={newGoalFuelValue}
                            onChangeText={setNewGoalFuelValue}
                            placeholder={newGoalFuelMode === 'percent' ? 'e.g. 20' : 'e.g. 150'}
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            style={{
                              flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
                              paddingHorizontal: 12, paddingVertical: 8, color: '#fff',
                              fontSize: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                            }}
                          />
                          <TouchableOpacity
                            onPress={() => {
                              const val = parseFloat(newGoalFuelValue);
                              if (isNaN(val) || val <= 0) {
                                Alert.alert('Error', 'Please enter a valid allocation value.');
                                return;
                              }
                              if (newGoalFuelMode === 'percent') {
                                if (val > remainingPct) {
                                  Alert.alert('Error', `You have already allocated ${allocation.pct.toFixed(0)}% of this income source. The maximum percentage you can allocate is ${remainingPct.toFixed(0)}%.`);
                                  return;
                                }
                              } else {
                                if (val > remainingFlat) {
                                  Alert.alert('Error', `You have already allocated $${allocation.flat} of this income source. The maximum flat amount you can allocate is $${remainingFlat}.`);
                                  return;
                                }
                              }
                              setFuelSourcePickerVisible(false);
                            }}
                            activeOpacity={0.8}
                            style={{
                              backgroundColor: '#73f218', paddingHorizontal: 16, paddingVertical: 8,
                              borderRadius: 10, alignItems: 'center', justifyContent: 'center'
                            }}
                          >
                            <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: '900' }}>Apply</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setFuelSourcePickerVisible(false)}
              style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM SAVINGS GOAL DETAIL MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={selectedGoal !== null}
        onRequestClose={() => setSelectedGoal(null)}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            {selectedGoal !== null && (() => {
              const addedVal = parseFloat(addFundsAmount) || 0;
              const effectiveSaved = Math.min(selectedGoal.target, selectedGoal.saved + addedVal);
              const remains = Math.max(0, selectedGoal.target - effectiveSaved);
              const savedPct = Math.min(Math.round((effectiveSaved / selectedGoal.target) * 100), 100);
              
              // Calculate months remaining based on effective saved & remaining balance
              const monthsRem = selectedGoal.monthlyContribution > 0 
                ? Math.ceil(remains / selectedGoal.monthlyContribution) 
                : 0;

              const origRemains = Math.max(0, selectedGoal.target - selectedGoal.saved);
              const origMonthsRem = selectedGoal.monthlyContribution > 0
                ? Math.ceil(origRemains / selectedGoal.monthlyContribution)
                : 0;
              const monthsSaved = origMonthsRem - monthsRem;

              return (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(115, 242, 24, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="trending-up-outline" size={18} color="#73f218" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalTitle}>{selectedGoal.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', marginTop: 1 }}>
                          SAVINGS GOAL
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedGoal(null)}>
                      <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                  </View>

                  {/* Progress Ring / Bar layout */}
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>TOTAL PROGRESS</Text>
                      <Text style={{ color: '#73f218', fontSize: 16, fontWeight: '900' }}>{savedPct}%</Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 8 }}>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: '#73f218', width: `${savedPct}%` as any }} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                        {formatAmount(effectiveSaved)}
                        {addedVal > 0 && <Text style={{ color: '#73f218', fontSize: 11 }}> (+{formatAmount(addedVal)})</Text>}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Target: {formatAmount(selectedGoal.target)}</Text>
                    </View>
                  </View>

                  {/* Goal stats grid */}
                  <View style={{ gap: 12, marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)', paddingBottom: 8 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>Remaining Balance</Text>
                      <Text style={{ color: remains > 0 ? '#ef4444' : '#73f218', fontSize: 11, fontWeight: '800' }}>
                        {formatAmount(remains)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)', paddingBottom: 8 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>Monthly Saving Pace</Text>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{formatAmount(selectedGoal.monthlyContribution)}/mo</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)', paddingBottom: 8 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>Time to Completion</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                          {remains === 0 ? 'Goal Met ✓' : `${monthsRem} ${monthsRem === 1 ? 'month' : 'months'}`}
                        </Text>
                        {addedVal > 0 && monthsSaved > 0 && (
                          <Text style={{ color: '#73f218', fontSize: 9, fontWeight: '700' }}>
                            ⚡ Saves {monthsSaved} {monthsSaved === 1 ? 'month' : 'months'}!
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)', paddingBottom: 8 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>Target Deadline</Text>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{selectedGoal.deadline}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 4 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>Pace Analysis</Text>
                      <Text style={{ color: remains === 0 || monthsRem <= 6 ? '#73f218' : '#f59e0b', fontSize: 11, fontWeight: '900' }}>
                        {remains === 0 ? 'Completed' : monthsRem <= 6 ? 'On Track ✓' : 'Behind Pace ⚠'}
                      </Text>
                    </View>
                  </View>

                  {/* Add Funds input fields */}
                  {remains > 0 && (
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, marginBottom: 16 }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', marginBottom: 8 }}>QUICK ADD CONTRIBUTION</Text>
                      
                      {/* Short pills */}
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                        {[50, 100, 200, 500].map((amt) => (
                          <TouchableOpacity
                            key={amt}
                            onPress={() => setAddFundsAmount(amt.toString())}
                            style={{
                              flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 6,
                              borderRadius: 8, alignItems: 'center', borderWidth: 1,
                              borderColor: addFundsAmount === amt.toString() ? '#73f218' : 'transparent'
                            }}
                          >
                            <Text style={{ color: addFundsAmount === amt.toString() ? '#73f218' : '#fff', fontSize: 10, fontWeight: '800' }}>
                              +${amt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <TextInput
                          keyboardType="numeric"
                          value={addFundsAmount}
                          onChangeText={setAddFundsAmount}
                          placeholder="Or enter custom amount..."
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          style={{
                            flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
                            paddingHorizontal: 12, paddingVertical: 10, color: '#fff',
                            fontSize: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                          }}
                        />
                        <TouchableOpacity
                          onPress={handleAddFunds}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: '#73f218', paddingHorizontal: 16, paddingVertical: 10,
                            borderRadius: 10, alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: '900' }}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => setSelectedGoal(null)}
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Close Details</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM BILL DETAIL MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={selectedBill !== null}
        onRequestClose={() => setSelectedBill(null)}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            {selectedBill !== null && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: selectedBill.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={selectedBill.icon as any} size={18} color={selectedBill.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>{selectedBill.name}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', marginTop: 1, textTransform: 'uppercase' }}>
                        {selectedBill.category}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedBill(null)}>
                    <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>

                {/* Amount display */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>BILL AMOUNT</Text>
                  <Text style={{ color: selectedBill.paid ? 'rgba(255,255,255,0.4)' : '#ef4444', fontSize: 24, fontWeight: '900', marginTop: 4, textDecorationLine: selectedBill.paid ? 'line-through' : 'none' }}>
                    -${selectedBill.amount.toFixed(2)}
                  </Text>
                  <View style={{
                    marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                    backgroundColor: selectedBill.paid ? 'rgba(115,242,24,0.12)' : 'rgba(239,68,68,0.12)',
                    borderWidth: 1, borderColor: selectedBill.paid ? 'rgba(115,242,24,0.2)' : 'rgba(239,68,68,0.2)'
                  }}>
                    <Text style={{ color: selectedBill.paid ? '#73f218' : '#ef4444', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>
                      {selectedBill.paid ? 'Paid ✓' : 'Unpaid'}
                    </Text>
                  </View>
                </View>

                {/* Grid details list */}
                <View style={{ gap: 12, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)', paddingBottom: 8 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>Due Date</Text>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{selectedBill.date}, 2026</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)', paddingBottom: 8 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>Days Remaining</Text>
                    <Text style={{ color: selectedBill.paid ? 'rgba(255,255,255,0.3)' : selectedBill.daysLeft <= 3 ? '#f87171' : '#fff', fontSize: 11, fontWeight: '800' }}>
                      {selectedBill.paid ? 'N/A' : `${selectedBill.daysLeft} days left`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)', paddingBottom: 8 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>Auto-Pay Status</Text>
                    <Text style={{ color: selectedBill.autoPay ? '#73f218' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800' }}>
                      {selectedBill.autoPay ? 'Enabled (Auto Debit)' : 'Disabled (Manual Pay)'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>Payment Method</Text>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                      {selectedBill.autoPay ? 'Visa ending 4242' : 'Bank Transfer'}
                    </Text>
                  </View>
                </View>

                {/* Primary Action Button */}
                <TouchableOpacity
                  onPress={() => {
                    handleToggleBill(selectedBill.id);
                    setSelectedBill(selectedBill ? { ...selectedBill, paid: !selectedBill.paid } : null);
                  }}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: selectedBill.paid ? 'rgba(255,255,255,0.08)' : selectedBill.color,
                    paddingVertical: 12, borderRadius: 12, alignItems: 'center'
                  }}
                >
                  <Text style={{ color: selectedBill.paid ? '#fff' : '#0f172a', fontSize: 13, fontWeight: '900' }}>
                    {selectedBill.paid ? 'Mark Unpaid' : 'Mark as Paid'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSelectedBill(null)}
                  style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM BREAKDOWN TRANSACTIONS DETAIL MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={breakdownModalVisible}
        onRequestClose={() => setBreakdownModalVisible(false)}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Expenditure Details</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' }}>
                  {breakdownTitle}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setBreakdownModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Total spend summary on this interval */}
            {(() => {
              const totalSpend = breakdownTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
              
              return (
                <>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, marginBottom: 16, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>TOTAL OUTFLOW</Text>
                    <Text style={{ color: totalSpend > 0 ? '#ef4444' : '#73f218', fontSize: 18, fontWeight: '900', marginTop: 4 }}>
                      {totalSpend > 0 ? `-${formatAmount(totalSpend)}` : formatAmount(0)}
                    </Text>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
                    {breakdownTxs.length === 0 ? (
                      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                        <Ionicons name="receipt-outline" size={28} color="rgba(255,255,255,0.15)" />
                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', marginTop: 8 }}>
                          No transactions recorded
                        </Text>
                      </View>
                    ) : (
                      breakdownTxs.map((tx) => (
                        <View
                          key={tx.id}
                          style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)'
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: (tx.color || '#14b8a6') + '20', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name={(tx.icon || 'receipt-outline') as any} size={14} color={tx.color || '#14b8a6'} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{tx.title || tx.category || 'Expense'}</Text>
                              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 1 }}>{tx.category || 'General'} • {tx.date}</Text>
                            </View>
                          </View>
                          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '900' }}>
                            -{formatAmount(tx.amount)}
                          </Text>
                        </View>
                      ))
                    )}
                  </ScrollView>
                </>
              );
            })()}

            <TouchableOpacity
              onPress={() => setBreakdownModalVisible(false)}
              style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM DAY TRANSACTIONS DETAIL MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={selectedCalendarDay !== null}
        onRequestClose={() => setSelectedCalendarDay(null)}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Daily Spending</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', marginTop: 2 }}>
                  {currentMonthData.monthName.toUpperCase()} {selectedCalendarDay}, {currentMonthData.year}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCalendarDay(null)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Total spend summary on this day */}
            {selectedCalendarDay !== null && (() => {
              const dayTxs = getTransactionsForDay(selectedCalendarDay);
              const totalDaySpend = dayTxs.reduce((sum, tx) => sum + tx.amount, 0);
              
              return (
                <>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, marginBottom: 16, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>TOTAL OUTFLOW</Text>
                    <Text style={{ color: totalDaySpend > 0 ? '#ef4444' : '#73f218', fontSize: 18, fontWeight: '900', marginTop: 4 }}>
                      {totalDaySpend > 0 ? `-${formatAmount(totalDaySpend)}` : formatAmount(0)}
                    </Text>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
                    {dayTxs.length === 0 ? (
                      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                        <Ionicons name="receipt-outline" size={28} color="rgba(255,255,255,0.15)" />
                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', marginTop: 8 }}>
                          No transactions recorded
                        </Text>
                      </View>
                    ) : (
                      dayTxs.map((tx) => (
                        <View
                          key={tx.id}
                          style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)'
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: (tx.color || '#14b8a6') + '20', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name={(tx.icon || 'receipt-outline') as any} size={14} color={tx.color || '#14b8a6'} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{tx.title || tx.category || 'Expense'}</Text>
                              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 1 }}>{tx.category || 'General'}</Text>
                            </View>
                          </View>
                          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '900' }}>
                            -{formatAmount(tx.amount)}
                          </Text>
                        </View>
                      ))
                    )}
                  </ScrollView>
                </>
              );
            })()}

            <TouchableOpacity
              onPress={() => setSelectedCalendarDay(null)}
              style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>



      {/* ─── SELECT CURRENCY MODALS ─── */}
      <Modal transparent visible={showIncCurrencyPicker} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowIncCurrencyPicker(false)}
          />
          <View style={{
            backgroundColor: '#1e293b',
            borderRadius: 24,
            padding: 20,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowIncCurrencyPicker(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8 }}>
              {CURRENCIES.map(c => {
                const isSelected = incCurrency.code === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    activeOpacity={0.8}
                    onPress={() => {
                      setIncCurrency(c);
                      setShowIncCurrencyPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      backgroundColor: isSelected ? 'rgba(115, 242, 24, 0.15)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: isSelected ? '#73f218' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Image
                        source={{ uri: c.flagUrl }}
                        style={{ width: 28, height: 20, borderRadius: 4, resizeMode: 'cover', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                      />
                      <View>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{c.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{c.code} ({c.symbol})</Text>
                      </View>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#73f218" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showTxCurrencyPicker} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowTxCurrencyPicker(false)}
          />
          <View style={{
            backgroundColor: '#1e293b',
            borderRadius: 24,
            padding: 20,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowTxCurrencyPicker(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8 }}>
              {CURRENCIES.map(c => {
                const isSelected = txCurrency.code === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    activeOpacity={0.8}
                    onPress={() => {
                      setTxCurrency(c);
                      setShowTxCurrencyPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: isSelected ? '#ef4444' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Image
                        source={{ uri: c.flagUrl }}
                        style={{ width: 28, height: 20, borderRadius: 4, resizeMode: 'cover', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                      />
                      <View>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{c.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{c.code} ({c.symbol})</Text>
                      </View>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#ef4444" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showGoalCurrencyPicker} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowGoalCurrencyPicker(false)}
          />
          <View style={{
            backgroundColor: '#1e293b',
            borderRadius: 24,
            padding: 20,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Select Goal Currency</Text>
              <TouchableOpacity onPress={() => setShowGoalCurrencyPicker(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8 }}>
              {CURRENCIES.map(c => {
                const isSelected = activeGoalCurrency.code === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    activeOpacity={0.8}
                    onPress={() => {
                      setGoalCurrency(c);
                      setShowGoalCurrencyPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      backgroundColor: isSelected ? 'rgba(115, 242, 24, 0.15)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: isSelected ? '#73f218' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Image
                        source={{ uri: c.flagUrl }}
                        style={{ width: 28, height: 20, borderRadius: 4, resizeMode: 'cover', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                      />
                      <View>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{c.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{c.code} ({c.symbol})</Text>
                      </View>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#73f218" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
      {/* ─────────────────────────────────────────────────────────────────
           EXPORT DATA MODAL
      ────────────────────────────────────────────────────────────────── */}
      <Modal visible={exportModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View>
                <Text style={styles.modalTitle}>Export Data</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>Download or share your financial reports</Text>
              </View>
              <TouchableOpacity onPress={() => setExportModalVisible(false)} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 6 }}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>FORMAT</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {['CSV', 'PDF', 'JSON'].map(fmt => {
                const active = exportFormat === fmt;
                return (
                  <TouchableOpacity
                    key={fmt}
                    onPress={() => setExportFormat(fmt)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: active ? 'rgba(115,242,24,0.12)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.1)' }}
                  >
                    <Text style={{ color: active ? '#73f218' : 'rgba(255,255,255,0.5)', fontWeight: '800', fontSize: 12 }}>{fmt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>TIME RANGE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: exportTimeRange === 'Custom Range' ? 12 : 20 }}>
              {['This Month', 'Last Month', 'Year to Date', 'Custom Range'].map(tr => {
                const active = exportTimeRange === tr;
                return (
                  <TouchableOpacity
                    key={tr}
                    onPress={() => setExportTimeRange(tr)}
                    style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: active ? 'rgba(115,242,24,0.12)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.1)' }}
                  >
                    <Text style={{ color: active ? '#73f218' : 'rgba(255,255,255,0.5)', fontWeight: '700', fontSize: 11 }}>{tr}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {exportTimeRange === 'Custom Range' && (
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>FROM DATE</Text>
                  <TouchableOpacity
                    onPress={() => openCalendarPicker('exportStart', exportStartDate)}
                    style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
                      borderWidth: 1, borderColor: '#73f218'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{exportStartDate}</Text>
                    <Ionicons name="calendar-outline" size={16} color="#73f218" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginBottom: 6 }}>UPTO DATE</Text>
                  <TouchableOpacity
                    onPress={() => openCalendarPicker('exportEnd', exportEndDate)}
                    style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
                      borderWidth: 1, borderColor: '#73f218'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{exportEndDate}</Text>
                    <Ionicons name="calendar-outline" size={16} color="#73f218" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>DATA TO INCLUDE</Text>
            <View style={{ gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Income & Expenses', state: exportIncludeIncExp, setter: setExportIncludeIncExp },
                { label: 'Budget Category Breakdown', state: exportIncludeBudgets, setter: setExportIncludeBudgets },
                { label: 'Savings Goals Progress', state: exportIncludeGoals, setter: setExportIncludeGoals },
              ].map((item, idx) => (
                <TouchableOpacity key={idx} onPress={() => item.setter(!item.state)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: item.state ? '#73f218' : 'rgba(255,255,255,0.2)', backgroundColor: item.state ? '#73f218' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {item.state && <Ionicons name="checkmark" size={16} color="#0f172a" />}
                  </View>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.saveBtn}
              onPress={handleGenerateReport}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#0f172a', fontSize: 15, fontWeight: '900' }}>Generate Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────
           BUDGET SETTINGS MODAL
      ────────────────────────────────────────────────────────────────── */}
      <Modal visible={settingsModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>Budget Preferences</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 6 }}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>BUDGETING PERIOD</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {['Weekly', 'Bi-Weekly', 'Monthly', 'Yearly'].map(bp => {
                const active = budgetPeriod === bp;
                return (
                  <TouchableOpacity
                    key={bp}
                    onPress={() => setBudgetPeriod(bp)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: active ? 'rgba(115,242,24,0.12)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.1)' }}
                  >
                    <Text style={{ color: active ? '#73f218' : 'rgba(255,255,255,0.5)', fontWeight: '700', fontSize: 10 }}>{bp}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Rollover Unspent Budget</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4, paddingRight: 20 }}>Automatically add leftover funds to next period's budget.</Text>
              </View>
              <Switch
                value={rolloverBudget}
                onValueChange={setRolloverBudget}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#73f218' }}
                thumbColor="#fff"
              />
            </View>

            <Text style={styles.inputLabel}>OVERSPENDING ALERT THRESHOLD</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Alert me when a category reaches</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 4, paddingVertical: 4 }}>
                <TouchableOpacity onPress={() => setAlertThreshold(Math.max(50, alertThreshold - 5))} style={{ padding: 8 }}>
                  <Ionicons name="remove" size={16} color="#73f218" />
                </TouchableOpacity>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', marginHorizontal: 8 }}>{alertThreshold}%</Text>
                <TouchableOpacity onPress={() => setAlertThreshold(Math.min(100, alertThreshold + 5))} style={{ padding: 8 }}>
                  <Ionicons name="add" size={16} color="#73f218" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.inputLabel}>DEFAULT CURRENCY</Text>
            <TouchableOpacity 
              onPress={() => setShowSettingsCurrencyPicker(true)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 24 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Image source={{ uri: currency.flagUrl }} style={{ width: 24, height: 16, borderRadius: 3 }} />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{currency.code} ({currency.symbol.trim()})</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.saveBtn}
              onPress={handleSavePreferences}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#0f172a', fontSize: 15, fontWeight: '900' }}>Save Preferences</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── SETTINGS CURRENCY PICKER MODAL ─── */}
      <Modal transparent visible={showSettingsCurrencyPicker} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', paddingHorizontal: 24, zIndex: 99999, elevation: 99999 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowSettingsCurrencyPicker(false)}
          />
          <View style={{
            backgroundColor: '#1e293b',
            borderRadius: 24,
            padding: 20,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Select Default Currency</Text>
              <TouchableOpacity onPress={() => setShowSettingsCurrencyPicker(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {CURRENCIES.map(c => {
                  const isSelected = currency.code === c.code;
                  return (
                    <TouchableOpacity
                      key={c.code}
                      activeOpacity={0.8}
                      onPress={() => {
                        setCurrency(c as any);
                        setShowSettingsCurrencyPicker(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 14,
                        backgroundColor: isSelected ? 'rgba(115, 242, 24, 0.15)' : 'rgba(255,255,255,0.04)',
                        borderWidth: 1,
                        borderColor: isSelected ? '#73f218' : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Image
                          source={{ uri: c.flagUrl }}
                          style={{ width: 28, height: 20, borderRadius: 4, resizeMode: 'cover', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                        />
                        <View>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{c.name}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{c.code} ({c.symbol.trim()})</Text>
                        </View>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color="#73f218" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM CALENDAR PICKER MODAL ─── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={calendarVisible}
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.calendarBackdrop}>
          <View style={styles.calendarSheet}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => changeCalMonth('prev')} style={styles.arrowBtn}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
                {monthsList[calMonth]} {calYear}
              </Text>
              <TouchableOpacity onPress={() => changeCalMonth('next')} style={styles.arrowBtn}>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Weekdays Labels */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, i) => (
                <Text key={i} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', width: CELL_WIDTH, textAlign: 'center' }}>
                  {wd}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 0, justifyContent: 'flex-start' }}>
              {calendarCells.map((cell) => {
                if (cell.day === null) {
                  return (
                    <View key={cell.id} style={{ width: CELL_WIDTH, height: 40 }} />
                  );
                }
                const isSelected = cell.day === calSelectedDay;
                const isExpense = calendarTarget === 'expense';
                const highlightColor = isExpense ? '#ef4444' : '#73f218';
                const textHighlightColor = isExpense ? '#fff' : '#0f172a';
                
                return (
                  <TouchableOpacity
                    key={cell.id}
                    onPress={() => cell.day && handleSelectCalendarDay(cell.day)}
                    style={{
                      width: CELL_WIDTH, height: 40, alignItems: 'center', justifyContent: 'center',
                      borderRadius: 10,
                      backgroundColor: isSelected ? highlightColor : 'transparent'
                    }}
                  >
                    <Text style={{
                      color: isSelected ? textHighlightColor : '#fff',
                      fontSize: 13,
                      fontWeight: isSelected ? '900' : '600'
                    }}>
                      {cell.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setCalendarVisible(false)}
              style={{ marginTop: 20, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Close Picker</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  radialGlow1: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#73f218',
    opacity: 0.07,
  },
  radialGlow2: {
    position: 'absolute',
    bottom: 50,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#3b82f6',
    opacity: 0.05,
  },
  headerContainer: {
    backgroundColor: '#0a101f',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  arrowBtn: {
    padding: 6,
  },
  monthText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
  },
  topShortcuts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(115, 242, 24, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  shortcutText: {
    color: '#73f218',
    fontSize: 10,
    fontWeight: '800',
  },
  iconShortcut: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 14,
    padding: 3,
    marginTop: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  subTabActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  subTabText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
  },
  subTabActiveText: {
    color: '#73f218',
  },
  overviewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridCell: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  blockTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    marginTop: 24,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 16,
  },
  actionBtnText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '900',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  alertText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  catMiniLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  catMiniValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  catActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insightLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
  },
  insightValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  billCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  calendarBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    zIndex: 99999,
    elevation: 99999,
  },
  calendarSheet: {
    width: Math.min(width - 32, 340),
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 15,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    zIndex: 9999,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#73f218',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
});
