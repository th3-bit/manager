import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  Animated,
  Easing,
  Dimensions,
  TextInput,
  RefreshControl,
  StyleSheet,
  Alert,
  Switch,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { saveTransaction, fetchUserTransactions, fetchUserAccounts } from '../../lib/financeService';
import { useCurrency } from '../../context/CurrencyContext';
import { useGoals } from '../../context/GoalContext';
import { useTransactions } from '../../context/TransactionContext';
import { useAccounts } from '../../context/AccountContext';
import { useBills } from '../../context/BillContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

// Constants
const CARD_WIDTH = SCREEN_WIDTH - 24; // 12px margin on each side — matches home page
const CARD_SPACING = 16;

const CURRENCIES = [
  { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc', flagUrl: 'https://flagcdn.com/w80/rw.png' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flagUrl: 'https://flagcdn.com/w80/us.png' },
  { code: 'EUR', symbol: '€', name: 'Euro', flagUrl: 'https://flagcdn.com/w80/eu.png' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flagUrl: 'https://flagcdn.com/w80/gb.png' },
];

const INCOME_SOURCES = [
  'Salary & Wages',
  'Freelance / Consulting',
  'Investments / Dividends',
  'Rental Income',
  'Business Profits',
  'Side Hustle',
  'Gift / Grant',
];

const EXPENSE_MERCHANTS = [
  'Amazon AWS',
  'Grocery Supermarket',
  'Adobe Creative Suite',
  'Airtime Recharge',
  'Restaurant & Dining',
  'Uber / Taxi Ride',
  'Electricity Bill',
  'Water Bill',
];

const EXPENSE_CATEGORIES = [
  { name: 'Food', icon: 'fast-food-outline' },
  { name: 'Software', icon: 'desktop-outline' },
  { name: 'Utilities', icon: 'flash-outline' },
  { name: 'Rent', icon: 'home-outline' },
  { name: 'Recharge', icon: 'phone-portrait-outline' },
  { name: 'Transport', icon: 'car-outline' },
  { name: 'Shopping', icon: 'cart-outline' },
];

type Account = {
  id: string;
  name: string;
  type: 'Overall' | 'MobileMoney' | 'Cards' | 'Cash';
  balance: number;
  income: number;
  expenses: number;
  cardNo: string;
  expDate: string;
  color: [string, string, ...string[]];
  bankName?: string;
};

type Transaction = {
  id: string;
  title: string;
  date: string;
  amount: number;
  icon: string;
  category: string;
  accountId: string;
  isIncome: boolean;
};

export function WalletScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { currency, formatAmount } = useCurrency();
  const { savingsGoals, addGoal } = useGoals();
  const { transactions: globalTx, addTransaction: addGlobalTx } = useTransactions();
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  // User name from Supabase auth
  const [fullName, setFullName] = useState('User');

  // Notifications panel
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const toggleNotifications = () => {
    if (showNotifications) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setShowNotifications(false));
    } else {
      setShowNotifications(true);
      setHasSeenNotifications(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.user_metadata?.full_name) {
          setFullName(user.user_metadata.full_name);
        } else if (user.email) {
          setFullName(user.email.split('@')[0]);
        }

        // Fetch user's real transactions from Supabase
        const dbTx = await fetchUserTransactions(user.id);
      }
    };
    fetchUser();
  }, []);

  const { accounts: rawAccounts, addAccount, updateAccountBalance, transferBetweenAccounts } = useAccounts();

  const accounts: Account[] = rawAccounts.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type === 'Cash' ? 'Cash' : a.type === 'MobileMoney' ? 'MobileMoney' : a.type === 'CreditCard' || a.type === 'Checking' ? 'Cards' : 'Overall',
    balance: a.balance,
    income: a.income || 0,
    expenses: a.expenses || 0,
    cardNo: a.cardNo || '•••• 8849',
    expDate: a.expDate || 'Active',
    color: (a.color && a.color.length >= 2 ? a.color : ['#0f172a', '#1e293b', '#0f172a']) as [string, string, ...string[]],
    bankName: a.institution,
  }));

  const recentTransactions: Transaction[] = globalTx.map(t => ({
    id: t.id,
    title: t.title,
    date: t.date,
    amount: t.amount,
    icon: t.icon || (t.isIncome ? 'cash-outline' : 'card-outline'),
    category: t.category,
    accountId: t.account,
    isIncome: t.isIncome,
  }));

  const { bills: globalBills, markAsPaid } = useBills();

  const [selectedBillDetail, setSelectedBillDetail] = useState<any>(null);
  const [pendingBillPayment, setPendingBillPayment] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const upcomingPayments = globalBills.filter(b => !b.isPaid).map(b => ({
    id: b.id,
    title: b.title,
    amount: b.amount,
    daysLeft: b.daysLeft,
    icon: b.icon || 'card-outline',
  }));

  const incomeNotifications = useMemo(() => globalTx.filter(t => t.isIncome), [globalTx]);
  const [hasSeenNotifications, setHasSeenNotifications] = useState(false);
  const unreadCount = upcomingPayments.length + incomeNotifications.length;
  const hasUnread = unreadCount > 0 && !hasSeenNotifications;

  const [loans, setLoans] = useState<any[]>([]);

  const totalUpcomingAmt = useMemo(() => upcomingPayments.reduce((sum, p) => sum + p.amount, 0), [upcomingPayments]);

  const insights = useMemo(() => {
    const list: string[] = [];
    if (totalUpcomingAmt > 0) {
      list.push(`⏳ Upcoming payments total ${formatAmount(totalUpcomingAmt)} due soon.`);
    }
    if (globalTx.length > 0) {
      const incomeTotal = globalTx.filter(t => t.isIncome).reduce((sum, t) => sum + t.amount, 0);
      const expenseTotal = globalTx.filter(t => !t.isIncome).reduce((sum, t) => sum + t.amount, 0);
      if (incomeTotal >= expenseTotal) {
        list.push(`📈 Great job! Your cash inflow is exceeding your outflows this period.`);
      } else {
        list.push(`⚠️ Cash outflow (${formatAmount(expenseTotal)}) has exceeded inflow (${formatAmount(incomeTotal)}).`);
      }
    }
    if (savingsGoals.length > 0) {
      const topGoal = savingsGoals[0];
      const remaining = Math.max(0, topGoal.target - topGoal.saved);
      if (remaining > 0) {
        list.push(`🎯 Savings progress: You are ${formatAmount(remaining)} away from hitting your ${topGoal.label} goal!`);
      } else {
        list.push(`🎉 Congratulations! You have achieved your ${topGoal.label} goal!`);
      }
    }
    if (list.length === 0) {
      list.push('💡 Add your first transactions and bills to receive personal smart insights!');
    }
    return list;
  }, [totalUpcomingAmt, globalTx, savingsGoals, formatAmount]);

  const [activeInsightIndex, setActiveInsightIndex] = useState(0);

  // ── Step 2: OCR Scanner State & Mock Data ──
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const MOCK_RECEIPTS = [
    { merchant: 'Starbucks Coffee', category: 'Food', amount: '18.50', taxDeductible: false, date: '2026-07-23', icon: 'cafe-outline' },
    { merchant: 'Amazon AWS Cloud', category: 'Software', amount: '149.99', taxDeductible: true, date: '2026-07-22', icon: 'cloud-outline' },
    { merchant: 'Uber Technologies', category: 'Transport', amount: '34.20', taxDeductible: true, date: '2026-07-21', icon: 'car-outline' },
    { merchant: 'Whole Foods Market', category: 'Food', amount: '87.40', taxDeductible: false, date: '2026-07-20', icon: 'cart-outline' },
    { merchant: 'Apple Store Hardware', category: 'Software', amount: '249.00', taxDeductible: true, date: '2026-07-19', icon: 'desktop-outline' },
  ];

  const handleSimulateOCRScan = (receipt: typeof MOCK_RECEIPTS[0]) => {
    setIsScanningReceipt(true);
    setScanProgress(0);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    let p = 0;
    const timer = setInterval(() => {
      p += 25;
      setScanProgress(p);
      if (p >= 100) {
        clearInterval(timer);
        setIsScanningReceipt(false);
        setOcrModalVisible(false);

        // Auto-fill transaction fields!
        setTxType('expense');
        setTxTitle(receipt.merchant);
        setTxAmount(receipt.amount);
        setTxCategory(receipt.category);
        setExpDate(receipt.date);
        setTxModalVisible(true);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert('✨ Receipt Scanned!', `Extracted ${receipt.merchant} (${currency.symbol}${receipt.amount}) automatically into expense form!`);
      }
    }, 300);
  };

  // Category Colors & icons mapping
  const categorySummary = [
    { name: 'Food & Drinks', spent: 680, percentage: 35, color: '#ef4444', icon: 'fast-food-outline' },
    { name: 'Rent & Living', spent: 1200, percentage: 40, color: '#3b82f6', icon: 'home-outline' },
    { name: 'Software & Subscriptions', spent: 280, percentage: 15, color: '#8b5cf6', icon: 'code-working-outline' },
    { name: 'Miscellaneous', spent: 147, percentage: 10, color: '#f59e0b', icon: 'grid-outline' },
  ];

  // Modals Visibility
  const [txModalVisible, setTxModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);

  // New Transaction Form state
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('Food');
  const [txAccountId, setTxAccountId] = useState('acc-overall');

  // Income & Expense Specific States
  const [incFrequency, setIncFrequency] = useState('Monthly');
  const [incDate, setIncDate] = useState('2026-07-16');
  const [incIsContinuous, setIncIsContinuous] = useState(true);
  const [incCurrency, setIncCurrency] = useState(currency);
  const [showIncCurrencyPicker, setShowIncCurrencyPicker] = useState(false);
  const [showIncSourcePicker, setShowIncSourcePicker] = useState(false);

  useEffect(() => {
    if (currency) {
      setIncCurrency(currency);
    }
  }, [currency, txModalVisible]);

  const activeTxCurrency = incCurrency && incCurrency.code ? incCurrency : currency;

  // Expense Specific States
  const [expFrequency, setExpFrequency] = useState('One-off');
  const [expDate, setExpDate] = useState('2026-07-16');
  const [showExpMerchantPicker, setShowExpMerchantPicker] = useState(false);
  const [showExpCategoryPicker, setShowExpCategoryPicker] = useState(false);

  // Transfer Form state
  const [transferFromId, setTransferFromId] = useState('acc-cards');
  const [transferToId, setTransferToId] = useState('acc-momo');
  const [transferAmount, setTransferAmount] = useState('');

  // Add Account Form state
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'MobileMoney' | 'Cards' | 'Cash'>('Cards');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccExp, setNewAccExp] = useState('');
  const [newAccBank, setNewAccBank] = useState('');

  // Animations
  const balanceOpacity = useRef(new Animated.Value(1)).current;

  // Change Insight rotate loop
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveInsightIndex((prev) => (prev + 1) % insights.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [insights.length]);

  const toggleBalanceVisibility = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.timing(balanceOpacity, {
      toValue: balanceHidden ? 1 : 0.15,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setBalanceHidden(!balanceHidden);
      Animated.timing(balanceOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  // Pull-to-refresh
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  // Form Handlers
  const handleAddTransaction = async () => {
    if (!txTitle.trim() || !txAmount.trim()) {
      Alert.alert('Validation Error', 'Please fill in all details.');
      return;
    }
    const amountVal = parseFloat(txAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      title: txTitle,
      date: 'Just now',
      amount: amountVal,
      icon: txType === 'income' ? 'arrow-down-circle-outline' : 'cart-outline',
      category: txCategory,
      accountId: txAccountId,
      isIncome: txType === 'income',
    };



    addGlobalTx({
      title: txTitle,
      amount: amountVal,
      isIncome: txType === 'income',
      category: txCategory,
      account: txAccountId,
      date: 'Just now',
    });
    setTxTitle('');
    setTxAmount('');
    setTxModalVisible(false);

    // Save transaction live to Supabase
    await saveTransaction({
      title: txTitle,
      amount: amountVal,
      category: txCategory,
      type: txType,
      accountId: txAccountId,
    });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleTransfer = () => {
    if (transferFromId === transferToId) {
      Alert.alert('Transfer Error', 'Source and destination accounts must be different.');
      return;
    }
    const amountVal = parseFloat(transferAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid transfer amount.');
      return;
    }

    const sourceAcc = accounts.find(a => a.id === transferFromId);
    if (sourceAcc && sourceAcc.balance < amountVal) {
      Alert.alert('Insufficient Funds', `You only have $${sourceAcc.balance.toFixed(2)} in ${sourceAcc.name}.`);
      return;
    }

    transferBetweenAccounts(transferFromId, transferToId, amountVal);

    addGlobalTx({
      title: `Trsf to ${accounts.find(a => a.id === transferToId)?.name || 'Account'}`,
      amount: amountVal,
      isIncome: false,
      category: 'Transfer',
      account: transferFromId,
      date: 'Just now',
      icon: 'swap-horizontal-outline',
    });
    setTransferAmount('');
    setTransferModalVisible(false);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCreateAccount = () => {
    if (!newAccName.trim() || !newAccBalance.trim()) {
      Alert.alert('Validation Error', 'Please fill in the Name and Balance fields.');
      return;
    }
    const balVal = parseFloat(newAccBalance);
    if (isNaN(balVal) || balVal < 0) {
      Alert.alert('Validation Error', 'Please enter a valid initial balance.');
      return;
    }

    let colors: [string, string, ...string[]] = ['#8b5cf6', '#7c3aed', '#5b21b6']; // default purple
    if (newAccType === 'MobileMoney') colors = ['#f59e0b', '#d97706', '#b45309'];
    if (newAccType === 'Cash') colors = ['#10b981', '#059669', '#047857'];

    addAccount({
      name: newAccName,
      type: newAccType as any,
      balance: balVal,
      currency: 'USD',
      institution: newAccBank.trim() ? newAccBank : 'Custom Bank',
      isDefault: false,
      cardNo: newAccNumber.trim() ? `•••• ${newAccNumber.slice(-4)}` : '•••• 9901',
      expDate: newAccExp.trim() ? newAccExp : '12/28',
      color: colors,
    });

    setNewAccName('');
    setNewAccBalance('');
    setNewAccNumber('');
    setNewAccExp('');
    setNewAccBank('');
    setAccountModalVisible(false);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Helper values
  const activeAccount = accounts[activeCardIndex] || accounts[0];
  const netSavings = activeAccount.income - activeAccount.expenses;
  const netSavingsPct = activeAccount.income > 0 ? Math.min(Math.round((netSavings / activeAccount.income) * 100), 100) : 0;

  const handlePayBill = (item: any) => {
    setPendingBillPayment(item);
  };

  const executeBillPayment = (item: any) => {
    if (!item) return;
    const payAmt = Number(item.amount) || 0;
    const currentAcc = accounts[activeCardIndex] || accounts[0];

    if (!currentAcc) {
      showToast('No active account selected.', 'error');
      setPendingBillPayment(null);
      return;
    }

    if (currentAcc.balance < payAmt) {
      showToast(`Insufficient Funds — Your ${currentAcc.name} balance is ${formatAmount(currentAcc.balance)}.`, 'error');
      setPendingBillPayment(null);
      return;
    }

    updateAccountBalance(currentAcc.id, currentAcc.balance - payAmt);
    markAsPaid(item.id);
    addGlobalTx({
      title: item.title,
      amount: payAmt,
      isIncome: false,
      category: 'Bills & Subscriptions',
      account: currentAcc.name,
      date: 'Just now',
      icon: item.icon,
    });

    setPendingBillPayment(null);
    setSelectedBillDetail(null);
    showToast(`🎉 Bill Paid! ${item.title} (${formatAmount(payAmt)}) processed from ${currentAcc.name}.`, 'success');
  };

  // Time-aware greeting — mirrors DashboardScreen
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Good morning', emoji: '☀️' };
    if (hour >= 12 && hour < 17) return { text: 'Good afternoon', emoji: '⛅' };
    if (hour >= 17 && hour < 21) return { text: 'Good evening', emoji: '🌆' };
    return { text: 'Good night', emoji: '🌙' };
  };
  const greeting = getGreeting();
  const firstName = fullName.split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#070d1a' }}>
      <StatusBar barStyle="light-content" />

      {/* ─── IN-APP TOAST NOTIFICATION BANNER ─── */}
      {toastMessage && (
        <View style={{
          position: 'absolute',
          top: insets.top + 10,
          left: 20,
          right: 20,
          zIndex: 999999,
          elevation: 999999,
          backgroundColor: toastMessage.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 23, 42, 0.95)',
          borderWidth: 1.5,
          borderColor: toastMessage.type === 'error' ? '#ef4444' : '#73f218',
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
        }}>
          <Ionicons
            name={toastMessage.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
            size={22}
            color={toastMessage.type === 'error' ? '#fff' : '#73f218'}
          />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', flex: 1 }}>
            {toastMessage.text}
          </Text>
          <TouchableOpacity onPress={() => setToastMessage(null)}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      )}

      {/* 🌌 Background Ambient Glow Orbs */}
      <View
        style={{
          position: 'absolute',
          top: -60,
          right: -50,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: '#73f218',
          opacity: 0.08,
          pointerEvents: 'none',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 320,
          left: -80,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: '#6366f1',
          opacity: 0.08,
          pointerEvents: 'none',
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#73f218" />
        }
      >
        {/* ─── HEADER BAR ───────────────────────────────────────────── */}
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 20,
            paddingTop: Platform.OS === 'ios' ? 12 : 16,
            paddingBottom: 20,
            marginBottom: 20,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Avatar & Greeting */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#73f218',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                  shadowColor: '#73f218',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                }}
              >
                <Text style={{ color: '#0f172a', fontSize: 18, fontWeight: '900' }}>
                  {fullName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' }}>
                  {greeting.emoji} {greeting.text}
                </Text>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 1 }}>
                  {firstName} 👋
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={toggleBalanceVisibility}
                activeOpacity={0.7}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)',
                }}
              >
                <Ionicons
                  name={balanceHidden ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={toggleNotifications}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)',
                }}
              >
                {hasUnread && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#ef4444',
                      zIndex: 10,
                      borderWidth: 1.5,
                      borderColor: '#0f172a',
                    }}
                  />
                )}
                <Ionicons name="notifications-outline" size={19} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 16 }}>

          {/* ─────────────────────────────────────────────────────────────
               HERO PORTFOLIO & CARDS CAROUSEL
          ────────────────────────────────────────────────────────────── */}
          <View style={{ marginBottom: 24 }}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_SPACING}
              decelerationRate="fast"
              snapToAlignment="start"
              contentContainerStyle={{ paddingHorizontal: 0 }}
              onMomentumScrollEnd={(e) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
                if (index !== activeCardIndex && index >= 0 && index < accounts.length) {
                  setActiveCardIndex(index);
                  if (Platform.OS !== 'web') {
                    Haptics.selectionAsync();
                  }
                }
              }}
            >
              {accounts.map((acc) => (
                <View
                  key={acc.id}
                  style={{ width: CARD_WIDTH, marginRight: CARD_SPACING }}
                >
                  <LinearGradient
                    colors={acc.color}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 26,
                      padding: 22,
                      height: 200,
                      justifyContent: 'space-between',
                      borderWidth: 1.5,
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 12 },
                      shadowOpacity: 0.4,
                      shadowRadius: 20,
                      elevation: 10,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 }}>{acc.type} Account</Text>
                        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', marginTop: 2 }}>{acc.name}</Text>
                      </View>
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{acc.bankName || 'Active'}</Text>
                      </View>
                    </View>

                    <View style={{ marginVertical: 'auto' }}>
                      <Animated.View style={{ opacity: balanceOpacity }}>
                        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700' }}>Total Available Balance</Text>
                        <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 }}>
                          {balanceHidden ? '••••••' : formatAmount(acc.balance)}
                        </Text>
                      </Animated.View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 14, fontWeight: '700', letterSpacing: 1.5 }}>{acc.cardNo}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' }}>{acc.expDate}</Text>
                    </View>
                  </LinearGradient>
                </View>
              ))}
            </ScrollView>

            {/* Pagination Indicators */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 16 }}>
              {accounts.map((_, i) => (
                <View
                  key={i}
                  style={{
                    height: 6,
                    borderRadius: 3,
                    width: i === activeCardIndex ? 22 : 6,
                    backgroundColor: i === activeCardIndex ? '#73f218' : 'rgba(255,255,255,0.15)',
                  }}
                />
              ))}
              <TouchableOpacity
                onPress={() => setAccountModalVisible(true)}
                activeOpacity={0.7}
                style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
              >
                <Ionicons name="add" size={15} color="#73f218" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ─────────────────────────────────────────────────────────────
               QUICK ACTIONS GRID
          ────────────────────────────────────────────────────────────── */}
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.7)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.12)',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            {/* Income */}
            <TouchableOpacity
              onPress={() => {
                setTxType('income');
                setIncCurrency(currency);
                setTxAccountId(activeAccount.id);
                setTxModalVisible(true);
              }}
              activeOpacity={0.8}
              style={{ alignItems: 'center', flex: 1 }}
            >
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.25)', 'rgba(16, 185, 129, 0.08)']}
                style={{
                  width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6,
                  borderWidth: 1.5, borderColor: 'rgba(16, 185, 129, 0.5)',
                }}
              >
                <Ionicons name="arrow-down" size={20} color="#10b981" />
              </LinearGradient>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Income</Text>
            </TouchableOpacity>

            {/* Expense */}
            <TouchableOpacity
              onPress={() => {
                setTxType('expense');
                setIncCurrency(currency);
                setTxAccountId(activeAccount.id);
                setTxModalVisible(true);
              }}
              activeOpacity={0.8}
              style={{ alignItems: 'center', flex: 1 }}
            >
              <LinearGradient
                colors={['rgba(244, 63, 94, 0.25)', 'rgba(244, 63, 94, 0.08)']}
                style={{
                  width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6,
                  borderWidth: 1.5, borderColor: 'rgba(244, 63, 94, 0.5)',
                }}
              >
                <Ionicons name="arrow-up" size={20} color="#f43f5e" />
              </LinearGradient>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Expense</Text>
            </TouchableOpacity>

            {/* Pay Bill */}
            <TouchableOpacity
              onPress={() => {
                if (upcomingPayments.length > 0) {
                  handlePayBill(upcomingPayments[0]);
                } else {
                  navigation.navigate('AllUpcomingPayments');
                }
              }}
              activeOpacity={0.8}
              style={{ alignItems: 'center', flex: 1 }}
            >
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0.08)']}
                style={{
                  width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6,
                  borderWidth: 1.5, borderColor: 'rgba(59, 130, 246, 0.5)',
                }}
              >
                <Ionicons name="card" size={20} color="#60a5fa" />
              </LinearGradient>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Pay Bill</Text>
            </TouchableOpacity>

            {/* Transfer */}
            <TouchableOpacity
              onPress={() => {
                setTransferFromId(activeAccount.id);
                setTransferModalVisible(true);
              }}
              activeOpacity={0.8}
              style={{ alignItems: 'center', flex: 1 }}
            >
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.25)', 'rgba(99, 102, 241, 0.08)']}
                style={{
                  width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6,
                  borderWidth: 1.5, borderColor: 'rgba(99, 102, 241, 0.5)',
                }}
              >
                <Ionicons name="swap-horizontal" size={20} color="#6366f1" />
              </LinearGradient>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Transfer</Text>
            </TouchableOpacity>

            {/* Scan Receipt OCR */}
            <TouchableOpacity
              onPress={() => {
                setOcrModalVisible(true);
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              activeOpacity={0.8}
              style={{ alignItems: 'center', flex: 1 }}
            >
              <LinearGradient
                colors={['rgba(168, 85, 247, 0.35)', 'rgba(168, 85, 247, 0.12)']}
                style={{
                  width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6,
                  borderWidth: 1.5, borderColor: '#a855f7',
                }}
              >
                <Ionicons name="camera" size={20} color="#a855f7" />
              </LinearGradient>
              <Text style={{ color: '#a855f7', fontSize: 10, fontWeight: '900' }}>Scan OCR</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Dedicated AI OCR Scan Banner */}
          <TouchableOpacity
            onPress={() => {
              setOcrModalVisible(true);
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            activeOpacity={0.85}
            style={{ marginBottom: 20, borderRadius: 20, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['rgba(168, 85, 247, 0.25)', 'rgba(126, 34, 206, 0.12)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1.5,
                borderColor: 'rgba(168, 85, 247, 0.4)',
                borderRadius: 20,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#a855f7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </View>
                <View>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>📷 AI Smart Receipt OCR Scanner</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 }}>Scan receipts to auto-extract merchant & total</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#a855f7" />
            </LinearGradient>
          </TouchableOpacity>

          {/* ─────────────────────────────────────────────────────────────
               FINANCIAL HEALTH METRICS
          ────────────────────────────────────────────────────────────── */}
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.7)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24,
              padding: 20,
              marginBottom: 24,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.12)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 }}>ACCOUNT METRICS ({activeAccount.name})</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>TOTAL INFLOW</Text>
                <Text style={{ color: '#10b981', fontSize: 20, fontWeight: '900', marginTop: 2 }}>
                  {balanceHidden ? '••••' : `+${formatAmount(activeAccount.income)}`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>TOTAL OUTFLOW</Text>
                <Text style={{ color: '#ef4444', fontSize: 20, fontWeight: '900', marginTop: 2 }}>
                  {balanceHidden ? '••••' : `-${formatAmount(activeAccount.expenses)}`}
                </Text>
              </View>
            </View>

            <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 14, flexDirection: 'row' }}>
              <View
                style={{ width: `${Math.max(10, 100 - netSavingsPct)}%`, backgroundColor: '#10b981', height: '100%' }}
              />
              <View
                style={{ width: `${Math.max(0, netSavingsPct)}%`, backgroundColor: '#ef4444', height: '100%' }}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' }}>Monthly Savings Margin</Text>
              <Text style={{ color: '#73f218', fontSize: 14, fontWeight: '900' }}>
                {netSavings >= 0 ? '+' : '-'}{formatAmount(Math.abs(netSavings))} ({netSavingsPct}%)
              </Text>
            </View>
          </LinearGradient>

          {/* ─────────────────────────────────────────────────────────────
               LINKED ACCOUNTS LIST
          ────────────────────────────────────────────────────────────── */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 14 }}>Linked Accounts</Text>
            <LinearGradient
              colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.7)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.12)',
                overflow: 'hidden',
              }}
            >
              {accounts.map((acc, index) => {
                const isSelected = index === activeCardIndex;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    onPress={() => {
                      setActiveCardIndex(index);
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 16,
                      borderBottomWidth: index === accounts.length - 1 ? 0 : 1,
                      borderBottomColor: 'rgba(255, 255, 255, 0.06)',
                      backgroundColor: isSelected ? 'rgba(115, 242, 24, 0.08)' : 'transparent',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 14,
                          backgroundColor: acc.color[0],
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                        }}
                      >
                        <Ionicons
                          name={
                            acc.type === 'Overall'
                              ? 'grid-outline'
                              : acc.type === 'MobileMoney'
                              ? 'phone-portrait-outline'
                              : acc.type === 'Cards'
                              ? 'card-outline'
                              : 'cash-outline'
                          }
                          size={20}
                          color="#fff"
                        />
                      </View>
                      <View>
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{acc.name}</Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 }}>{acc.cardNo}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: isSelected ? '#73f218' : '#fff', fontSize: 15, fontWeight: '900' }}>
                        {balanceHidden ? '••••' : formatAmount(acc.balance)}
                      </Text>
                      <Text style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: 10, fontWeight: '700', marginTop: 2 }}>
                        {acc.type === 'Overall' ? 'Portfolio Net' : 'Available'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </LinearGradient>
          </View>

          {/* ─────────────────────────────────────────────────────────────
               OUTFLOW CATEGORY BREAKDOWN
          ────────────────────────────────────────────────────────────── */}
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.7)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24,
              padding: 20,
              marginBottom: 24,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.12)',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Monthly Outflow Breakdown</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '800' }}>Details</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 14 }}>
              {categorySummary.map((cat, i) => (
                <View key={i}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: cat.color + '25', borderWidth: 1, borderColor: cat.color + '40' }}
                      >
                        <Ionicons name={cat.icon as any} size={14} color={cat.color} />
                      </View>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{cat.name}</Text>
                    </View>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>${cat.spent} ({cat.percentage}%)</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <View
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color, height: '100%', borderRadius: 3 }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* ─────────────────────────────────────────────────────────────
               RECENT TRANSACTIONS
          ────────────────────────────────────────────────────────────── */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Recent Inflows & Outflows</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AllTransactions')}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '800' }}>See All</Text>
              </TouchableOpacity>
            </View>
            <LinearGradient
              colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.7)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.12)',
                padding: 10,
              }}
            >
              {recentTransactions.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="receipt-outline" size={32} color="rgba(255,255,255,0.25)" style={{ marginBottom: 8 }} />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>No Transactions Logged Yet</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                    Tap + Income or + Expense above to record your first real entry.
                  </Text>
                </View>
              ) : (
                recentTransactions.map((tx, index) => (
                  <View
                    key={tx.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderBottomWidth: index === recentTransactions.length - 1 ? 0 : 1,
                      borderBottomColor: 'rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                        <Ionicons name={tx.icon as any} size={18} color="#fff" />
                      </View>
                      <View>
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{tx.title}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2, fontWeight: '600' }}>{tx.date}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: tx.isIncome ? '#10b981' : '#fff', fontSize: 15, fontWeight: '900' }}>
                        {tx.isIncome ? '+' : '-'}{formatAmount(tx.amount)}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', marginTop: 2 }}>{tx.category}</Text>
                    </View>
                  </View>
                ))
              )}
            </LinearGradient>
          </View>

          {/* ─────────────────────────────────────────────────────────────
               SAVINGS PROGRESS
          ────────────────────────────────────────────────────────────── */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Savings Progress</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AllSavingsGoals')}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '800' }}>Manage</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {savingsGoals.map((goal) => {
                const pct = Math.min(Math.round((goal.saved / goal.target) * 100), 100);
                return (
                  <TouchableOpacity
                    key={goal.id}
                    onPress={() => navigation.navigate('SavingsGoalDetail', { goal })}
                    activeOpacity={0.8}
                    style={{ width: 170, height: 160, borderRadius: 24, padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.9)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', justifyContent: 'space-between' }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>{goal.icon}</Text>
                      </View>
                      <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '900' }}>{pct}%</Text>
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <Text numberOfLines={1} style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{goal.label}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '600', marginTop: 2 }}>
                        Saved: ${goal.saved} / ${goal.target}
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginTop: 10 }}>
                      <View style={{ width: `${pct}%`, backgroundColor: goal.color, height: '100%', borderRadius: 3 }} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ─────────────────────────────────────────────────────────────
               UPCOMING BILLS & SUBSCRIPTIONS
          ────────────────────────────────────────────────────────────── */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Due Subscriptions & Bills</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AllUpcomingPayments')}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '800' }}>All Bills</Text>
              </TouchableOpacity>
            </View>
            <LinearGradient
              colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.7)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.12)',
                padding: 16,
                gap: 14,
              }}
            >
              {upcomingPayments.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() => setSelectedBillDetail(item)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                      <Ionicons name={item.icon as any} size={17} color="#a5b4fc" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{item.title}</Text>
                      <Text style={{ color: item.daysLeft <= 2 ? '#f43f5e' : 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', marginTop: 2 }}>
                        Due in {item.daysLeft} days
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>{formatAmount(item.amount)}</Text>
                    <TouchableOpacity
                      onPress={() => handlePayBill(item)}
                      activeOpacity={0.75}
                      style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(115,242,24,0.15)', borderWidth: 1, borderColor: '#73f218' }}
                    >
                      <Text style={{ color: '#73f218', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Pay</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </LinearGradient>
          </View>

          {/* ─────────────────────────────────────────────────────────────
               AI SMART INSIGHTS
          ────────────────────────────────────────────────────────────── */}
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.8)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24,
              padding: 20,
              borderWidth: 1.5,
              borderColor: 'rgba(115, 242, 24, 0.3)',
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="sparkles" size={16} color="#73f218" style={{ marginRight: 6 }} />
              <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>AI Portfolio Insights</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', lineHeight: 18 }}>
              {insights[activeInsightIndex]}
            </Text>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* ─────────────────────────────────────────────────────────────────
           ADD TRANSACTION / INCOME MODAL (Centered & Glassmorphic)
      ────────────────────────────────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={txModalVisible}
        onRequestClose={() => setTxModalVisible(false)}
        statusBarTranslucent
      >
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          paddingHorizontal: 16,
          paddingVertical: 20,
          zIndex: 9999,
        }}>
          <LinearGradient
            colors={['#0f172a', '#1e293b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: '100%',
              maxWidth: 410,
              alignSelf: 'center',
              borderRadius: 28,
              padding: 22,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.5,
              shadowRadius: 30,
              elevation: 20,
              maxHeight: '88%',
            }}
          >
            {/* Header Title + Close */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }}>
                {txType === 'income' ? 'Add Income Source' : 'Log Expense Payment'}
              </Text>
              <TouchableOpacity
                onPress={() => setTxModalVisible(false)}
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Type Switcher */}
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setTxType('expense')}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: txType === 'expense' ? 'rgba(239, 68, 68, 0.15)' : 'transparent', borderWidth: txType === 'expense' ? 1 : 0, borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                <Text style={{ color: txType === 'expense' ? '#ef4444' : 'rgba(255,255,255,0.5)', fontWeight: '800', fontSize: 13 }}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setTxType('income')}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: txType === 'income' ? 'rgba(115, 242, 24, 0.15)' : 'transparent', borderWidth: txType === 'income' ? 1 : 0, borderColor: 'rgba(115, 242, 24, 0.3)' }}
              >
                <Text style={{ color: txType === 'income' ? '#73f218' : 'rgba(255,255,255,0.5)', fontWeight: '800', fontSize: 13 }}>Income</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* 1. MERCHANT / DESC */}
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>
                {txType === 'income' ? 'INCOME SOURCE NAME' : 'MERCHANT / DESC'}
              </Text>
              {txType === 'income' ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowIncSourcePicker(true)}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16,
                  }}
                >
                  <Text style={{ color: txTitle ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '600' }}>
                    {txTitle || 'Select income source type...'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#73f218" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowExpMerchantPicker(true)}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16,
                  }}
                >
                  <Text style={{ color: txTitle ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '600' }}>
                    {txTitle || 'Select merchant / description...'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#f43f5e" />
                </TouchableOpacity>
              )}

              {/* 2. CATEGORY (Expense Specific Dropdown matching screenshot) */}
              {txType === 'expense' && (
                <>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>CATEGORY</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowExpCategoryPicker(true)}
                    style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                      {txCategory || 'Food'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#f43f5e" />
                  </TouchableOpacity>

                  {/* 3. TRANSACTION / VALUE DATE */}
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>TRANSACTION / VALUE DATE</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{expDate}</Text>
                    <Ionicons name="calendar-outline" size={18} color="#f43f5e" />
                  </TouchableOpacity>

                  {/* 4. RECURRING CYCLE / FREQUENCY */}
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>RECURRING CYCLE / FREQUENCY</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
                    {['One-off', 'Weekly', 'Monthly', 'Yearly'].map((freq) => {
                      const active = expFrequency === freq;
                      return (
                        <TouchableOpacity
                          key={freq}
                          activeOpacity={0.8}
                          onPress={() => setExpFrequency(freq)}
                          style={{
                            flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1,
                            backgroundColor: active ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.04)',
                            borderColor: active ? '#f43f5e' : 'rgba(255,255,255,0.08)',
                          }}
                        >
                          <Text style={{ color: active ? '#f43f5e' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800' }}>{freq}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* DEPOSIT CYCLE / FREQUENCY (Income Specific) */}
              {txType === 'income' && (
                <>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>DEPOSIT CYCLE / FREQUENCY</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
                    {['Weekly', 'Bi-weekly', 'Monthly', 'One-off'].map((freq) => {
                      const active = incFrequency === freq;
                      return (
                        <TouchableOpacity
                          key={freq}
                          activeOpacity={0.8}
                          onPress={() => setIncFrequency(freq)}
                          style={{
                            flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1,
                            backgroundColor: active ? 'rgba(115, 242, 24, 0.15)' : 'rgba(255,255,255,0.04)',
                            borderColor: active ? '#73f218' : 'rgba(255,255,255,0.08)',
                          }}
                        >
                          <Text style={{ color: active ? '#73f218' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800' }}>{freq}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* RECEIPT / CLEARING DATE */}
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>RECEIPT / CLEARING DATE</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{incDate}</Text>
                    <Ionicons name="calendar-outline" size={18} color="#73f218" />
                  </TouchableOpacity>

                  {/* Continuous stream (Indefinite) */}
                  <View style={{ marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Continuous stream (Indefinite)</Text>
                    <Switch
                      value={incIsContinuous}
                      onValueChange={setIncIsContinuous}
                      trackColor={{ false: '#334155', true: '#10b981' }}
                      thumbColor={incIsContinuous ? '#73f218' : '#94a3b8'}
                    />
                  </View>
                </>
              )}

              {/* 5. AMOUNT & CURRENCY (Matches screenshot with flags) */}
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>AMOUNT & CURRENCY</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 18 }}>
                {/* Amount Input Box */}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Text style={{ color: txType === 'income' ? '#73f218' : '#f43f5e', fontSize: (activeTxCurrency.symbol || '').length > 2 ? 14 : 18, fontWeight: '900', marginRight: 6 }}>
                    {activeTxCurrency.symbol}
                  </Text>
                  <TextInput
                    value={txAmount}
                    onChangeText={setTxAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={{ flex: 1, color: '#fff', fontSize: 17, fontWeight: '900', padding: 0 }}
                  />
                </View>

                {/* Currency Selector Box */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowIncCurrencyPicker(true)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', gap: 6,
                  }}
                >
                  <Image
                    source={{ uri: activeTxCurrency.flagUrl }}
                    style={{ width: 22, height: 16, borderRadius: 3, resizeMode: 'cover' }}
                  />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>
                    {activeTxCurrency.code}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              {/* Target Account selection */}
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>
                {txType === 'income' ? 'TARGET ACCOUNT' : 'SOURCE ACCOUNT'}
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                style={{ marginBottom: 20 }}
              >
                {accounts
                  .filter(a => a.type !== 'Overall')
                  .map((a) => {
                    const isSelected = txAccountId === a.id;
                    const iconName = a.type === 'MobileMoney' ? 'phone-portrait-outline' : a.type === 'Cards' ? 'card-outline' : 'cash-outline';
                    return (
                      <TouchableOpacity
                        key={a.id}
                        activeOpacity={0.8}
                        onPress={() => setTxAccountId(a.id)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                          backgroundColor: isSelected ? (txType === 'income' ? 'rgba(115, 242, 24, 0.15)' : 'rgba(244, 63, 94, 0.15)') : 'rgba(255,255,255,0.04)',
                          borderWidth: 1, borderColor: isSelected ? (txType === 'income' ? '#73f218' : '#f43f5e') : 'rgba(255,255,255,0.08)'
                        }}
                      >
                        <Ionicons name={iconName} size={14} color={isSelected ? (txType === 'income' ? '#73f218' : '#f43f5e') : 'rgba(255,255,255,0.5)'} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: isSelected ? (txType === 'income' ? '#73f218' : '#f43f5e') : 'rgba(255,255,255,0.5)' }}>
                          {a.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleAddTransaction}
              activeOpacity={0.8}
              style={{ backgroundColor: '#73f218', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 }}
            >
              <Text style={{ color: '#0f172a', fontSize: 16, fontWeight: '900' }}>
                {txType === 'income' ? 'Save Income Source' : 'Log Expense'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────
           INCOME SOURCE PICKER MODAL
      ────────────────────────────────────────────────────────────────── */}
      <Modal transparent visible={showIncSourcePicker} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.82)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowIncSourcePicker(false)}
          />
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 26,
              padding: 22,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.4,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Select Income Source Type</Text>
              <TouchableOpacity onPress={() => setShowIncSourcePicker(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8 }}>
              {INCOME_SOURCES.map((source) => {
                const isSelected = txTitle === source;
                return (
                  <TouchableOpacity
                    key={source}
                    activeOpacity={0.8}
                    onPress={() => {
                      setTxTitle(source);
                      setShowIncSourcePicker(false);
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
                    <Text style={{ color: isSelected ? '#73f218' : '#fff', fontWeight: '800', fontSize: 13 }}>{source}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#73f218" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────
           CURRENCY SELECTOR MODAL
      ────────────────────────────────────────────────────────────────── */}
      <Modal transparent visible={showIncCurrencyPicker} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.82)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowIncCurrencyPicker(false)}
          />
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 26,
              padding: 22,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.4,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowIncCurrencyPicker(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8 }}>
              {CURRENCIES.map((c) => {
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
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{c.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' }}>{c.code} ({c.symbol})</Text>
                      </View>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#73f218" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────
           EXPENSE MERCHANT PICKER MODAL
      ────────────────────────────────────────────────────────────────── */}
      <Modal transparent visible={showExpMerchantPicker} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.82)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowExpMerchantPicker(false)}
          />
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 26,
              padding: 22,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.4,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Select Merchant / Description</Text>
              <TouchableOpacity onPress={() => setShowExpMerchantPicker(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8 }}>
              {EXPENSE_MERCHANTS.map((merchant) => {
                const isSelected = txTitle === merchant;
                return (
                  <TouchableOpacity
                    key={merchant}
                    activeOpacity={0.8}
                    onPress={() => {
                      setTxTitle(merchant);
                      setShowExpMerchantPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      backgroundColor: isSelected ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: isSelected ? '#f43f5e' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <Text style={{ color: isSelected ? '#f43f5e' : '#fff', fontWeight: '800', fontSize: 13 }}>{merchant}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#f43f5e" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────
           EXPENSE CATEGORY PICKER MODAL
      ────────────────────────────────────────────────────────────────── */}
      <Modal transparent visible={showExpCategoryPicker} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.82)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowExpCategoryPicker(false)}
          />
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 26,
              padding: 22,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.4,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowExpCategoryPicker(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8 }}>
              {EXPENSE_CATEGORIES.map((cat) => {
                const isSelected = txCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    activeOpacity={0.8}
                    onPress={() => {
                      setTxCategory(cat.name);
                      setShowExpCategoryPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      backgroundColor: isSelected ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: isSelected ? '#f43f5e' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={cat.icon as any} size={16} color={isSelected ? '#f43f5e' : 'rgba(255,255,255,0.6)'} />
                      <Text style={{ color: isSelected ? '#f43f5e' : '#fff', fontWeight: '800', fontSize: 13 }}>{cat.name}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#f43f5e" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────
           TRANSFER MODAL (Centered & Glassmorphic)
      ────────────────────────────────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={transferModalVisible}
        onRequestClose={() => setTransferModalVisible(false)}
        statusBarTranslucent
      >
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          paddingHorizontal: 16,
          paddingVertical: 20,
          zIndex: 9999,
        }}>
          <LinearGradient
            colors={['#0f172a', '#1e293b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: '100%',
              maxWidth: 410,
              alignSelf: 'center',
              borderRadius: 28,
              padding: 22,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.5,
              shadowRadius: 30,
              elevation: 20,
              maxHeight: '88%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>Transfer Money</Text>
              <TouchableOpacity
                onPress={() => setTransferModalVisible(false)}
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* From Account selection */}
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>FROM ACCOUNT</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              {accounts
                .filter(a => a.type !== 'Overall')
                .map((a) => {
                  const isSelected = transferFromId === a.id;
                  const iconName = a.type === 'MobileMoney' ? 'phone-portrait-outline' : a.type === 'Cards' ? 'card-outline' : 'cash-outline';
                  return (
                    <TouchableOpacity
                      key={a.id}
                      activeOpacity={0.8}
                      onPress={() => setTransferFromId(a.id)}
                      style={{
                        flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.04)',
                        borderWidth: 1, borderColor: isSelected ? '#6366f1' : 'rgba(255,255,255,0.08)'
                      }}
                    >
                      <View 
                        style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6, backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.05)' }}
                      >
                        <Ionicons name={iconName} size={15} color={isSelected ? '#818cf8' : 'rgba(255,255,255,0.5)'} />
                      </View>
                      <Text 
                        numberOfLines={1} 
                        style={{ fontSize: 11, fontWeight: '800', color: isSelected ? '#a5b4fc' : 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 2 }}
                      >
                        {a.name.split(' ')[0]}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: isSelected ? '#818cf8' : 'rgba(255,255,255,0.4)' }}>
                        ${a.balance.toFixed(0)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>

            {/* Separator Arrow */}
            <View style={{ alignItems: 'center', marginVertical: 4 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Ionicons name="arrow-down" size={14} color="#6366f1" />
              </View>
            </View>

            {/* To Account selection */}
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 }}>TO ACCOUNT</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
              {accounts
                .filter(a => a.type !== 'Overall')
                .map((a) => {
                  const isSelected = transferToId === a.id;
                  const iconName = a.type === 'MobileMoney' ? 'phone-portrait-outline' : a.type === 'Cards' ? 'card-outline' : 'cash-outline';
                  return (
                    <TouchableOpacity
                      key={a.id}
                      activeOpacity={0.8}
                      onPress={() => setTransferToId(a.id)}
                      style={{
                        flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSelected ? 'rgba(115, 242, 24, 0.15)' : 'rgba(255,255,255,0.04)',
                        borderWidth: 1, borderColor: isSelected ? '#73f218' : 'rgba(255,255,255,0.08)'
                      }}
                    >
                      <View 
                        style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6, backgroundColor: isSelected ? 'rgba(115, 242, 24, 0.25)' : 'rgba(255,255,255,0.05)' }}
                      >
                        <Ionicons name={iconName} size={15} color={isSelected ? '#73f218' : 'rgba(255,255,255,0.5)'} />
                      </View>
                      <Text 
                        numberOfLines={1} 
                        style={{ fontSize: 11, fontWeight: '800', color: isSelected ? '#73f218' : 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 2 }}
                      >
                        {a.name.split(' ')[0]}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: isSelected ? '#73f218' : 'rgba(255,255,255,0.4)' }}>
                        ${a.balance.toFixed(0)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>

            {/* Amount input wrapper */}
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>TRANSFER AMOUNT</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 22 }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, fontWeight: '900', marginRight: 6 }}>$</Text>
              <TextInput
                value={transferAmount}
                onChangeText={setTransferAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={{ flex: 1, color: '#fff', fontSize: 18, fontWeight: '900', padding: 0 }}
              />
            </View>

            {/* Submit Transfer Button */}
            <TouchableOpacity
              onPress={handleTransfer}
              activeOpacity={0.8}
              style={{ backgroundColor: '#6366f1', paddingVertical: 15, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Complete Transfer</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────
           ADD ACCOUNT MODAL (Centered & Glassmorphic)
      ────────────────────────────────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={accountModalVisible}
        onRequestClose={() => setAccountModalVisible(false)}
        statusBarTranslucent
      >
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          paddingHorizontal: 16,
          paddingVertical: 20,
          zIndex: 9999,
        }}>
          <LinearGradient
            colors={['#0f172a', '#1e293b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: '100%',
              maxWidth: 410,
              alignSelf: 'center',
              borderRadius: 28,
              padding: 22,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.5,
              shadowRadius: 30,
              elevation: 20,
              maxHeight: '88%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>Add Account Card</Text>
              <TouchableOpacity
                onPress={() => setAccountModalVisible(false)}
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, marginBottom: 20 }} showsVerticalScrollIndicator={false}>
              {/* Account Type selector */}
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>ACCOUNT TYPE</Text>
              <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                {(['Cards', 'MobileMoney', 'Cash'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setNewAccType(t)}
                    style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: newAccType === t ? 'rgba(115, 242, 24, 0.15)' : 'transparent', borderWidth: newAccType === t ? 1 : 0, borderColor: 'rgba(115, 242, 24, 0.3)' }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: newAccType === t ? '#73f218' : 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                      {t === 'Cards' ? 'Bank Card' : t === 'MobileMoney' ? 'Mobile Money' : 'Cash'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Account Name */}
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>ACCOUNT NAME</Text>
              <TextInput
                value={newAccName}
                onChangeText={setNewAccName}
                placeholder="e.g. Standard Chartered Wallet"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 16 }}
              />

              {/* Initial Balance */}
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>INITIAL BALANCE ($)</Text>
              <TextInput
                value={newAccBalance}
                onChangeText={setNewAccBalance}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 16 }}
              />

              {/* Bank / Provider Name (Conditional) */}
              {newAccType !== 'Cash' && (
                <>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>BANK OR PROVIDER NAME</Text>
                  <TextInput
                    value={newAccBank}
                    onChangeText={setNewAccBank}
                    placeholder="e.g. MTN or Bank of America"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 16 }}
                  />

                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>CARD OR WALLET NUMBER (LAST 4 DIGITS)</Text>
                  <TextInput
                    value={newAccNumber}
                    onChangeText={setNewAccNumber}
                    keyboardType="numeric"
                    maxLength={4}
                    placeholder="e.g. 5567"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 16 }}
                  />
                </>
              )}
            </ScrollView>

            {/* Create Account Button */}
            <TouchableOpacity
              onPress={handleCreateAccount}
              activeOpacity={0.8}
              style={{ backgroundColor: '#73f218', paddingVertical: 15, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#0f172a', fontSize: 15, fontWeight: '900' }}>Add Card Account</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────
           NOTIFICATIONS PANEL (Centered & Glassmorphic)
      ────────────────────────────────────────────────────────────────── */}
      <Modal transparent visible={showNotifications} animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(2, 6, 23, 0.82)', paddingHorizontal: 16 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={toggleNotifications}
          />
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: Math.min(SCREEN_WIDTH - 32, 410),
              borderRadius: 28,
              padding: 22,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.5,
              shadowRadius: 30,
              elevation: 20,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>Notifications & Alerts</Text>
                {(upcomingPayments.length > 0 || incomeNotifications.length > 0) && (
                  <View style={{ backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}>
                    <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800' }}>{upcomingPayments.length + incomeNotifications.length} New</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={toggleNotifications}
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {/* ⚠️ Warning Payments / Unpaid Bills */}
              {upcomingPayments.length > 0 && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                    ⚠️ Warning Payments ({upcomingPayments.length})
                  </Text>
                  {upcomingPayments.map((item, idx) => {
                    const isOverdue = item.daysLeft <= 0;
                    const isUrgent = item.daysLeft <= 3;
                    const badgeColor = isOverdue ? '#ef4444' : isUrgent ? '#f59e0b' : '#3b82f6';
                    return (
                      <TouchableOpacity
                        key={item.id || idx}
                        activeOpacity={0.8}
                        onPress={() => {
                          toggleNotifications();
                          handlePayBill(item);
                        }}
                        style={{
                          flexDirection: 'row', gap: 12, alignItems: 'center',
                          backgroundColor: isOverdue ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
                          padding: 12, borderRadius: 16, marginBottom: 8,
                          borderWidth: 1, borderColor: badgeColor + '40'
                        }}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: badgeColor + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: badgeColor + '50' }}>
                          <Ionicons name={isOverdue ? 'alert-circle-outline' : 'warning-outline'} size={20} color={badgeColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{item.title}</Text>
                            <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 13 }}>{formatAmount(item.amount)}</Text>
                          </View>
                          <Text style={{ color: isOverdue ? '#ef4444' : 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>
                            {isOverdue ? '⚠️ Payment Due Today / Overdue' : `Payment due in ${item.daysLeft} days`}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(115,242,24,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)' }}>
                          <Text style={{ color: '#73f218', fontSize: 10, fontWeight: '900' }}>PAY</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* 💵 Upcoming Incomes */}
              {incomeNotifications.length > 0 && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                    💰 Upcoming & Received Incomes ({incomeNotifications.length})
                  </Text>
                  {incomeNotifications.slice(0, 4).map((inc: any, idx: number) => (
                    <TouchableOpacity
                      key={inc.id || idx}
                      activeOpacity={0.8}
                      onPress={() => {
                        toggleNotifications();
                        navigation.navigate('AllTransactions');
                      }}
                      style={{
                        flexDirection: 'row', gap: 12, alignItems: 'center',
                        backgroundColor: 'rgba(115,242,24,0.04)',
                        padding: 12, borderRadius: 16, marginBottom: 8,
                        borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)'
                      }}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(115,242,24,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)' }}>
                        <Ionicons name="arrow-down-circle-outline" size={20} color="#73f218" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{inc.title}</Text>
                          <Text style={{ color: '#73f218', fontWeight: '900', fontSize: 13 }}>+{formatAmount(inc.amount)}</Text>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>
                          Expected income deposit • {inc.date || 'Scheduled'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Empty state */}
              {upcomingPayments.length === 0 && incomeNotifications.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Ionicons name="shield-checkmark-outline" size={36} color="rgba(255,255,255,0.3)" style={{ marginBottom: 8 }} />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>No Pending Alerts</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                    All warning payments are cleared and incomes are up to date!
                  </Text>
                </View>
              )}
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────
           NOTIFICATION DETAIL MODAL (Centered & Glassmorphic)
      ────────────────────────────────────────────────────────────────── */}
      <Modal transparent visible={!!selectedNotification} animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(2, 6, 23, 0.82)', paddingHorizontal: 16 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setSelectedNotification(null)}
          />
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: Math.min(SCREEN_WIDTH - 32, 410),
              borderRadius: 28,
              padding: 24,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.5,
              shadowRadius: 30,
              elevation: 20,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name={
                    selectedNotification?.type === 'payment' ? 'cash-outline' :
                    selectedNotification?.type === 'security' ? 'shield-half-outline' : 'trophy-outline'
                  }
                  size={20}
                  color={
                    selectedNotification?.type === 'payment' ? '#73f218' :
                    selectedNotification?.type === 'security' ? '#ef4444' : '#60a5fa'
                  }
                />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
                  {selectedNotification?.type === 'payment' ? 'Transaction Receipt' :
                   selectedNotification?.type === 'security' ? 'Security Alert' : 'Achievement Unlocked'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedNotification(null)}
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Inner Content based on type */}
            {selectedNotification?.type === 'payment' && (
              <View style={{ alignItems: 'center', gap: 16 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(115,242,24,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)' }}>
                  <Ionicons name="checkmark-circle-outline" size={36} color="#73f218" />
                </View>

                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' }}>Amount Received</Text>
                  <Text style={{ color: '#73f218', fontSize: 32, fontWeight: '900', marginTop: 4 }}>
                    {selectedNotification.amount}
                  </Text>
                </View>

                <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Sender</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{selectedNotification.from}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Date & Time</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{selectedNotification.date}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Account Credited</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{selectedNotification.account}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Ref ID</Text>
                    <Text style={{ color: '#73f218', fontSize: 13, fontWeight: '800' }}>{selectedNotification.reference}</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => setSelectedNotification(null)}
                  style={{ width: '100%', backgroundColor: '#73f218', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 4 }}
                >
                  <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Close Receipt</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedNotification?.type === 'security' && (
              <View style={{ alignItems: 'center', gap: 16 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
                  <Ionicons name="warning-outline" size={32} color="#ef4444" />
                </View>

                <View style={{ alignItems: 'center', paddingHorizontal: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' }}>
                    New Login Detected
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                    A new sign-in attempt was recorded on your account from an unrecognized device.
                  </Text>
                </View>

                <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Device</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{selectedNotification.device}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Location</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{selectedNotification.location}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>IP Address</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{selectedNotification.ip}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Time</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{selectedNotification.date}</Text>
                  </View>
                </View>

                <View style={{ width: '100%', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert("Activity Confirmed", "Thank you for confirming. We've registered this device as trusted.");
                      setSelectedNotification(null);
                    }}
                    style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>It Was Me</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert("Account Secured", "We have logged out other sessions and locked your debit cards temporarily. Check your email to reset your security PIN.");
                      setSelectedNotification(null);
                    }}
                    style={{ width: '100%', backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>No, Secure My Account</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {selectedNotification?.type === 'goal' && (
              <View style={{ alignItems: 'center', gap: 16 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(96,165,250,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)' }}>
                  <Ionicons name="star" size={32} color="#60a5fa" />
                </View>

                <View style={{ alignItems: 'center', paddingHorizontal: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' }}>
                    Goal Completed! 🎉
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                    {selectedNotification.details}
                  </Text>
                </View>

                <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Goal Name</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{selectedNotification.goalName}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Amount Saved</Text>
                    <Text style={{ color: '#73f218', fontSize: 13, fontWeight: '900' }}>{selectedNotification.targetAmount}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Achieved</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{selectedNotification.achievedDate}</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => setSelectedNotification(null)}
                  style={{ width: '100%', backgroundColor: '#60a5fa', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 4 }}
                >
                  <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Awesome!</Text>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
           OCR SMART RECEIPT SCANNER MODAL
      ────────────────────────────────────────────────────────────── */}
      <Modal visible={ocrModalVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.88)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOcrModalVisible(false)} />
          <View style={{ backgroundColor: 'rgba(15, 23, 42, 0.98)', borderRadius: 28, padding: 22, borderWidth: 1.5, borderColor: 'rgba(168, 85, 247, 0.4)', width: '100%', maxWidth: 480 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LinearGradient colors={['#a855f7', '#7e22ce']} style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                </LinearGradient>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>AI Receipt OCR Scanner</Text>
              </View>
              <TouchableOpacity onPress={() => setOcrModalVisible(false)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {isScanningReceipt ? (
              <View style={{ alignItems: 'center', paddingVertical: 30, gap: 14 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(168, 85, 247, 0.15)', borderWidth: 2, borderColor: '#a855f7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="scan-outline" size={36} color="#a855f7" />
                </View>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>AI Processing Receipt OCR...</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' }}>
                  Extracting Merchant Name, Date, Category & Total Amount...
                </Text>

                {/* Progress Bar */}
                <View style={{ width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginTop: 10 }}>
                  <View style={{ width: `${scanProgress}%`, height: '100%', backgroundColor: '#a855f7', borderRadius: 4 }} />
                </View>
              </View>
            ) : (
              <>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 14, lineHeight: 18 }}>
                  Select or capture a receipt to instantly parse line items, tax-deductible status, and merchant details!
                </Text>

                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 }}>
                  SAMPLE RECEIPTS TO SCAN
                </Text>

                <View style={{ gap: 8, marginBottom: 16 }}>
                  {MOCK_RECEIPTS.map((rc, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => handleSimulateOCRScan(rc)}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(168, 85, 247, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={rc.icon as any} size={16} color="#a855f7" />
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{rc.merchant}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 1 }}>{rc.category} · {rc.date}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: '#73f218', fontSize: 13, fontWeight: '900' }}>${rc.amount}</Text>
                        {rc.taxDeductible && (
                          <Text style={{ color: '#06b6d4', fontSize: 9, fontWeight: '900', marginTop: 2 }}>#Deductible</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => handleSimulateOCRScan(MOCK_RECEIPTS[0])}
                  style={{ borderRadius: 14, overflow: 'hidden' }}
                >
                  <LinearGradient
                    colors={['#a855f7', '#7e22ce']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}
                  >
                    <Ionicons name="camera-outline" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Simulate Camera Scan</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── BILL DETAIL MODAL ─── */}
      <Modal visible={!!selectedBillDetail} animationType="slide" transparent onRequestClose={() => setSelectedBillDetail(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.75)' }}>
          <View style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            {selectedBillDetail && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(115,242,24,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)' }}>
                      <Ionicons name={selectedBillDetail.icon as any} size={22} color="#73f218" />
                    </View>
                    <View>
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{selectedBillDetail.title}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>Upcoming Subscription / Bill</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedBillDetail(null)} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 6 }}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 20, gap: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700' }}>AMOUNT DUE</Text>
                    <Text style={{ color: '#73f218', fontSize: 20, fontWeight: '900' }}>{formatAmount(selectedBillDetail.amount)}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700' }}>DUE TIMELINE</Text>
                    <Text style={{ color: selectedBillDetail.daysLeft <= 3 ? '#ef4444' : '#fff', fontSize: 13, fontWeight: '800' }}>Due in {selectedBillDetail.daysLeft} days</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700' }}>PAYMENT METHOD</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{activeAccount.name} ({formatAmount(activeAccount.balance)})</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handlePayBill(selectedBillDetail)}
                  activeOpacity={0.85}
                  style={{ backgroundColor: '#73f218', paddingVertical: 15, borderRadius: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: '#0f172a', fontSize: 15, fontWeight: '900' }}>Pay Bill Now ({formatAmount(selectedBillDetail.amount)})</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── CUSTOM BILL PAYMENT CONFIRMATION MODAL (PREMIUM UI/UX) ─── */}
      <Modal visible={!!pendingBillPayment} animationType="fade" transparent onRequestClose={() => setPendingBillPayment(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <View style={{
            width: Math.min(SCREEN_WIDTH - 32, 420),
            backgroundColor: '#0f172a',
            borderRadius: 28,
            padding: 24,
            borderWidth: 1.5,
            borderColor: 'rgba(115, 242, 24, 0.3)',
            shadowColor: '#73f218',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 15,
          }}>
            {pendingBillPayment && (
              <>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(115, 242, 24, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#73f218' }}>
                      <Ionicons name="card-outline" size={18} color="#73f218" />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Confirm Payment</Text>
                  </View>
                  <TouchableOpacity onPress={() => setPendingBillPayment(null)} style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 6 }}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Main Payment Details */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 20, gap: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(165, 180, 252, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(165, 180, 252, 0.3)' }}>
                      <Ionicons name={pendingBillPayment.icon as any} size={22} color="#a5b4fc" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{pendingBillPayment.title}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>Due in {pendingBillPayment.daysLeft} days</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#73f218', fontSize: 18, fontWeight: '900' }}>{formatAmount(pendingBillPayment.amount)}</Text>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />

                  {/* Payment Source */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>PAYING FROM</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="wallet-outline" size={16} color="#73f218" />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{activeAccount.name}</Text>
                      </View>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '800' }}>{formatAmount(activeAccount.balance)}</Text>
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => setPendingBillPayment(null)}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '800' }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => executeBillPayment(pendingBillPayment)}
                    activeOpacity={0.85}
                    style={{ flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: '#73f218' }}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#0f172a" />
                    <Text style={{ color: '#0f172a', fontSize: 14, fontWeight: '900' }}>Confirm Pay</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
