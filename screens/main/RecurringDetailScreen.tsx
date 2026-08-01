import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, TextInput, Modal, Alert, StyleSheet, Switch, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// ── Invoice History Item ───────────────────────────────────────────────────────
const InvoiceRow = ({ date, amount, status, icon, color }: any) => (
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
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Invoice Paid</Text>
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>{date}</Text>
      </View>
    </View>
    <View style={{ alignItems: 'flex-end', gap: 4 }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>-${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
      <View style={{ backgroundColor: 'rgba(115, 242, 24, 0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
        <Text style={{ color: '#73f218', fontSize: 9, fontWeight: '700' }}>{status}</Text>
      </View>
    </View>
  </View>
);

// ── Main Component ─────────────────────────────────────────────────────────────
import { useTransactions } from '../../context/TransactionContext';

export function RecurringDetailScreen({ navigation, route }: any) {
  const { deleteTransaction } = useTransactions();
  const expenseData = route?.params?.expense ?? {
    id: 're-1', title: 'Apartment Rent', amount: 1000, frequency: 'Monthly', category: 'Housing', icon: 'home-outline', color: '#14b8a6'
  };

  const themeColor = expenseData.color;

  // Base state hookups
  const [amount, setAmount] = useState<number>(expenseData.amount);
  const [cycle, setCycle] = useState<string>(expenseData.frequency);
  const [isAutoPay, setIsAutoPay] = useState<boolean>(true);
  
  // Modals state
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [newAmountInput, setNewAmountInput] = useState(amount.toString());

  // Dynamic percentage based on hardcoded total recurring expenses ~$1141
  const contributionPercentage = useMemo(() => {
    return ((amount / 1141) * 100).toFixed(1);
  }, [amount]);

  // Projected Annual yield/cost
  const annualCost = useMemo(() => {
    if (!isAutoPay) return '0';
    let multiplier = 12;
    if (cycle === 'Weekly') multiplier = 52;
    else if (cycle === 'Bi-weekly') multiplier = 26;
    else if (cycle === 'Yearly') multiplier = 1;
    
    return (amount * multiplier).toLocaleString(undefined, { minimumFractionDigits: 2 });
  }, [amount, cycle, isAutoPay]);

  // Initial mock history
  const invoiceList = useMemo(() => {
    return [
      { id: '1', date: 'Jul 10, 2026', amount: amount.toString(), status: 'Auto-Paid', icon: expenseData.icon, color: themeColor },
      { id: '2', date: 'Jun 10, 2026', amount: amount.toString(), status: 'Auto-Paid', icon: expenseData.icon, color: themeColor },
      { id: '3', date: 'May 10, 2026', amount: amount.toString(), status: 'Auto-Paid', icon: expenseData.icon, color: themeColor }
    ];
  }, [amount, expenseData.icon, themeColor]);

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
      'Remove Recurring Expense',
      `Are you sure you want to stop tracking ${expenseData.title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            if (expenseData.id) deleteTransaction(expenseData.id);
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
        colors={['#162035', '#0f172a', '#1e141a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sheetContainer}
      >
        {/* Glow orb matched to theme color */}
        <View style={{
          position: 'absolute', top: -45, right: -45,
          width: 210, height: 210, borderRadius: 105,
          backgroundColor: themeColor, opacity: 0.12
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
              backgroundColor: themeColor + '20',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: themeColor + '30'
            }}>
              <Ionicons name={expenseData.icon} size={22} color={themeColor} />
            </View>
            <View>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.2 }}>
                {expenseData.title}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2, fontWeight: '600' }}>
                Recurring Cost - {expenseData.category}
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
              <Text style={styles.depositTitle}>MONTHLY COST</Text>
              
              <TouchableOpacity
                onPress={() => setAdjustModalVisible(true)}
                activeOpacity={0.7}
                style={styles.amountDisplayContainer}
              >
                <Text style={styles.amountText}>
                  -${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Ionicons name="create-outline" size={18} color={themeColor} style={{ marginTop: 6 }} />
              </TouchableOpacity>

              <View style={[styles.badge, { backgroundColor: themeColor + '15' }]}>
                <Text style={{ color: themeColor, fontWeight: '800', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {cycle} billing cycle
                </Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 16 }} />

            {/* Quick Metrics */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.subStatLabel}>Cost Share</Text>
                <Text style={styles.subStatValue}>{contributionPercentage}%</Text>
                <Text style={styles.subStatDesc}>Of total fixed costs</Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.subStatLabel}>Forecasting</Text>
                <Text style={[styles.subStatValue, { color: isAutoPay ? '#ef4444' : 'rgba(255,255,255,0.3)' }]}>
                  {isAutoPay ? 'Enabled' : 'Paused'}
                </Text>
                <Text style={styles.subStatDesc}>Deducted monthly</Text>
              </View>
            </View>
          </View>

          {/* Quick Adjust Limit */}
          <View style={{ marginBottom: 24 }}>
            <Text style={styles.sectionTitle}>Adjust Subscription Fee</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[-25, -5, 5, 25].map((val) => (
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
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 14 }]}>Expense Projections</Text>
            
            <View style={{ gap: 14 }}>
              <View style={styles.forecastRow}>
                <View>
                  <Text style={styles.insightLabel}>Annualized Cost</Text>
                  <Text style={styles.insightValue}>${annualCost} / yr</Text>
                </View>
                <Ionicons name="calculator-outline" size={18} color="rgba(255,255,255,0.4)" />
              </View>
              
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 }} />

              <View style={styles.forecastRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.insightLabel}>Include in Budget Projections</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2, lineHeight: 14 }}>
                    Exclude this item to temporarily prevent it from deducting from your monthly budget overview limits.
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#334155', true: 'rgba(239, 68, 68, 0.3)' }}
                  thumbColor={isAutoPay ? '#ef4444' : '#64748b'}
                  ios_backgroundColor="#1e293b"
                  onValueChange={setIsAutoPay}
                  value={isAutoPay}
                />
              </View>
            </View>
          </View>

          {/* Billing Cycle Changer */}
          <View style={{ marginBottom: 24 }}>
            <Text style={styles.sectionTitle}>Change Billing Cycle</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['Weekly', 'Monthly', 'Yearly'].map((itemCycle) => {
                const isSel = cycle === itemCycle;
                return (
                  <TouchableOpacity
                    key={itemCycle}
                    activeOpacity={0.85}
                    onPress={() => setCycle(itemCycle)}
                    style={[
                      styles.cycleBtn,
                      {
                        backgroundColor: isSel ? themeColor + '20' : 'rgba(255,255,255,0.02)',
                        borderColor: isSel ? themeColor : 'rgba(255,255,255,0.06)'
                      }
                    ]}
                  >
                    <Text style={{ color: isSel ? themeColor : '#94a3b8', fontSize: 11, fontWeight: '800' }}>
                      {itemCycle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Deposits History */}
          <Text style={styles.sectionTitle}>Invoicing History</Text>
          {invoiceList.map((hist) => (
            <InvoiceRow key={hist.id} {...hist} />
          ))}

          {/* Delete Button */}
          <TouchableOpacity
            onPress={handleDeleteAlert}
            activeOpacity={0.85}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 13 }}>Cancel Subscription tracking</Text>
          </TouchableOpacity>

        </ScrollView>
      </LinearGradient>

      {/* ─── MODAL: EDIT AMOUNT ─── */}
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
              <Text style={styles.modalTitle}>Set Subscription Fee</Text>
              <TouchableOpacity onPress={() => setAdjustModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>ENTER FEE FOR {expenseData.title.toUpperCase()} ($)</Text>
            <TextInput
              value={newAmountInput}
              onChangeText={setNewAmountInput}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="0.00"
              placeholderTextColor="#475569"
              style={styles.modalInput}
            />

            <TouchableOpacity
              onPress={handleSaveAmountInput}
              activeOpacity={0.85}
              style={[styles.saveBtn, { backgroundColor: themeColor }]}
            >
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Apply Fee</Text>
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
    color: '#fff',
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
  cycleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
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
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
});
