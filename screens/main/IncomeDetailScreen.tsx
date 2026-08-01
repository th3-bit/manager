import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, TextInput, Modal, Alert, StyleSheet, Switch, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTransactions } from '../../context/TransactionContext';

const { width, height } = Dimensions.get('window');

// ── Transaction Item ───────────────────────────────────────────────────────────
const HistoryRow = ({ date, amount, typeLabel, icon, color }: any) => (
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
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{typeLabel}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>{date}</Text>
      </View>
    </View>
    <Text style={{ color: '#73f218', fontWeight: '800', fontSize: 14 }}>+${parseFloat(amount).toLocaleString()}</Text>
  </View>
);

// ── Main Component ─────────────────────────────────────────────────────────────
export function IncomeDetailScreen({ navigation, route }: any) {
  const { deleteTransaction } = useTransactions();
  const incomeData = route?.params?.income ?? {
    id: 'fi-1', title: 'Monthly Salary', amount: 3500, frequency: 'Monthly', date: 'Jul 1, 2026', type: 'fixed'
  };

  const isFixed = incomeData.type === 'fixed';
  const themeColor = '#73f218'; // Cashflow green

  // Base state hookups
  const [amount, setAmount] = useState<number>(incomeData.amount);
  const [isActive, setIsActive] = useState<boolean>(true);
  
  // Modals state
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [newAmountInput, setNewAmountInput] = useState(amount.toString());

  // Dynamic percentage based on hardcoded total budget limit $2500 or income total $4900
  // Let's assume total income is $4900 as shown in the screenshot
  const contributionPercentage = useMemo(() => {
    return ((amount / 4900) * 100).toFixed(1);
  }, [amount]);

  // Projected Annual yield
  const annualProjected = useMemo(() => {
    if (!isActive) return '0';
    if (isFixed) {
      return (amount * 12).toLocaleString();
    }
    // For variable, estimate based on current one-off
    return (amount * 4).toLocaleString(); // assume quarterly occurrences
  }, [amount, isFixed, isActive]);

  // Initial mock deposits history
  const historyList = useMemo(() => {
    const iconName = isFixed ? 'card-outline' : 'gift-outline';
    const c = isFixed ? '#818cf8' : '#c084fc';
    if (isFixed) {
      return [
        { id: '1', date: 'Jul 01, 2026', amount: amount.toString(), typeLabel: 'Direct Deposit', icon: iconName, color: c },
        { id: '2', date: 'Jun 01, 2026', amount: amount.toString(), typeLabel: 'Direct Deposit', icon: iconName, color: c },
        { id: '3', date: 'May 01, 2026', amount: amount.toString(), typeLabel: 'Direct Deposit', icon: iconName, color: c }
      ];
    } else {
      return [
        { id: '1', date: incomeData.date === 'Today' ? 'Jul 16, 2026' : incomeData.date, amount: amount.toString(), typeLabel: 'Cleared Transfer', icon: iconName, color: c },
        { id: '2', date: 'Jun 14, 2026', amount: (amount * 0.8).toString(), typeLabel: 'Cleared Transfer', icon: iconName, color: c }
      ];
    }
  }, [amount, isFixed, incomeData.date]);

  const handleQuickAdjust = (val: number) => {
    const updated = Math.max(0, amount + val);
    setAmount(updated);
    setNewAmountInput(updated.toString());
  };

  const handleSaveAmountInput = () => {
    const val = parseFloat(newAmountInput);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number.');
      return;
    }
    setAmount(val);
    setAdjustModalVisible(false);
  };

  const handleDeleteAlert = () => {
    Alert.alert(
      'Remove Income Source',
      `Are you sure you want to delete ${incomeData.title}? This will update your total earnings metrics.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            if (incomeData.id) deleteTransaction(incomeData.id);
            navigation.goBack();
          } 
        }
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

      {/* Sheet view */}
      <LinearGradient
        colors={['#162035', '#0f172a', '#0a1d0d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sheetContainer}
      >
        {/* Glow orb matched to green theme */}
        <View style={{
          position: 'absolute', top: -45, right: -45,
          width: 210, height: 210, borderRadius: 105,
          backgroundColor: themeColor, opacity: 0.1
        }} />
        <View style={{
          position: 'absolute', bottom: -50, left: -30,
          width: 150, height: 150, borderRadius: 75,
          backgroundColor: '#3b82f6', opacity: 0.04
        }} />

        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        </View>

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: (isFixed ? '#818cf8' : '#c084fc') + '20',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: (isFixed ? '#818cf8' : '#c084fc') + '30'
            }}>
              <Ionicons name={isFixed ? 'card-outline' : 'gift-outline'} size={22} color={isFixed ? '#818cf8' : '#c084fc'} />
            </View>
            <View>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.2 }}>
                {incomeData.title}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2, fontWeight: '600' }}>
                {isFixed ? 'Fixed Recurring Salary' : 'Variable Extra Income'}
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
          {/* Amount Card */}
          <View style={styles.cardContainer}>
            <View style={{ alignItems: 'center', marginVertical: 14 }}>
              <Text style={styles.depositTitle}>ESTIMATED DEPOSIT</Text>
              
              <TouchableOpacity
                onPress={() => setAdjustModalVisible(true)}
                activeOpacity={0.7}
                style={styles.amountDisplayContainer}
              >
                <Text style={styles.amountText}>
                  +${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Ionicons name="create-outline" size={18} color={themeColor} style={{ marginTop: 6 }} />
              </TouchableOpacity>

              <View style={[styles.badge, { backgroundColor: isFixed ? 'rgba(129, 138, 248, 0.15)' : 'rgba(192, 132, 252, 0.15)' }]}>
                <Text style={{ color: isFixed ? '#818cf8' : '#c084fc', fontWeight: '800', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {incomeData.frequency} Cycle
                </Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 16 }} />

            {/* Quick Metrics */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.subStatLabel}>Contribution</Text>
                <Text style={styles.subStatValue}>{contributionPercentage}%</Text>
                <Text style={styles.subStatDesc}>Of total income</Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.subStatLabel}>Status</Text>
                <Text style={[styles.subStatValue, { color: isActive ? '#73f218' : 'rgba(255,255,255,0.3)' }]}>
                  {isActive ? 'Active' : 'Paused'}
                </Text>
                <Text style={styles.subStatDesc}>In budget pool</Text>
              </View>
            </View>
          </View>

          {/* Quick Amount Tuner */}
          <View style={{ marginBottom: 24 }}>
            <Text style={styles.sectionTitle}>Adjust Income Value</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[-500, -100, 100, 500].map((val) => (
                <TouchableOpacity
                  key={val}
                  activeOpacity={0.8}
                  onPress={() => handleQuickAdjust(val)}
                  style={styles.tunerBtn}
                >
                  <Text style={{ color: val > 0 ? '#73f218' : '#ef4444', fontWeight: '800', fontSize: 12 }}>
                    {val > 0 ? `+ $${val}` : `- $${Math.abs(val)}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Forecasts & Toggle */}
          <View style={styles.cardContainer}>
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 14 }]}>Cashflow Forecasting</Text>
            
            <View style={{ gap: 14 }}>
              <View style={styles.forecastRow}>
                <View>
                  <Text style={styles.insightLabel}>Yearly Projected Yield</Text>
                  <Text style={styles.insightValue}>${annualProjected} / yr</Text>
                </View>
                <Ionicons name="trending-up-outline" size={18} color="#73f218" />
              </View>
              
              {isFixed && (
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 }} />
              )}

              {isFixed && (
                <View style={styles.forecastRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.insightLabel}>Include in Monthly Calculations</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2, lineHeight: 14 }}>
                      Disable this toggle to exclude this salary from your Monthly overview and daily averages.
                    </Text>
                  </View>
                  <Switch
                    trackColor={{ false: '#334155', true: 'rgba(115, 242, 24, 0.3)' }}
                    thumbColor={isActive ? '#73f218' : '#64748b'}
                    ios_backgroundColor="#1e293b"
                    onValueChange={setIsActive}
                    value={isActive}
                  />
                </View>
              )}
            </View>
          </View>

          {/* Deposits History */}
          <Text style={styles.sectionTitle}>Deposit History</Text>
          {historyList.map((hist) => (
            <HistoryRow key={hist.id} {...hist} />
          ))}

          {/* Delete Button */}
          <TouchableOpacity
            onPress={handleDeleteAlert}
            activeOpacity={0.85}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 13 }}>Delete Income Stream</Text>
          </TouchableOpacity>

        </ScrollView>
      </LinearGradient>

      {/* ─── MODAL: EDIT INCOME AMOUNT ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={adjustModalVisible}
        onRequestClose={() => setAdjustModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }}
        >
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>Set Income Amount</Text>
              <TouchableOpacity onPress={() => setAdjustModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>ENTER AMOUNT FOR {incomeData.title.toUpperCase()} ($)</Text>
            <TextInput
              value={newAmountInput}
              onChangeText={setNewAmountInput}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="e.g. 3500"
              placeholderTextColor="#475569"
              style={styles.modalInput}
            />

            <TouchableOpacity
              onPress={handleSaveAmountInput}
              activeOpacity={0.85}
              style={styles.saveBtn}
            >
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Apply Amount</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  depositTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  amountDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  amountText: {
    color: '#73f218',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 4,
  },
  subStatLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  subStatDesc: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  tunerBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  forecastRow: {
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
