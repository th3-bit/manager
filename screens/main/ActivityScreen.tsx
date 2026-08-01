import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, StatusBar, Modal, Dimensions, Alert, Platform, Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTransactions } from '../../context/TransactionContext';
import { useCurrency } from '../../context/CurrencyContext';

const { width: SW } = Dimensions.get('window');

// ─── MOCK DATA FOR ACTIVITY SCREEN ──────────────────────────────────────────

const TIME_RANGES = ['Today', 'This Week', 'This Month', '3 Months', 'This Year'];

const INITIAL_ACTIVITIES = [
  { id: 'act-1', title: 'Whole Foods Market', date: 'Today, 10:15 AM', rawDate: '2026-07-22', amount: 84.50, isIncome: false, type: 'Expense', category: 'Food', icon: 'fast-food-outline', color: '#f59e0b', method: 'Visa ending 4242' },
  { id: 'act-2', title: 'Monthly Salary Deposit', date: 'Today, 09:00 AM', rawDate: '2026-07-22', amount: 3500.00, isIncome: true, type: 'Income', category: 'Income', icon: 'cash-outline', color: '#73f218', method: 'Direct Deposit' },
  { id: 'act-3', title: 'Adobe Creative Cloud', date: 'Yesterday, 03:22 PM', rawDate: '2026-07-21', amount: 130.50, isIncome: false, type: 'Expense', category: 'Subscription', icon: 'color-palette-outline', color: '#ec4899', method: 'Mastercard 8812' },
  { id: 'act-4', title: 'Gas Station Fuel', date: 'Yesterday, 06:30 PM', rawDate: '2026-07-21', amount: 45.00, isIncome: false, type: 'Expense', category: 'Transport', icon: 'car-outline', color: '#6366f1', method: 'Debit Card' },
  { id: 'act-5', title: 'Freelance Design Payout', date: 'Jul 19, 04:00 PM', rawDate: '2026-07-19', amount: 450.00, isIncome: true, type: 'Income', category: 'Income', icon: 'laptop-outline', color: '#73f218', method: 'PayPal' },
  { id: 'act-6', title: 'Transfer to Emergency Vault', date: 'Jul 18, 02:15 PM', rawDate: '2026-07-18', amount: 300.00, isIncome: false, type: 'Transfer', category: 'Savings', icon: 'swap-horizontal-outline', color: '#3b82f6', method: 'Internal Transfer' },
  { id: 'act-7', title: 'Apartment Rent Payment', date: 'Jul 15, 09:00 AM', rawDate: '2026-07-15', amount: 1000.00, isIncome: false, type: 'Expense', category: 'Housing', icon: 'home-outline', color: '#14b8a6', method: 'Bank ACH' },
  { id: 'act-8', title: 'Netflix Subscription', date: 'Jul 12, 11:30 AM', rawDate: '2026-07-12', amount: 15.99, isIncome: false, type: 'Expense', category: 'Subscription', icon: 'tv-outline', color: '#ec4899', method: 'Visa 4242' },
  { id: 'act-9', title: 'H&M Clothing Purchase', date: 'Jul 10, 02:40 PM', rawDate: '2026-07-10', amount: 110.00, isIncome: false, type: 'Expense', category: 'Shopping', icon: 'shirt-outline', color: '#a855f7', method: 'Apple Pay' },
  { id: 'act-10', title: 'Dividend Yield Income', date: 'Jul 05, 08:00 AM', rawDate: '2026-07-05', amount: 80.25, isIncome: true, type: 'Income', category: 'Income', icon: 'trending-up-outline', color: '#73f218', method: 'Brokerage' },
];

const CATEGORY_COLORS: { [key: string]: string } = {
  Housing: '#14b8a6',
  Food: '#f59e0b',
  Savings: '#3b82f6',
  Subscription: '#ec4899',
  Shopping: '#a855f7',
  Transport: '#6366f1',
  Income: '#73f218',
};

// Helper to check if item belongs to selected range
const matchesRange = (dateStr: string, range: string) => {
  if (range === 'Today') return dateStr.startsWith('Today');
  if (range === 'This Week') return dateStr.startsWith('Today') || dateStr.startsWith('Yesterday') || dateStr.includes('Jul 19') || dateStr.includes('Jul 18');
  if (range === 'This Month') return true;
  if (range === '3 Months' || range === 'This Year') return true;
  return true;
};

// Helper to categorize transaction date group
const getDateGroup = (dateStr: string) => {
  if (dateStr.startsWith('Today')) return 'Today';
  if (dateStr.startsWith('Yesterday')) return 'Yesterday';
  if (dateStr.includes('Jul 19') || dateStr.includes('Jul 18') || dateStr.includes('Jul 15')) return 'This Week';
  return 'Earlier This Month';
};

export function ActivityScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  // Filter States
  const [selectedRange, setSelectedRange] = useState('This Month');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Income' | 'Expense' | 'Transfer'>('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest'>('newest');

  // Modals
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const { transactions: globalTx, deleteTransaction } = useTransactions();
  const { formatAmount, currency } = useCurrency();
  const [selectedInsight, setSelectedInsight] = useState<any | null>(null);
  const [selectedBarDetails, setSelectedBarDetails] = useState<any | null>(null);

  const activitiesList = globalTx.map(t => ({
    id: t.id,
    title: t.title,
    date: t.date,
    rawDate: t.rawDate || '2026-07-27',
    amount: t.amount,
    isIncome: t.isIncome,
    type: t.type || (t.isIncome ? 'Income' : 'Expense'),
    category: t.category || 'General',
    icon: t.icon || (t.isIncome ? 'cash-outline' : 'card-outline'),
    color: t.color || (t.isIncome ? '#73f218' : '#ef4444'),
    method: t.method || 'Digital Payment',
  }));

  // 1. Filtered by selected time range chip
  const rangeActivities = useMemo(() => {
    return activitiesList.filter(a => matchesRange(a.date, selectedRange));
  }, [activitiesList, selectedRange]);

  // 2. Compute Totals for the selected time range
  const totalIncome = useMemo(() => {
    return rangeActivities.filter(a => a.isIncome).reduce((acc, curr) => acc + curr.amount, 0);
  }, [rangeActivities]);

  const totalExpense = useMemo(() => {
    return rangeActivities.filter(a => !a.isIncome && a.type !== 'Transfer').reduce((acc, curr) => acc + curr.amount, 0);
  }, [rangeActivities]);

  const netFlow = totalIncome - totalExpense;

  // 3. Dynamic Category Breakdown for the selected time range
  const dynamicCategoryBreakdown = useMemo(() => {
    const expensesOnly = rangeActivities.filter(a => !a.isIncome);
    const catMap: { [key: string]: number } = {};
    let totalCatExpense = 0;

    expensesOnly.forEach(a => {
      catMap[a.category] = (catMap[a.category] || 0) + a.amount;
      totalCatExpense += a.amount;
    });

    if (totalCatExpense === 0) return [];

    return Object.keys(catMap).map(catName => ({
      name: catName,
      amount: catMap[catName],
      color: CATEGORY_COLORS[catName] || '#94a3b8',
      pct: Math.round((catMap[catName] / totalCatExpense) * 100)
    })).sort((a, b) => b.amount - a.amount);
  }, [rangeActivities]);

  // 4. Dynamic Quick Insights for the selected time range
  const quickInsights = useMemo(() => {
    const incomes = rangeActivities.filter(a => a.isIncome).sort((a, b) => b.amount - a.amount);
    const expenses = rangeActivities.filter(a => !a.isIncome && a.type !== 'Transfer').sort((a, b) => b.amount - a.amount);
    const topCat = dynamicCategoryBreakdown[0];

    return [
      { title: 'Highest Income', val: incomes.length > 0 ? `${incomes[0].title} · ${formatAmount(incomes[0].amount)}` : 'None logged', icon: 'arrow-down-circle', color: '#73f218' },
      { title: 'Largest Expense', val: expenses.length > 0 ? `${expenses[0].title} · ${formatAmount(expenses[0].amount)}` : 'None logged', icon: 'arrow-up-circle', color: '#ef4444' },
      { title: 'Active Transactions', val: `${rangeActivities.length} Txns (${selectedRange})`, icon: 'calendar-outline', color: '#3b82f6' },
      { title: 'Top Category', val: topCat ? `${topCat.name} (${topCat.pct}%)` : 'N/A', icon: 'pie-chart-outline', color: '#a855f7' }
    ];
  }, [rangeActivities, selectedRange, dynamicCategoryBreakdown, formatAmount]);

  // 5. Final Filtered & Sorted Activities list
  const filteredActivities = useMemo(() => {
    return rangeActivities
      .filter(act => {
        const matchesQuery = searchQuery.trim() === '' ||
          act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          act.category.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = filterType === 'All' ? true : act.type === filterType;
        const matchesCategory = selectedCategoryFilter === 'All' ? true : act.category === selectedCategoryFilter;

        return matchesQuery && matchesType && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'highest') return b.amount - a.amount;
        if (sortBy === 'oldest') return a.id.localeCompare(b.id);
        return b.id.localeCompare(a.id);
      });
  }, [rangeActivities, searchQuery, filterType, selectedCategoryFilter, sortBy]);

  // 6. Grouped Activities by Date
  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: typeof INITIAL_ACTIVITIES } = {};
    filteredActivities.forEach(act => {
      const groupKey = getDateGroup(act.date);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(act);
    });
    return groups;
  }, [filteredActivities]);

  const handleDeleteActivity = (id: string) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this activity record? This will remove it permanently and update your financial balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteTransaction(id);
            setSelectedActivity(null);
          }
        }
      ]
    );
  };

  const handleExportReceipt = (activity: any) => {
    const receiptHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${activity.title}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; background: #070d1a; color: #fff; }
    .card { background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 30px; max-width: 400px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px; margin-bottom: 20px; }
    .title { font-size: 20px; font-weight: bold; margin-top: 10px; }
    .amount { font-size: 32px; font-weight: 900; margin-top: 5px; color: ${activity.isIncome ? '#73f218' : '#ef4444'}; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; }
    .label { color: rgba(255,255,255,0.5); }
    .val { font-weight: bold; }
    .footer { text-align: center; font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="font-size: 11px; color: #73f218; letter-spacing: 1px; font-weight: bold;">FINANCE MANAGER OFFICIAL RECEIPT</div>
      <div class="title">${activity.title}</div>
      <div class="amount">${activity.isIncome ? '+' : '-'}${formatAmount(activity.amount)}</div>
    </div>
    <div class="row"><span class="label">Date & Time</span><span class="val">${activity.date}</span></div>
    <div class="row"><span class="label">Category</span><span class="val">${activity.category}</span></div>
    <div class="row"><span class="label">Payment Method</span><span class="val">${activity.method}</span></div>
    <div class="row"><span class="label">Status</span><span class="val" style="color: #73f218;">✓ Completed</span></div>
    <div class="row"><span class="label">Reference ID</span><span class="val">${activity.id}</span></div>
    <div class="footer">Thank you for using Finance Manager • Certified Digital Receipt</div>
  </div>
</body>
</html>`;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([receiptHTML], { type: 'text/html;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Receipt_${activity.title.replace(/ /g, '_')}.html`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      Alert.alert('Receipt Exported', `Digital receipt for "${activity.title}" saved to your downloads.`);
    } else {
      Share.share({
        title: `Receipt - ${activity.title}`,
        message: `🧾 Official Receipt: ${activity.title}\nAmount: ${activity.isIncome ? '+' : '-'}${formatAmount(activity.amount)}\nDate: ${activity.date}\nCategory: ${activity.category}\nPayment Method: ${activity.method}\nStatus: Completed`,
      });
    }
  };

  // Helper to parse transaction date safely
  const parseTxDate = (t: any): Date => {
    if (t.rawDate) {
      const d = new Date(t.rawDate);
      if (!isNaN(d.getTime())) return d;
    }
    if (t.date) {
      if (t.date.startsWith('Today')) return new Date();
      if (t.date.startsWith('Yesterday')) {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
      }
      const parsed = new Date(t.date);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  };

  // 7. Dynamic Chart Data Points with ACCURATE matched transactions & sums
  const chartDataPoints = useMemo(() => {
    if (selectedRange === 'Today') {
      const timeSlots = [
        { label: '08:00', minH: 0, maxH: 9 },
        { label: '10:00', minH: 9, maxH: 11 },
        { label: '12:00', minH: 11, maxH: 13 },
        { label: '14:00', minH: 13, maxH: 15 },
        { label: '16:00', minH: 15, maxH: 17 },
        { label: '18:00', minH: 17, maxH: 24 },
      ];

      return timeSlots.map(slot => {
        const txs = rangeActivities.filter(a => {
          const d = parseTxDate(a);
          const h = d.getHours();
          return h >= slot.minH && h < slot.maxH;
        });
        const inc = txs.filter(a => a.isIncome).reduce((acc, curr) => acc + curr.amount, 0);
        const exp = txs.filter(a => !a.isIncome && a.type !== 'Transfer').reduce((acc, curr) => acc + curr.amount, 0);
        return { label: slot.label, inc, exp, net: inc - exp, txs };
      });
    }

    if (selectedRange === 'This Week') {
      const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return weekdays.map((w, idx) => {
        const txs = rangeActivities.filter(a => {
          const d = parseTxDate(a);
          const dayIdx = (d.getDay() + 6) % 7; // Mon=0, Sun=6
          return dayIdx === idx;
        });
        const inc = txs.filter(a => a.isIncome).reduce((acc, curr) => acc + curr.amount, 0);
        const exp = txs.filter(a => !a.isIncome && a.type !== 'Transfer').reduce((acc, curr) => acc + curr.amount, 0);
        return { label: w, inc, exp, net: inc - exp, txs };
      });
    }

    if (selectedRange === 'This Month') {
      const weeks = [
        { label: 'Week 1', start: 1, end: 7 },
        { label: 'Week 2', start: 8, end: 14 },
        { label: 'Week 3', start: 15, end: 21 },
        { label: 'Week 4', start: 22, end: 31 }
      ];
      return weeks.map(w => {
        const txs = rangeActivities.filter(a => {
          const dayNum = parseTxDate(a).getDate();
          return dayNum >= w.start && dayNum <= w.end;
        });
        const inc = txs.filter(a => a.isIncome).reduce((acc, curr) => acc + curr.amount, 0);
        const exp = txs.filter(a => !a.isIncome && a.type !== 'Transfer').reduce((acc, curr) => acc + curr.amount, 0);
        return { label: w.label, inc, exp, net: inc - exp, txs };
      });
    }

    if (selectedRange === '3 Months') {
      const now = new Date();
      const currM = now.getMonth();
      const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const targetMonths = [(currM - 2 + 12) % 12, (currM - 1 + 12) % 12, currM];

      return targetMonths.map(mIdx => {
        const txs = rangeActivities.filter(a => parseTxDate(a).getMonth() === mIdx);
        const inc = txs.filter(a => a.isIncome).reduce((acc, curr) => acc + curr.amount, 0);
        const exp = txs.filter(a => !a.isIncome && a.type !== 'Transfer').reduce((acc, curr) => acc + curr.amount, 0);
        return { label: mNames[mIdx], inc, exp, net: inc - exp, txs };
      });
    }

    // This Year (Quarters)
    const quarters = [
      { label: 'Q1', months: [0, 1, 2] },
      { label: 'Q2', months: [3, 4, 5] },
      { label: 'Q3', months: [6, 7, 8] },
      { label: 'Q4', months: [9, 10, 11] },
    ];

    return quarters.map(q => {
      const txs = rangeActivities.filter(a => q.months.includes(parseTxDate(a).getMonth()));
      const inc = txs.filter(a => a.isIncome).reduce((acc, curr) => acc + curr.amount, 0);
      const exp = txs.filter(a => !a.isIncome && a.type !== 'Transfer').reduce((acc, curr) => acc + curr.amount, 0);
      return { label: q.label, inc, exp, net: inc - exp, txs };
    });
  }, [rangeActivities, selectedRange]);

  const maxNetFlowVal = useMemo(() => {
    const maxVal = Math.max(...chartDataPoints.map(d => Math.abs(d.net)));
    return maxVal === 0 ? 1 : maxVal;
  }, [chartDataPoints]);

  return (
    <View style={{ flex: 1, backgroundColor: '#070d1a' }}>
      <StatusBar barStyle="light-content" />

      {/* Decorative Background Glows */}
      <View style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(115,242,24,0.08)' }} />
      <View style={{ position: 'absolute', top: 200, left: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(59,130,246,0.06)' }} />

      {/* ─── Header ─── */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#070d1a' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>Activity Hub</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', marginTop: 1 }}>
              Showing: <Text style={{ color: '#73f218', fontWeight: '800' }}>{selectedRange}</Text>
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setFilterModalVisible(true)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(115,242,24,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)' }}
            >
              <Ionicons name="options-outline" size={18} color="#73f218" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Horizontal Time Range Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TIME_RANGES.map(tr => {
            const active = selectedRange === tr;
            return (
              <TouchableOpacity
                key={tr}
                onPress={() => setSelectedRange(tr)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: active ? '#73f218' : 'rgba(255,255,255,0.05)',
                  borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.08)'
                }}
              >
                <Text style={{ color: active ? '#070d1a' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '900' }}>{tr}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90, gap: 18 }}>

        {/* ─── Hero Summary Card ─── */}
        <LinearGradient
          colors={['#111827', '#1e293b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)' }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700' }}>NET FLOW ({selectedRange.toUpperCase()})</Text>
              <Text style={{ color: netFlow >= 0 ? '#73f218' : '#ef4444', fontSize: 26, fontWeight: '900', marginTop: 2 }}>
                {netFlow >= 0 ? `+${formatAmount(netFlow)}` : `-${formatAmount(Math.abs(netFlow))}`}
              </Text>
            </View>
            <View style={{ backgroundColor: 'rgba(115,242,24,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(115,242,24,0.25)' }}>
              <Text style={{ color: '#73f218', fontSize: 10, fontWeight: '800' }}>⚡ Live Update</Text>
            </View>
          </View>

          {/* Flow Split Row */}
          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 16, marginBottom: 14 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(115,242,24,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-down" size={16} color="#73f218" />
              </View>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700' }}>Money In</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 1 }}>+{formatAmount(totalIncome)}</Text>
              </View>
            </View>

            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />

            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-up" size={16} color="#ef4444" />
              </View>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700' }}>Money Out</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 1 }}>-{formatAmount(totalExpense)}</Text>
              </View>
            </View>
          </View>

          {/* Mini Sparkline Chart */}
          <View style={{ height: 45, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 6 }}>
            {[35, 60, 25, 90, 40, 110, 80, 140, 95, 170, 120, 190].map((h, idx) => (
              <View key={idx} style={{ width: 6, height: (h / 190) * 38, backgroundColor: (selectedRange === 'Today' && idx > 5) ? '#73f218' : 'rgba(255,255,255,0.2)', borderRadius: 3 }} />
            ))}
          </View>
        </LinearGradient>

        {/* ─── Activity Overview Chart Section ─── */}
        <View style={{ backgroundColor: '#111827', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                {chartType === 'bar' ? 'Bar View (Income vs Expense)' : `Trend Line — Net Flow (${selectedRange})`}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                Net Flow for <Text style={{ color: '#73f218', fontWeight: '700' }}>{selectedRange}</Text>
              </Text>
            </View>

            {/* Toggle Bar / Line Button */}
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <TouchableOpacity
                onPress={() => setChartType('bar')}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9,
                  backgroundColor: chartType === 'bar' ? '#73f218' : 'transparent',
                  flexDirection: 'row', alignItems: 'center', gap: 4
                }}
              >
                <Ionicons name="bar-chart" size={14} color={chartType === 'bar' ? '#070d1a' : 'rgba(255,255,255,0.5)'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setChartType('line')}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9,
                  backgroundColor: chartType === 'line' ? '#73f218' : 'transparent',
                  flexDirection: 'row', alignItems: 'center', gap: 4
                }}
              >
                <Ionicons name="stats-chart" size={14} color={chartType === 'line' ? '#070d1a' : 'rgba(255,255,255,0.5)'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* DUAL MODE CHART RENDERING */}
          {chartType === 'bar' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120, paddingTop: 10 }}>
              {chartDataPoints.map((dp, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedBarDetails({ label: dp.label, inc: dp.inc, exp: dp.exp, net: dp.net, txs: dp.txs })}
                  activeOpacity={0.7}
                  style={{ alignItems: 'center', gap: 6, paddingHorizontal: 6 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
                    <View style={{ width: 6, height: Math.max(4, Math.min(70, (dp.inc / maxNetFlowVal) * 70)), backgroundColor: '#73f218', borderRadius: 3 }} />
                    <View style={{ width: 6, height: Math.max(4, Math.min(70, (dp.exp / maxNetFlowVal) * 70)), backgroundColor: '#ef4444', borderRadius: 3 }} />
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '700' }}>{dp.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={{ height: 120, paddingTop: 10, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', flex: 1 }}>
                {chartDataPoints.map((dp, i) => {
                  const isPositive = dp.net >= 0;
                  const nodeHeight = Math.max(12, Math.min(70, (Math.abs(dp.net) / maxNetFlowVal) * 70));
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setSelectedBarDetails({ label: dp.label, inc: dp.inc, exp: dp.exp, net: dp.net, txs: dp.txs })}
                      activeOpacity={0.7}
                      style={{ alignItems: 'center', justifyContent: 'flex-end', height: '100%', paddingHorizontal: 4 }}
                    >
                      <Text style={{ color: isPositive ? '#73f218' : '#ef4444', fontSize: 8, fontWeight: '900', marginBottom: 4 }}>
                        {dp.net >= 0 ? `+${formatAmount(dp.net)}` : `-${formatAmount(Math.abs(dp.net))}`}
                      </Text>
                      <View style={{ width: 2, height: nodeHeight, backgroundColor: isPositive ? 'rgba(115,242,24,0.35)' : 'rgba(239,68,68,0.35)', borderRadius: 1 }} />
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isPositive ? '#73f218' : '#ef4444', borderWidth: 2, borderColor: '#0f172a', marginTop: -5 }} />
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '700', marginTop: 6 }}>{dp.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 10 }}>
            {chartType === 'bar' ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#73f218' }} />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' }}>Money In (Income)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' }}>Money Out (Expense)</Text>
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#73f218' }} />
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' }}>Net Flow Trend ({selectedRange}: Income − Expense)</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── Dynamic Quick Stats Strip (Interactive) ─── */}
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Quick Insights ({selectedRange})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {quickInsights.map((st, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedInsight(st)}
              activeOpacity={0.7}
              style={{ width: 160, backgroundColor: '#111827', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: st.color + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Ionicons name={st.icon as any} size={16} color={st.color} />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700' }}>{st.title}</Text>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', marginTop: 3 }} numberOfLines={1}>{st.val}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ─── Dynamic Category Breakdown Section ─── */}
        <View style={{ backgroundColor: '#111827', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Spending by Category</Text>
            <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '800' }}>{selectedRange}</Text>
          </View>

          {dynamicCategoryBreakdown.length === 0 ? (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', paddingVertical: 10 }}>No expense categories for this timeframe.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {dynamicCategoryBreakdown.map((cat, idx) => (
                <View key={idx}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{cat.name}</Text>
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800' }}>{formatAmount(cat.amount)} <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>({cat.pct}%)</Text></Text>
                  </View>

                  <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <View style={{ width: `${cat.pct}%`, height: '100%', backgroundColor: cat.color, borderRadius: 3 }} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ─── Smart Alerts / Flags ─── */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Smart Alerts</Text>
          {filteredActivities.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(59,130,246,0.08)', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
              <Ionicons name="information-circle-outline" size={18} color="#3b82f6" />
              <Text style={{ flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 16, fontWeight: '600' }}>
                No activity recorded for this period. Add your first transaction to generate smart alerts!
              </Text>
            </View>
          ) : (
            <>
              {totalExpense > totalIncome && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(245,158,11,0.08)', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' }}>
                  <Ionicons name="warning-outline" size={18} color="#f59e0b" />
                  <Text style={{ flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 16, fontWeight: '600' }}>
                    Outflow ({formatAmount(totalExpense)}) exceeded inflow ({formatAmount(totalIncome)}) in this period.
                  </Text>
                </View>
              )}
              {totalIncome >= totalExpense && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(115,242,24,0.08)', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)' }}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#73f218" />
                  <Text style={{ flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 16, fontWeight: '600' }}>
                    Positive net flow of <Text style={{ color: '#73f218', fontWeight: '800' }}>{formatAmount(netFlow)}</Text> maintained for this period.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ─── Activity Log / Feed ─── */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Activity Feed ({filteredActivities.length})</Text>
            <TouchableOpacity onPress={() => setFilterModalVisible(true)}>
              <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '800' }}>Filter</Text>
            </TouchableOpacity>
          </View>

          {Object.keys(groupedActivities).length === 0 ? (
            <View style={{ backgroundColor: '#111827', borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Ionicons name="search-outline" size={32} color="rgba(255,255,255,0.2)" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 8 }}>No activities for "{selectedRange}"</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 4 }}>Try selecting another time chip like "This Month" or "This Year".</Text>
            </View>
          ) : (
            Object.keys(groupedActivities).map(groupName => (
              <View key={groupName} style={{ marginBottom: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' }}>
                  {groupName}
                </Text>

                <View style={{ gap: 8 }}>
                  {groupedActivities[groupName].map(act => (
                    <TouchableOpacity
                      key={act.id}
                      onPress={() => setSelectedActivity(act)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        backgroundColor: '#111827', padding: 14, borderRadius: 16,
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: act.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={act.icon as any} size={18} color={act.color} />
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{act.title}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{act.date.split(',')[1] || act.date}</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.2)' }}>•</Text>
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700' }}>{act.category}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: act.isIncome ? '#73f218' : act.type === 'Transfer' ? '#3b82f6' : '#ef4444', fontSize: 14, fontWeight: '900' }}>
                          {act.isIncome ? '+' : act.type === 'Transfer' ? '' : '-'}{formatAmount(act.amount)}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, marginTop: 2 }}>{act.type}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* ─── QUICK INSIGHT DETAIL MODAL (Centered & Glassmorphic) ─── */}
      <Modal visible={!!selectedInsight} animationType="fade" transparent onRequestClose={() => setSelectedInsight(null)} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(2, 6, 23, 0.82)', paddingHorizontal: 16, paddingVertical: 20 }}>
          {selectedInsight && (
            <LinearGradient
              colors={['#0f172a', '#1e293b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: Math.min(SW - 32, 400),
                maxHeight: '85%',
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
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: selectedInsight.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={selectedInsight.icon} size={18} color={selectedInsight.color} />
                  </View>
                  <View>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{selectedInsight.title}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600' }}>Insight for {selectedRange}</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => setSelectedInsight(null)} style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* 1. HIGHEST INCOME */}
              {selectedInsight.title === 'Highest Income' && (() => {
                const rankedIncomes = rangeActivities.filter(a => a.isIncome).sort((a, b) => b.amount - a.amount);
                const topInc = rankedIncomes[0];
                const topPct = (topInc && totalIncome > 0) ? Math.round((topInc.amount / totalIncome) * 100) : 0;

                return (
                  <View style={{ gap: 14 }}>
                    {topInc ? (
                      <View style={{ backgroundColor: 'rgba(115,242,24,0.08)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800' }}>TOP EARNING ENTRY</Text>
                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 4 }}>{topInc.title}</Text>
                        <Text style={{ color: '#73f218', fontSize: 24, fontWeight: '900', marginTop: 2 }}>+{formatAmount(topInc.amount)}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 }}>
                          Represents <Text style={{ color: '#73f218', fontWeight: '800' }}>{topPct}%</Text> of all income in this timeframe ({selectedRange}).
                        </Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, alignItems: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No income logged for {selectedRange}</Text>
                      </View>
                    )}

                    {rankedIncomes.length > 0 && (
                      <>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>RANKED INCOME BREAKDOWN</Text>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                          {rankedIncomes.slice(0, 3).map((item, idx) => (
                            <View key={item.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                                {idx + 1}. {item.title}
                              </Text>
                              <Text style={{ color: '#73f218', fontSize: 13, fontWeight: '900' }}>+{formatAmount(item.amount)}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                );
              })()}

              {/* 2. LARGEST EXPENSE */}
              {selectedInsight.title === 'Largest Expense' && (() => {
                const rankedExpenses = rangeActivities.filter(a => !a.isIncome && a.type !== 'Transfer').sort((a, b) => b.amount - a.amount);
                const topExp = rankedExpenses[0];
                const topPct = (topExp && totalExpense > 0) ? Math.round((topExp.amount / totalExpense) * 100) : 0;

                return (
                  <View style={{ gap: 14 }}>
                    {topExp ? (
                      <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800' }}>LARGEST SINGLE PAYMENT</Text>
                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 4 }}>{topExp.title}</Text>
                        <Text style={{ color: '#ef4444', fontSize: 24, fontWeight: '900', marginTop: 2 }}>-{formatAmount(topExp.amount)}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 }}>
                          Accounts for <Text style={{ color: '#ef4444', fontWeight: '800' }}>{topPct}%</Text> of your total spending in {selectedRange}.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, alignItems: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No expenses logged for {selectedRange}</Text>
                      </View>
                    )}

                    {rankedExpenses.length > 0 && (
                      <>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>TOP EXPENSES BREAKDOWN</Text>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                          {rankedExpenses.slice(0, 3).map((item, idx) => (
                            <View key={item.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                                {idx + 1}. {item.title}
                              </Text>
                              <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '900' }}>-{formatAmount(item.amount)}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                );
              })()}

              {/* 3. ACTIVE TRANSACTIONS */}
              {(selectedInsight.title === 'Active Transactions' || selectedInsight.title === 'Most Active Day') && (
                <View style={{ gap: 14 }}>
                  <View style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800' }}>ACTIVITY DENSITY</Text>
                    <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 4 }}>{rangeActivities.length} Transactions</Text>
                    <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: '800', marginTop: 2 }}>Timeframe: {selectedRange}</Text>
                  </View>

                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>TYPE BREAKDOWN</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                      <Text style={{ color: '#73f218', fontSize: 16, fontWeight: '900' }}>{rangeActivities.filter(a => a.isIncome).length}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>Incomes</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                      <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '900' }}>{rangeActivities.filter(a => !a.isIncome && a.type !== 'Transfer').length}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>Expenses</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                      <Text style={{ color: '#3b82f6', fontSize: 16, fontWeight: '900' }}>{rangeActivities.filter(a => a.type === 'Transfer').length}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>Transfers</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 4. TOP CATEGORY */}
              {selectedInsight.title === 'Top Category' && (() => {
                const topCat = dynamicCategoryBreakdown[0];

                return (
                  <View style={{ gap: 14 }}>
                    {topCat ? (
                      <>
                        <View style={{ backgroundColor: 'rgba(168,85,247,0.08)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)' }}>
                          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800' }}>MOST HEAVY CATEGORY</Text>
                          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{topCat.name}</Text>
                          <Text style={{ color: '#a855f7', fontSize: 24, fontWeight: '900', marginTop: 2 }}>{formatAmount(topCat.amount)} spent</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 }}>
                            Consumes <Text style={{ color: '#a855f7', fontWeight: '800' }}>{topCat.pct}%</Text> of total period expenses.
                          </Text>
                        </View>

                        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' }}>Category Share of Expense</Text>
                            <Text style={{ color: '#a855f7', fontSize: 11, fontWeight: '800' }}>{topCat.pct}% ({formatAmount(topCat.amount)} / {formatAmount(totalExpense)})</Text>
                          </View>
                          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <View style={{ width: `${topCat.pct}%`, height: '100%', backgroundColor: topCat.color || '#a855f7', borderRadius: 3 }} />
                          </View>
                        </View>
                      </>
                    ) : (
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, alignItems: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No category breakdown available for {selectedRange}</Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Action Button */}
              <TouchableOpacity
                onPress={() => {
                  const targetInsight = selectedInsight;
                  setSelectedInsight(null);
                  navigation.navigate('AnalyticReport', {
                    insight: targetInsight,
                    selectedRange,
                  });
                }}
                style={{ backgroundColor: selectedInsight.color, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 20 }}
              >
                <Text style={{ color: '#0f172a', fontSize: 14, fontWeight: '900' }}>View Full Analytics Report</Text>
              </TouchableOpacity>
              </ScrollView>
            </LinearGradient>
          )}
        </View>
      </Modal>

      {/* ─── SEARCH & FILTER MODAL (Centered & Glassmorphic) ─── */}
      <Modal visible={filterModalVisible} animationType="fade" transparent>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(2, 6, 23, 0.82)', paddingHorizontal: 16 }}>
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: Math.min(SW - 32, 410),
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>Filter & Search Activity</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>SEARCH KEYWORD</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 20 }}>
              <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 10 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search merchant, category..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={{ flex: 1, paddingVertical: 12, color: '#fff', fontSize: 13, fontWeight: '600' }}
              />
            </View>

            {/* Type Selector */}
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>TRANSACTION TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {['All', 'Income', 'Expense', 'Transfer'].map(t => {
                const active = filterType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setFilterType(t as any)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: active ? 'rgba(115,242,24,0.15)' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.08)' }}
                  >
                    <Text style={{ color: active ? '#73f218' : 'rgba(255,255,255,0.5)', fontWeight: '800', fontSize: 11 }}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Category Selector */}
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
              {['All', 'Food', 'Income', 'Subscription', 'Transport', 'Housing', 'Shopping', 'Savings'].map(cat => {
                const active = selectedCategoryFilter === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategoryFilter(cat)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: active ? 'rgba(115,242,24,0.15)' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.08)' }}
                  >
                    <Text style={{ color: active ? '#73f218' : 'rgba(255,255,255,0.5)', fontWeight: '800', fontSize: 11 }}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sort Order */}
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>SORT BY</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              {[
                { id: 'newest', label: 'Newest First' },
                { id: 'oldest', label: 'Oldest First' },
                { id: 'highest', label: 'Highest Amount' }
              ].map(s => {
                const active = sortBy === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSortBy(s.id as any)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: active ? 'rgba(115,242,24,0.15)' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.08)' }}
                  >
                    <Text style={{ color: active ? '#73f218' : 'rgba(255,255,255,0.5)', fontWeight: '800', fontSize: 10 }}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Apply Button */}
            <TouchableOpacity
              onPress={() => setFilterModalVisible(false)}
              style={{ backgroundColor: '#73f218', paddingVertical: 15, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#0f172a', fontSize: 15, fontWeight: '900' }}>Apply Filters</Text>
            </TouchableOpacity>

          </LinearGradient>
        </View>
      </Modal>

      {/* ─── ACTIVITY DETAIL MODAL (Centered & Glassmorphic) ─── */}
      <Modal visible={!!selectedActivity} animationType="fade" transparent onRequestClose={() => { setSelectedActivity(null); setIsDeletingRecord(false); }} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(2, 6, 23, 0.82)', paddingHorizontal: 16, paddingVertical: 20 }}>
          {selectedActivity && (
            <LinearGradient
              colors={['#0f172a', '#1e293b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: Math.min(SW - 32, 390),
                maxHeight: '85%',
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
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>Activity Detail</Text>
                <TouchableOpacity onPress={() => { setSelectedActivity(null); setIsDeletingRecord(false); }} style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={{ alignItems: 'center', marginVertical: 12 }}>
                <View style={{ width: 62, height: 62, borderRadius: 22, backgroundColor: selectedActivity.color + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: selectedActivity.color + '44' }}>
                  <Ionicons name={selectedActivity.icon} size={30} color={selectedActivity.color} />
                </View>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' }}>{selectedActivity.title}</Text>
                <Text style={{ color: selectedActivity.isIncome ? '#73f218' : selectedActivity.type === 'Transfer' ? '#3b82f6' : '#ef4444', fontSize: 28, fontWeight: '900', marginTop: 4 }}>
                  {selectedActivity.isIncome ? '+' : selectedActivity.type === 'Transfer' ? '' : '-'}{formatAmount(selectedActivity.amount)}
                </Text>
              </View>

              <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 18, padding: 16, gap: 12, marginVertical: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Date & Time</Text>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{selectedActivity.date}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Category</Text>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{selectedActivity.category}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Payment Method</Text>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{selectedActivity.method}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' }}>Status</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(115,242,24,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    <Ionicons name="checkmark-circle" size={13} color="#73f218" />
                    <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '800' }}>Completed</Text>
                  </View>
                </View>
              </View>

              {isDeletingRecord ? (
                <View style={{ gap: 10, marginTop: 4 }}>
                  <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#ef4444' }}>
                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>
                      Are you sure? Permanently delete this record?
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => {
                        const targetId = selectedActivity.id;
                        deleteTransaction(targetId);
                        setIsDeletingRecord(false);
                        setSelectedActivity(null);
                      }}
                      style={{ flex: 1, backgroundColor: '#ef4444', paddingVertical: 13, borderRadius: 12, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Confirm Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setIsDeletingRecord(false)}
                      style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 13, borderRadius: 12, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={() => setIsDeletingRecord(true)}
                    style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.12)', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}
                  >
                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '800' }}>Delete Record</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      handleExportReceipt(selectedActivity);
                      setSelectedActivity(null);
                    }}
                    style={{ flex: 1, backgroundColor: '#73f218', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '900' }}>Export Receipt</Text>
                  </TouchableOpacity>
                </View>
              )}

              </ScrollView>
            </LinearGradient>
          )}
        </View>
      </Modal>

      {/* ─── CHART BAR BREAKDOWN MODAL ─── */}
      <Modal visible={!!selectedBarDetails} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.82)' }}>
          {selectedBarDetails && (
            <View style={{ backgroundColor: '#111827', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: 500, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
                    Transactions for <Text style={{ color: '#73f218' }}>{selectedBarDetails.label}</Text>
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                    {selectedRange} Breakdown ({selectedBarDetails.txs.length} {selectedBarDetails.txs.length === 1 ? 'Entry' : 'Entries'})
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedBarDetails(null)} style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Bar Totals Pill Row */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(115,242,24,0.08)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700' }}>INCOME</Text>
                  <Text style={{ color: '#73f218', fontSize: 13, fontWeight: '900', marginTop: 2 }}>+{formatAmount(selectedBarDetails.inc)}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.08)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700' }}>EXPENSE</Text>
                  <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '900', marginTop: 2 }}>-{formatAmount(selectedBarDetails.exp)}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(59,130,246,0.08)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700' }}>NET FLOW</Text>
                  <Text style={{ color: selectedBarDetails.net >= 0 ? '#73f218' : '#ef4444', fontSize: 13, fontWeight: '900', marginTop: 2 }}>
                    {selectedBarDetails.net >= 0 ? `+${formatAmount(selectedBarDetails.net)}` : `-${formatAmount(Math.abs(selectedBarDetails.net))}`}
                  </Text>
                </View>
              </View>

              {/* Transactions List */}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
                {selectedBarDetails.txs.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16 }}>
                    <Ionicons name="calendar-outline" size={32} color="rgba(255,255,255,0.2)" />
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 8 }}>No transactions recorded for {selectedBarDetails.label}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>No activity logged under this bar in {selectedRange}.</Text>
                  </View>
                ) : (
                  selectedBarDetails.txs.map((act: any) => (
                    <TouchableOpacity
                      key={act.id}
                      onPress={() => {
                        setSelectedBarDetails(null);
                        setSelectedActivity(act);
                      }}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 14,
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: act.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={act.icon as any} size={16} color={act.color} />
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{act.title}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>{act.category} • {act.method}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: act.isIncome ? '#73f218' : act.type === 'Transfer' ? '#3b82f6' : '#ef4444', fontSize: 13, fontWeight: '900' }}>
                          {act.isIncome ? '+' : act.type === 'Transfer' ? '' : '-'}{formatAmount(act.amount)}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, marginTop: 2 }}>Tap for receipt</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

    </View>
  );
}
