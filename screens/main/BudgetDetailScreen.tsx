import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, Platform, Dimensions, TextInput, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../../context/CurrencyContext';
import { useTransactions } from '../../context/TransactionContext';

const { width, height } = Dimensions.get('window');

// ── Circular Progress Ring ─────────────────────────────────────────────────────
const CircularProgress = ({ pct, size = 150, stroke = 11, color = '#73f218' }: any) => {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ring */}
      <View style={{
        position: 'absolute',
        width: size, height: size, borderRadius: size / 2,
        borderWidth: stroke, borderColor: 'rgba(255,255,255,0.08)',
      }} />
      {/* Foreground ring segments */}
      <View style={{
        position: 'absolute',
        width: size, height: size, borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: 'transparent',
        borderTopColor: color,
        borderRightColor: pct > 25 ? color : 'transparent',
        borderBottomColor: pct > 50 ? color : 'transparent',
        borderLeftColor: pct > 75 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
      {/* Center */}
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1 }}>{pct}%</Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' }}>used</Text>
      </View>
    </View>
  );
};

// ── Category Row ───────────────────────────────────────────────────────────────
const CategoryRow = ({ icon, label, spent, budget, color, currencySymbol = '$', onPress }: any) => {
  const pct = Math.min(Math.round((spent / budget) * 100), 100);
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 18, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: color + '22',
          alignItems: 'center', justifyContent: 'center', marginRight: 12,
        }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{label}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 }}>
            {currencySymbol}{spent.toLocaleString()} of {currencySymbol}{budget.toLocaleString()}
          </Text>
        </View>
        <View style={{
          backgroundColor: pct > 80 ? 'rgba(239,68,68,0.2)' : 'rgba(115,242,24,0.15)',
          borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
        }}>
          <Text style={{ color: pct > 80 ? '#ef4444' : '#73f218', fontWeight: '800', fontSize: 12 }}>
            {pct}%
          </Text>
        </View>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' }}>
        <View style={{
          height: 5, borderRadius: 3,
          backgroundColor: pct > 80 ? '#ef4444' : color,
          width: `${pct}%` as any,
        }} />
      </View>
    </TouchableOpacity>
  );
};

// Category Map definitions
const categoryMap: any = {
  'Housing': { icon: 'home-outline', color: '#14b8a6' },
  'Transport': { icon: 'car-outline', color: '#6366f1' },
  'Entertainment': { icon: 'game-controller-outline', color: '#ec4899' },
  'Food & Dining': { icon: 'fast-food-outline', color: '#f59e0b' },
  'Health': { icon: 'medkit-outline', color: '#73f218' },
  'Utilities': { icon: 'flash-outline', color: '#3b82f6' }
};

// ── Main Screen ────────────────────────────────────────────────────────────────
export function BudgetDetailScreen({ navigation }: any) {
  const { currency, formatAmount } = useCurrency();
  const { transactions: rawTransactions, totalIncome: ctxTotalIncome, totalExpenses: ctxTotalExpenses } = useTransactions();
  const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'recurring'>('overview');

  // Income Lists (Clean Empty Default)
  const [fixedIncome, setFixedIncome] = useState<any[]>([]);
  const [variableIncome, setVariableIncome] = useState<any[]>([]);

  // Recurring Expenses (Clean Empty Default)
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);

  React.useEffect(() => {
    if (rawTransactions && rawTransactions.length > 0) {
      const fixed = rawTransactions.filter(t => t.isIncome && ((t as any).frequency === 'Monthly' || (t as any).frequency === 'Weekly'));
      const variable = rawTransactions.filter(t => t.isIncome && (!(t as any).frequency || (t as any).frequency === 'One-off'));
      const recurring = rawTransactions.filter(t => !t.isIncome && (t as any).frequency && (t as any).frequency !== 'One-off');
      if (fixed.length > 0) setFixedIncome(fixed);
      if (variable.length > 0) setVariableIncome(variable);
      if (recurring.length > 0) setRecurringExpenses(recurring);
    }
  }, [rawTransactions]);

  // Overview math
  const budgetSpent = ctxTotalExpenses;
  const budgetLimit = budgetSpent > 0 ? Math.ceil(budgetSpent * 1.25 / 100) * 100 : 0;
  const budgetPct = budgetLimit > 0 ? Math.min(100, Math.round((budgetSpent / budgetLimit) * 100)) : 0;
  const remaining = Math.max(0, budgetLimit - budgetSpent);

  // Dynamic Income sums
  const totalFixedIncome = fixedIncome.reduce((acc, curr) => acc + curr.amount, 0);
  const totalVarIncome = variableIncome.reduce((acc, curr) => acc + curr.amount, 0);
  const totalIncome = totalFixedIncome + totalVarIncome;

  // Dynamic Recurring Expenses sum
  const totalRecurringExpenses = recurringExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Modals state
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);

  // Forms fields
  const [incTitle, setIncTitle] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incType, setIncType] = useState<'fixed' | 'variable'>('fixed');
  const [incFreq, setIncFreq] = useState('Monthly');

  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Housing');
  const [expFreq, setExpFreq] = useState('Monthly');

  const categories = [
    { icon: 'fast-food-outline',       label: 'Food & Dining',   spent: 620, budget: 700,  color: '#f59e0b' },
    { icon: 'car-outline',             label: 'Transport',       spent: 310, budget: 400,  color: '#6366f1' },
    { icon: 'game-controller-outline', label: 'Entertainment',   spent: 280, budget: 300,  color: '#ec4899' },
    { icon: 'home-outline',            label: 'Housing',         spent: 450, budget: 500,  color: '#14b8a6' },
    { icon: 'medkit-outline',          label: 'Health',          spent: 187, budget: 350,  color: '#73f218' },
  ];

  const handleAddIncome = () => {
    if (!incTitle || !incAmount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const val = parseFloat(incAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const newItem = {
      id: 'inc-' + Date.now(),
      title: incTitle,
      amount: val,
      date: 'Today',
      frequency: incFreq
    };

    if (incType === 'fixed') {
      setFixedIncome([newItem, ...fixedIncome]);
    } else {
      setVariableIncome([newItem, ...variableIncome]);
    }

    setIncTitle('');
    setIncAmount('');
    setIncType('fixed');
    setIncFreq('Monthly');
    setIncomeModalVisible(false);
  };

  const handleAddExpense = () => {
    if (!expTitle || !expAmount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const val = parseFloat(expAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const config = categoryMap[expCategory] || { icon: 'wallet-outline', color: '#64748b' };
    const newItem = {
      id: 'exp-' + Date.now(),
      title: expTitle,
      amount: val,
      frequency: expFreq,
      category: expCategory,
      icon: config.icon,
      color: config.color
    };

    setRecurringExpenses([newItem, ...recurringExpenses]);

    setExpTitle('');
    setExpAmount('');
    setExpCategory('Housing');
    setExpFreq('Monthly');
    setExpenseModalVisible(false);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }}>
      <StatusBar barStyle="light-content" />

      {/* Tap overlay to dismiss */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        activeOpacity={1}
        onPress={() => navigation.goBack()}
      />

      {/* ── Budget Details Sheet ── */}
      <LinearGradient
        colors={['#162035', '#0f172a', '#0d1a0d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          height: height * 0.94,
          overflow: 'hidden',
        }}
      >
        {/* Decorative glow orbs */}
        <View style={{ position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: '#73f218', opacity: 0.07 }} />
        <View style={{ position: 'absolute', bottom: -40, left: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: '#3b82f6', opacity: 0.06 }} />

        {/* Drag Handle */}
        <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </View>

        {/* Header row */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20,
        }}>
          <View>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.3 }}>Monthly Budget</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3 }}>July 2026</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
            }}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Segmented Control Selector */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 20,
          marginHorizontal: 16,
          padding: 4,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
        }}>
          {['Overview', 'Income', 'Recurring'].map((tab) => {
            const isSelected = activeTab === tab.toLowerCase();
            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.9}
                onPress={() => setActiveTab(tab.toLowerCase() as any)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                  borderRadius: 16,
                }}
              >
                <Text style={{
                  color: isSelected ? '#73f218' : 'rgba(255,255,255,0.45)',
                  fontSize: 13,
                  fontWeight: '800',
                }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
        >
          {/* ─── TAB 1: OVERVIEW ─── */}
          {activeTab === 'overview' && (
            <View>
              {/* Overview Card */}
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 24, padding: 24, marginBottom: 20,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <CircularProgress pct={budgetPct} color={budgetPct > 80 ? '#ef4444' : '#73f218'} />

                  <View style={{ flex: 1, paddingLeft: 22 }}>
                    <View style={{ marginBottom: 18 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Spent</Text>
                      <Text style={{ color: '#ef4444', fontSize: 20, fontWeight: '900', marginTop: 3 }}>
                        {formatAmount(budgetSpent)}
                      </Text>
                    </View>
                    <View style={{ marginBottom: 18 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Remaining</Text>
                      <Text style={{ color: '#73f218', fontSize: 20, fontWeight: '900', marginTop: 3 }}>
                        {formatAmount(remaining)}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Total Budget</Text>
                      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 3 }}>
                        {formatAmount(budgetLimit)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={{ marginTop: 20 }}>
                  <View style={{ height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <View style={{
                      height: 7, borderRadius: 4,
                      backgroundColor: budgetPct > 80 ? '#ef4444' : '#73f218',
                      width: `${budgetPct}%` as any,
                    }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{currency.symbol}0</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{formatAmount(budgetLimit)}</Text>
                  </View>
                </View>
              </View>

              {/* Quick Stats Row */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                {[
                  { label: 'Daily Avg',  value: `${currency.symbol}61`, icon: 'calendar-outline', color: '#6366f1' },
                  { label: 'Days Left',  value: '24',   icon: 'time-outline', color: '#f59e0b' },
                  { label: 'On Track',   value: budgetPct <= 70 ? 'Yes ✓' : 'At Risk', icon: 'trending-up-outline', color: budgetPct <= 70 ? '#73f218' : '#ef4444' },
                ].map((stat, i) => (
                  <View key={i} style={{
                    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 18, padding: 14, alignItems: 'center',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                  }}>
                    <View style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: stat.color + '20',
                      alignItems: 'center', justifyContent: 'center', marginBottom: 8,
                    }}>
                      <Ionicons name={stat.icon as any} size={15} color={stat.color} />
                    </View>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{stat.value}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2, fontWeight: '600' }}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {/* Category Breakdown */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 }}>By Category</Text>
                <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Budget')}>
                  <Text style={{ color: '#73f218', fontWeight: '800', fontSize: 13 }}>Manage</Text>
                </TouchableOpacity>
              </View>
              {categories.map((cat, i) => (
                <CategoryRow
                  key={i}
                  {...cat}
                  currencySymbol={currency.symbol}
                  onPress={() => navigation.navigate('BudgetCategoryDetail', { category: cat })}
                />
              ))}
            </View>
          )}

          {/* ─── TAB 2: INCOME (FIXED & VARIABLE) ─── */}
          {activeTab === 'income' && (
            <View>
              {/* Aggregated Income Card */}
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 24, padding: 20, marginBottom: 24,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>ESTIMATED TOTAL INCOME</Text>
                <Text style={{ color: '#73f218', fontSize: 32, fontWeight: '900', marginTop: 6 }}>
                  {formatAmount(totalIncome)}
                </Text>
                
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16 }} />
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1' }} />
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600' }}>Fixed / Salary</Text>
                    </View>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4 }}>
                      {formatAmount(totalFixedIncome)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)', paddingLeft: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#a855f7' }} />
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600' }}>Variable / Gifts</Text>
                    </View>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4 }}>
                      {formatAmount(totalVarIncome)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Fixed Income List */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, marginBottom: 12, letterSpacing: 0.2 }}>Fixed Recurring Salaries</Text>
                {fixedIncome.length === 0 ? (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderStyle: 'dashed', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 16, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No fixed income set up</Text>
                  </View>
                ) : (
                  fixedIncome.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      onPress={() => navigation.navigate('IncomeDetail', { income: { ...item, type: 'fixed' } })}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, marginBottom: 10,
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(99, 102, 241, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="card-outline" size={18} color="#818cf8" />
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{item.title}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2, fontWeight: '500' }}>{item.date}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={{ color: '#73f218', fontWeight: '800', fontSize: 14 }}>+{formatAmount(item.amount)}</Text>
                        <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ color: '#818cf8', fontSize: 9, fontWeight: '700' }}>{item.frequency}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* Variable Income List */}
              <View style={{ marginBottom: 30 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, marginBottom: 12, letterSpacing: 0.2 }}>Variable / Extra Income</Text>
                {variableIncome.length === 0 ? (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderStyle: 'dashed', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 16, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No extra income logged yet</Text>
                  </View>
                ) : (
                  variableIncome.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      onPress={() => navigation.navigate('IncomeDetail', { income: { ...item, type: 'variable' } })}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, marginBottom: 10,
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(168, 85, 247, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="gift-outline" size={18} color="#c084fc" />
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{item.title}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2, fontWeight: '500' }}>{item.date}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={{ color: '#73f218', fontWeight: '800', fontSize: 14 }}>+{formatAmount(item.amount)}</Text>
                        <View style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ color: '#c084fc', fontSize: 9, fontWeight: '700' }}>One-off</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* Add Income Button */}
              <TouchableOpacity
                onPress={() => setIncomeModalVisible(true)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#73f218',
                  paddingVertical: 15,
                  borderRadius: 16,
                  alignItems: 'center',
                  shadowColor: '#73f218',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                }}
              >
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Add Income Source</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── TAB 3: RECURRING EXPENSES (FIXED EXPENSES) ─── */}
          {activeTab === 'recurring' && (
            <View>
              {/* Aggregated Recurring Expenses Card */}
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 24, padding: 20, marginBottom: 24,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>TOTAL FIXED EXPENSES</Text>
                <Text style={{ color: '#ef4444', fontSize: 32, fontWeight: '900', marginTop: 6 }}>
                  {formatAmount(totalRecurringExpenses)}
                  <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}> / month</Text>
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 8, lineHeight: 16 }}>
                  These fixed expenses are entered once and automatically deducted/forecasted from your budget limit every cycle.
                </Text>
              </View>

              {/* List of Recurring Expenses */}
              <View style={{ marginBottom: 30 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, marginBottom: 12, letterSpacing: 0.2 }}>Active Subscriptions & Rent</Text>
                {recurringExpenses.length === 0 ? (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderStyle: 'dashed', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 16, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No fixed expenses set up</Text>
                  </View>
                ) : (
                  recurringExpenses.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      onPress={() => navigation.navigate('RecurringDetail', { expense: item })}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, marginBottom: 10,
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: item.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={item.icon as any} size={18} color={item.color} />
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{item.title}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2, fontWeight: '500' }}>{item.category}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 14 }}>-{formatAmount(item.amount)}</Text>
                        <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ color: '#f87171', fontSize: 9, fontWeight: '700' }}>{item.frequency}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* Add Expense Button */}
              <TouchableOpacity
                onPress={() => setExpenseModalVisible(true)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#6366f1',
                  paddingVertical: 15,
                  borderRadius: 16,
                  alignItems: 'center',
                  shadowColor: '#6366f1',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Add Recurring Expense</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </LinearGradient>

      {/* ─── MODAL: ADD INCOME ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={incomeModalVisible}
        onRequestClose={() => setIncomeModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <View style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Add Income</Text>
              <TouchableOpacity onPress={() => setIncomeModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Income Type Selector */}
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>INCOME TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIncType('fixed')}
                style={{
                  flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1,
                  backgroundColor: incType === 'fixed' ? 'rgba(115,242,24,0.1)' : 'rgba(255,255,255,0.03)',
                  borderColor: incType === 'fixed' ? '#73f218' : 'rgba(255,255,255,0.06)'
                }}
              >
                <Text style={{ color: incType === 'fixed' ? '#73f218' : '#94a3b8', fontSize: 12, fontWeight: '800' }}>Fixed / Salary</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIncType('variable')}
                style={{
                  flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1,
                  backgroundColor: incType === 'variable' ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.03)',
                  borderColor: incType === 'variable' ? '#c084fc' : 'rgba(255,255,255,0.06)'
                }}
              >
                <Text style={{ color: incType === 'variable' ? '#c084fc' : '#94a3b8', fontSize: 12, fontWeight: '800' }}>Variable / One-off</Text>
              </TouchableOpacity>
            </View>

            {/* Title input */}
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>TITLE</Text>
            <TextInput
              value={incTitle}
              onChangeText={setIncTitle}
              placeholder="e.g. Monthly Salary or Cash Gift"
              placeholderTextColor="#475569"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 16 }}
            />

            {/* Amount input */}
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>AMOUNT ($)</Text>
            <TextInput
              value={incAmount}
              onChangeText={setIncAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#475569"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 16 }}
            />

            {/* Frequency Selection (Only visible if Fixed) */}
            {incType === 'fixed' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>FREQUENCY</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['Weekly', 'Bi-weekly', 'Monthly'].map((freq) => {
                    const isSel = incFreq === freq;
                    return (
                      <TouchableOpacity
                        key={freq}
                        activeOpacity={0.8}
                        onPress={() => setIncFreq(freq)}
                        style={{
                          flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1,
                          backgroundColor: isSel ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                          borderColor: isSel ? '#6366f1' : 'rgba(255,255,255,0.06)'
                        }}
                      >
                        <Text style={{ color: isSel ? '#818cf8' : '#94a3b8', fontSize: 11, fontWeight: '800' }}>{freq}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Action buttons */}
            <TouchableOpacity
              onPress={handleAddIncome}
              activeOpacity={0.85}
              style={{ backgroundColor: '#73f218', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 10 }}
            >
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Save Income</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ADD FIXED EXPENSE ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={expenseModalVisible}
        onRequestClose={() => setExpenseModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <View style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Add Recurring Expense</Text>
              <TouchableOpacity onPress={() => setExpenseModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>TITLE</Text>
            <TextInput
              value={expTitle}
              onChangeText={setExpTitle}
              placeholder="e.g. Gym Membership or Netflix"
              placeholderTextColor="#475569"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 16 }}
            />

            {/* Amount */}
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>AMOUNT ($)</Text>
            <TextInput
              value={expAmount}
              onChangeText={setExpAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#475569"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 16 }}
            />

            {/* Category selection */}
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>CATEGORY</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {Object.keys(categoryMap).map((cat) => {
                const isSel = expCategory === cat;
                const config = categoryMap[cat];
                return (
                  <TouchableOpacity
                    key={cat}
                    activeOpacity={0.8}
                    onPress={() => setExpCategory(cat)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      backgroundColor: isSel ? config.color + '25' : 'rgba(255,255,255,0.03)',
                      borderColor: isSel ? config.color : 'rgba(255,255,255,0.06)'
                    }}
                  >
                    <Ionicons name={config.icon} size={13} color={isSel ? config.color : '#94a3b8'} />
                    <Text style={{ color: isSel ? config.color : '#94a3b8', fontSize: 11, fontWeight: '800' }}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Frequency Selector */}
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>BILL CYCLE</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {['Weekly', 'Bi-weekly', 'Monthly', 'Yearly'].map((freq) => {
                const isSel = expFreq === freq;
                return (
                  <TouchableOpacity
                    key={freq}
                    activeOpacity={0.8}
                    onPress={() => setExpFreq(freq)}
                    style={{
                      flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1,
                      backgroundColor: isSel ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                      borderColor: isSel ? '#6366f1' : 'rgba(255,255,255,0.06)'
                    }}
                  >
                    <Text style={{ color: isSel ? '#818cf8' : '#94a3b8', fontSize: 11, fontWeight: '800' }}>{freq}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Button */}
            <TouchableOpacity
              onPress={handleAddExpense}
              activeOpacity={0.85}
              style={{ backgroundColor: '#6366f1', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 10 }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Save Recurring Expense</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

