import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, TextInput, Modal, Alert, StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

import Svg, { Circle } from 'react-native-svg';

// ── Circular Progress Ring ─────────────────────────────────────────────────────
const CircularProgress = ({ pct, size = 160, stroke = 12, color = '#73f218' }: any) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(100, Math.max(0, pct))) / 100;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>{pct}%</Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>used</Text>
      </View>
    </View>
  );
};

import { useCurrency } from '../../context/CurrencyContext';
import { useTransactions } from '../../context/TransactionContext';

// ── Transaction Item ───────────────────────────────────────────────────────────
const TransactionRow = ({ title, date, amount, icon, color }: any) => {
  const { formatAmount } = useCurrency();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, marginBottom: 8,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 12,
          backgroundColor: color + '15',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>{date}</Text>
        </View>
      </View>
      <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 14 }}>-{formatAmount(parseFloat(amount))}</Text>
    </View>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export function BudgetCategoryDetailScreen({ navigation, route }: any) {
  const { currency, formatAmount } = useCurrency();
  const categoryData = route?.params?.category ?? {
    label: 'Food & Dining', icon: 'fast-food-outline', spent: 620, budget: 700, color: '#f59e0b'
  };

  // Base state hookups
  const [spent, setSpent] = useState<number>(categoryData.spent);
  const [budget, setBudget] = useState<number>(categoryData.budget);
  
  // Modals state
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [txModalVisible, setTxModalVisible] = useState(false);

  // Forms fields
  const [newBudgetInput, setNewBudgetInput] = useState(budget.toString());
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');

  const { transactions: rawTransactions } = useTransactions();
  const initialTransactions = useMemo(() => {
    const lbl = (categoryData.label || '').toLowerCase();
    const c = categoryData.color || '#73f218';
    const matches = rawTransactions.filter(t => t.category && t.category.toLowerCase().includes(lbl));
    return matches.map(t => ({
      id: t.id,
      title: t.title,
      date: t.date,
      amount: t.amount.toString(),
      icon: t.icon || categoryData.icon || 'card-outline',
      color: c
    }));
  }, [rawTransactions, categoryData.label, categoryData.color, categoryData.icon]);

  const [transactions, setTransactions] = useState(initialTransactions);

  // Derived math
  const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
  const remaining = Math.max(0, budget - spent);
  const isOverBudget = budget > 0 && spent > budget;
  
  // Dynamic Month Analytics
  const now = new Date();
  const daysElapsed = Math.max(1, now.getDate());
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const dailyAverage = useMemo(() => {
    return (spent / daysElapsed).toFixed(2);
  }, [spent, daysElapsed]);

  const projectedSpend = useMemo(() => {
    return ((spent / daysElapsed) * totalDaysInMonth).toFixed(2);
  }, [spent, daysElapsed, totalDaysInMonth]);

  const handleQuickAdjust = (amount: number) => {
    const updated = Math.max(10, budget + amount);
    setBudget(updated);
    setNewBudgetInput(updated.toString());
  };

  const handleSaveBudgetInput = () => {
    const val = parseFloat(newBudgetInput);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Budget', 'Please enter a valid positive number.');
      return;
    }
    setBudget(val);
    setAdjustModalVisible(false);
  };

  const handleAddTransaction = () => {
    if (!txTitle || !txAmount) {
      Alert.alert('Missing Info', 'Please fill in both the title and amount.');
      return;
    }
    const val = parseFloat(txAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number for amount.');
      return;
    }

    const newTx = {
      id: 'tx-' + Date.now(),
      title: txTitle,
      date: 'Just Now',
      amount: val.toString(),
      icon: categoryData.icon,
      color: categoryData.color
    };

    setTransactions([newTx, ...transactions]);
    setSpent(prev => prev + val);
    setTxTitle('');
    setTxAmount('');
    setTxModalVisible(false);
  };

  const handleDeleteAlert = () => {
    Alert.alert(
      'Remove Budget Category',
      `Are you sure you want to stop tracking budget for ${categoryData.label}? This will reset limits.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => navigation.goBack() }
      ]
    );
  };

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }}>
      <StatusBar barStyle="light-content" />

      {/* Dismiss backdrop */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        activeOpacity={1}
        onPress={() => navigation.goBack()}
      />

      {/* Screen sheet container */}
      <LinearGradient
        colors={['#162035', '#0f172a', '#0d1a0d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sheetContainer}
      >
        {/* Glow orbs matched to category color */}
        <View style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: 100,
          backgroundColor: categoryData.color, opacity: 0.12
        }} />
        <View style={{
          position: 'absolute', bottom: -50, left: -30,
          width: 160, height: 160, borderRadius: 80,
          backgroundColor: '#3b82f6', opacity: 0.05
        }} />

        {/* Drag Indicator */}
        <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        </View>

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: categoryData.color + '20',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: categoryData.color + '30'
            }}>
              <Ionicons name={categoryData.icon} size={22} color={categoryData.color} />
            </View>
            <View>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.2 }}>
                {categoryData.label}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2, fontWeight: '600' }}>
                Budget Category Breakdown
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
        >
          {/* Circular Gauge Card */}
          <View style={styles.cardContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <CircularProgress pct={pct} color={isOverBudget ? '#ef4444' : categoryData.color} />

              <View style={{ flex: 1, paddingLeft: 24 }}>
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.statLabel}>Spent</Text>
                  <Text style={{ color: isOverBudget ? '#ef4444' : '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 }}>
                    ${spent.toLocaleString()}
                  </Text>
                </View>
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.statLabel}>Remaining</Text>
                  <Text style={{ color: remaining < 0 ? '#ef4444' : '#73f218', fontSize: 22, fontWeight: '900', marginTop: 2 }}>
                    {remaining < 0 ? `-$${Math.abs(remaining).toLocaleString()}` : `$${remaining.toLocaleString()}`}
                  </Text>
                </View>
                <View>
                  <Text style={styles.statLabel}>Budget Limit</Text>
                  <TouchableOpacity
                    onPress={() => setAdjustModalVisible(true)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}
                  >
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: '900' }}>
                      ${budget.toLocaleString()}
                    </Text>
                    <Ionicons name="create-outline" size={16} color={categoryData.color} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Horizontal Progress Bar */}
            <View style={{ marginTop: 20 }}>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{
                  height: 7, borderRadius: 4,
                  backgroundColor: isOverBudget ? '#ef4444' : categoryData.color,
                  width: `${pct}%` as any,
                }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>$0</Text>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>${budget.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Quick Adjustment Widgets */}
          <View style={{ marginBottom: 24 }}>
            <Text style={styles.sectionTitle}>Quick Adjust Limit</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[-50, -10, 10, 50].map((adj) => (
                <TouchableOpacity
                  key={adj}
                  activeOpacity={0.8}
                  onPress={() => handleQuickAdjust(adj)}
                  style={[styles.adjBtn, { borderColor: categoryData.color + '20' }]}
                >
                  <Text style={{ color: adj > 0 ? '#73f218' : '#ef4444', fontWeight: '800', fontSize: 12 }}>
                    {adj > 0 ? `+ $${adj}` : `- $${Math.abs(adj)}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Analytics & Projected Spend Card */}
          <View style={styles.cardContainer}>
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 14 }]}>Monthly Insights</Text>
            <View style={{ gap: 14 }}>
              <View style={styles.insightRow}>
                <View>
                  <Text style={styles.insightLabel}>Daily Average</Text>
                  <Text style={styles.insightValue}>${dailyAverage} / day</Text>
                </View>
                <Ionicons name="calculator-outline" size={18} color="rgba(255,255,255,0.4)" />
              </View>
              <View style={styles.insightRow}>
                <View>
                  <Text style={styles.insightLabel}>Projected Month-End Spend</Text>
                  <Text style={[styles.insightValue, { color: parseFloat(projectedSpend) > budget ? '#ef4444' : '#fff' }]}>
                    ${projectedSpend}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: parseFloat(projectedSpend) > budget ? 'rgba(239, 68, 68, 0.15)' : 'rgba(115,242,24,0.15)',
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8
                }}>
                  <Text style={{
                    color: parseFloat(projectedSpend) > budget ? '#ef4444' : '#73f218',
                    fontSize: 10, fontWeight: '800'
                  }}>
                    {parseFloat(projectedSpend) > budget ? 'Over Limit' : 'On Track'}
                  </Text>
                </View>
              </View>
              <View style={styles.insightRow}>
                <View>
                  <Text style={styles.insightLabel}>Total Transactions</Text>
                  <Text style={styles.insightValue}>{transactions.length} payments</Text>
                </View>
                <Ionicons name="receipt-outline" size={18} color="rgba(255,255,255,0.4)" />
              </View>
            </View>
          </View>

          {/* Transactions Header & Feed */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            <TouchableOpacity
              onPress={() => setTxModalVisible(true)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10
              }}
            >
              <Ionicons name="add" size={14} color="#73f218" />
              <Text style={{ color: '#73f218', fontWeight: '800', fontSize: 11 }}>Add Tx</Text>
            </TouchableOpacity>
          </View>

          {transactions.map((tx) => (
            <TransactionRow key={tx.id} {...tx} />
          ))}

          {/* Delete Category Button */}
          <TouchableOpacity
            onPress={handleDeleteAlert}
            activeOpacity={0.8}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 13 }}>Remove Budget Goal</Text>
          </TouchableOpacity>

        </ScrollView>
      </LinearGradient>

      {/* ─── MODAL: ADJUST BUDGET LIMIT ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={adjustModalVisible}
        onRequestClose={() => setAdjustModalVisible(false)}
        statusBarTranslucent
      >
        <View style={{
          position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: Platform.OS === 'web' ? ('100vw' as any) : '100%',
          height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
          justifyContent: 'flex-end',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 99999,
        }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setAdjustModalVisible(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', maxWidth: 500, alignSelf: 'center' }}
          >
            <View style={styles.modalContent}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={styles.modalTitle}>Set Budget Limit</Text>
                <TouchableOpacity onPress={() => setAdjustModalVisible(false)}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>BUDGET LIMIT FOR {categoryData.label.toUpperCase()} ($)</Text>
              <TextInput
                value={newBudgetInput}
                onChangeText={setNewBudgetInput}
                keyboardType="decimal-pad"
                autoFocus
                placeholder="e.g. 500"
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              <TouchableOpacity
                onPress={handleSaveBudgetInput}
                activeOpacity={0.85}
                style={[styles.saveBtn, { backgroundColor: categoryData.color }]}
              >
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Apply Limit</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── MODAL: ADD TRANSACTION ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={txModalVisible}
        onRequestClose={() => setTxModalVisible(false)}
        statusBarTranslucent
      >
        <View style={{
          position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: Platform.OS === 'web' ? ('100vw' as any) : '100%',
          height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
          justifyContent: 'flex-end',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 99999,
        }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setTxModalVisible(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', maxWidth: 500, alignSelf: 'center' }}
          >
            <View style={styles.modalContent}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={styles.modalTitle}>Add {categoryData.label} Transaction</Text>
                <TouchableOpacity onPress={() => setTxModalVisible(false)}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>TRANSACTION DESCRIPTION</Text>
              <TextInput
                value={txTitle}
                onChangeText={setTxTitle}
                placeholder="e.g. Starbucks, Grocery Store"
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              <Text style={styles.inputLabel}>AMOUNT ($)</Text>
              <TextInput
                value={txAmount}
                onChangeText={setTxAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#475569"
                style={styles.modalInput}
              />

              <TouchableOpacity
                onPress={handleAddTransaction}
                activeOpacity={0.85}
                style={[styles.saveBtn, { backgroundColor: categoryData.color }]}
              >
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Add Payment</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: height * 0.94,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  adjBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insightLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '600',
  },
  insightValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 20,
    marginBottom: 20,
  },
  modalContent: {
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
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
});
