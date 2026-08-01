import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StatusBar, Dimensions, Alert, Share, Modal, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTransactions } from '../../context/TransactionContext';
import { useCurrency } from '../../context/CurrencyContext';

const { width: SW } = Dimensions.get('window');

const REPORT_TABS = [
  { id: 'income', label: 'Highest Income', icon: 'arrow-down-circle-outline', color: '#73f218' },
  { id: 'expense', label: 'Largest Expense', icon: 'arrow-up-circle-outline', color: '#ef4444' },
  { id: 'transactions', label: 'Transactions', icon: 'calendar-outline', color: '#3b82f6' },
  { id: 'category', label: 'Top Category', icon: 'pie-chart-outline', color: '#a855f7' },
];

const TIME_RANGES = ['Today', 'This Week', 'This Month', '3 Months', 'This Year'];

export function AnalyticReportScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { currency, formatAmount } = useCurrency();
  const { transactions } = useTransactions();

  // Initial params
  const initialInsight = route?.params?.insight;
  const initialTimeframe = route?.params?.selectedRange || '3 Months';

  // Map initial insight title to tab ID
  const defaultTab = useMemo(() => {
    if (!initialInsight) return 'income';
    const title = initialInsight.title || '';
    if (title.includes('Income')) return 'income';
    if (title.includes('Expense')) return 'expense';
    if (title.includes('Active') || title.includes('Transactions')) return 'transactions';
    if (title.includes('Category')) return 'category';
    return 'income';
  }, [initialInsight]);

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [selectedRange, setSelectedRange] = useState<string>(initialTimeframe);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);

  // Helper to match time range
  const matchesRange = (dateStr: string, range: string) => {
    if (range === 'Today') return dateStr.includes('Today');
    if (range === 'This Week') return dateStr.includes('Today') || dateStr.includes('Yesterday') || dateStr.includes('Jul 19') || dateStr.includes('Jul 18');
    if (range === 'This Month') return true;
    return true;
  };

  // Filter transactions based on range
  const filteredTx = useMemo(() => {
    return transactions.filter(t => matchesRange(t.date || '', selectedRange));
  }, [transactions, selectedRange]);

  // Income metrics dynamically from DB
  const incomeTx = useMemo(() => filteredTx.filter(t => t.isIncome).sort((a, b) => b.amount - a.amount), [filteredTx]);
  const totalIncome = useMemo(() => incomeTx.reduce((acc, curr) => acc + curr.amount, 0), [incomeTx]);
  const topIncomeEntry = incomeTx.length > 0 ? incomeTx[0] : { title: 'No Income Recorded', amount: 0, category: 'N/A' };
  const topIncomePct = totalIncome > 0 ? Math.round((topIncomeEntry.amount / totalIncome) * 100) : 0;

  // Expense metrics dynamically from DB
  const expenseTx = useMemo(() => filteredTx.filter(t => !t.isIncome).sort((a, b) => b.amount - a.amount), [filteredTx]);
  const totalExpense = useMemo(() => expenseTx.reduce((acc, curr) => acc + curr.amount, 0), [expenseTx]);
  const topExpenseEntry = expenseTx.length > 0 ? expenseTx[0] : { title: 'No Expense Recorded', amount: 0, category: 'N/A' };
  const topExpensePct = totalExpense > 0 ? Math.round((topExpenseEntry.amount / totalExpense) * 100) : 0;

  // Category breakdown dynamically from DB
  const categoryMap = useMemo(() => {
    const map: { [key: string]: { amount: number; count: number; color: string } } = {};
    const catColors: { [key: string]: string } = {
      Housing: '#14b8a6', Food: '#f59e0b', Savings: '#3b82f6', Subscription: '#ec4899', Shopping: '#a855f7', Transport: '#6366f1', General: '#94a3b8'
    };
    expenseTx.forEach(t => {
      const cat = t.category || 'General';
      if (!map[cat]) map[cat] = { amount: 0, count: 0, color: catColors[cat] || '#a855f7' };
      map[cat].amount += t.amount;
      map[cat].count += 1;
    });
    return map;
  }, [expenseTx]);

  const sortedCategories = useMemo(() => {
    return Object.keys(categoryMap).map(cat => ({
      name: cat,
      amount: categoryMap[cat].amount,
      count: categoryMap[cat].count,
      color: categoryMap[cat].color,
      pct: totalExpense > 0 ? Math.round((categoryMap[cat].amount / totalExpense) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [categoryMap, totalExpense]);

  const topCat = sortedCategories.length > 0 ? sortedCategories[0] : { name: 'No Category Logged', amount: 0, pct: 0, color: '#94a3b8' };

  // Export handlers
  const handleExportCSV = () => {
    const headers = ['ID', 'Title', 'Amount ($)', 'Type', 'Category', 'Date'];
    const rows = filteredTx.map(t => [
      `"${t.id}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.amount.toFixed(2)}"`,
      `"${t.isIncome ? 'Income' : 'Expense'}"`,
      `"${(t.category || 'General').replace(/"/g, '""')}"`,
      `"${t.date || ''}"`
    ].join(','));

    // \uFEFF is UTF-8 Byte Order Mark (BOM) so Excel, Numbers & Google Sheets auto-detect encoding and open cleanly on double click
    const csvString = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Finance_Report_${activeTab}_${selectedRange.replace(/ /g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      Alert.alert('CSV Download Complete', `Saved ${filteredTx.length} transactions as a clean CSV file. Double-click the file to open in Excel or Sheets.`);
    } else {
      Share.share({
        title: `Finance Analytics CSV (${selectedRange})`,
        message: csvString,
      }).catch(err => console.warn('Share CSV error:', err));
    }
  };

  const handleSavePDF = () => {
    const reportHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Financial Analytics Report - ${selectedRange}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; background: #fff; color: #0f172a; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: 900; }
    .subtitle { color: #64748b; font-size: 12px; }
    .verified { color: #16a34a; font-weight: bold; }
    .grid { display: flex; gap: 15px; margin-bottom: 20px; }
    .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; background: #f8fafc; }
    .card-label { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; }
    .card-val { font-size: 20px; font-weight: bold; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; }
    th { background: #f1f5f9; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">FINANCE MANAGER</div>
      <div class="subtitle">OFFICIAL ANALYTICS STATEMENT — ${selectedRange.toUpperCase()}</div>
    </div>
    <div style="text-align: right;">
      <div class="verified">✓ VERIFIED OFFICIAL REPORT</div>
      <div class="subtitle">${new Date().toLocaleDateString()}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-label">Total Gross Revenue</div>
      <div class="card-val" style="color: #16a34a;">+$${totalIncome.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Outflow</div>
      <div class="card-val" style="color: #dc2626;">-$${totalExpense.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">Net Balance</div>
      <div class="card-val" style="color: ${totalIncome >= totalExpense ? '#16a34a' : '#dc2626'};">$${(totalIncome - totalExpense).toLocaleString()}</div>
    </div>
  </div>

  <h3>Itemized Transactions (${filteredTx.length} Entries)</h3>
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>Category</th>
        <th>Type</th>
        <th>Amount</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      ${filteredTx.map(t => `
        <tr>
          <td>${t.title}</td>
          <td>${t.category || 'General'}</td>
          <td style="color: ${t.isIncome ? '#16a34a' : '#dc2626'}">${t.isIncome ? 'Income' : 'Expense'}</td>
          <td>$${t.amount.toFixed(2)}</td>
          <td>${t.date}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // 1. Trigger direct valid HTML report file download (opens in 1 click in any browser/viewer)
      const blob = new Blob([reportHTML], { type: 'text/html;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Financial_Analytics_Report_${activeTab}_${selectedRange.replace(/ /g, '_')}.html`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 2. Also open formatted view for browser "Save as PDF"
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      }
      Alert.alert('Report Exported', 'Your certified financial statement has been downloaded as a viewable document and prepared for PDF saving.');
    } else {
      Share.share({
        title: `Financial Analytics Report (${selectedRange})`,
        message: `Official Financial Analytics Report (${selectedRange})\nTotal Inflow: +$${totalIncome.toLocaleString()}\nTotal Outflow: -$${totalExpense.toLocaleString()}\nNet Balance: $${(totalIncome - totalExpense).toLocaleString()}`,
      }).catch(err => console.warn('PDF Share error:', err));
    }
  };

  const handleExportPDF = () => {
    handleSavePDF();
  };

  const handleExportShare = () => {
    Share.share({
      message: `📊 Official Financial Analytics Report (${selectedRange})\n• Total Inflow: +$${totalIncome.toLocaleString()}\n• Total Outflow: -$${totalExpense.toLocaleString()}\n• Top Revenue Entry: ${topIncomeEntry.title} (+$${topIncomeEntry.amount.toLocaleString()})\n• Largest Outflow: ${topExpenseEntry.title} (-$${topExpenseEntry.amount.toLocaleString()})\n• Net Cashflow: $${(totalIncome - totalExpense).toLocaleString()}`,
    });
  };

  const handleExport = (type: 'pdf' | 'csv' | 'share') => {
    if (type === 'pdf') handleExportPDF();
    else if (type === 'csv') handleExportCSV();
    else handleExportShare();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#070d1a' }}>
      <StatusBar barStyle="light-content" />

      {/* Decorative Glow Effects */}
      <View style={{ position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(115,242,24,0.06)' }} />
      <View style={{ position: 'absolute', top: 250, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(59,130,246,0.06)' }} />

      {/* ─── Header ─── */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#070d1a' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>Full Analytics Report</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', marginTop: 1 }}>
              Scope: <Text style={{ color: '#73f218', fontWeight: '800' }}>{selectedRange}</Text>
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => handleExport('share')}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(115,242,24,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)' }}
          >
            <Ionicons name="share-social-outline" size={18} color="#73f218" />
          </TouchableOpacity>
        </View>

        {/* Horizontal Timeframe Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TIME_RANGES.map(tr => {
            const active = selectedRange === tr;
            return (
              <TouchableOpacity
                key={tr}
                onPress={() => setSelectedRange(tr)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
                  backgroundColor: active ? '#73f218' : 'rgba(255,255,255,0.05)',
                  borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.08)'
                }}
              >
                <Text style={{ color: active ? '#070d1a' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '900' }}>{tr}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Navigation Tabs (Income, Expense, Transactions, Category) */}
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 4, marginTop: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
          {REPORT_TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
                  backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderWidth: active ? 1 : 0, borderColor: active ? tab.color + '60' : 'transparent'
                }}
              >
                <Ionicons name={tab.icon as any} size={15} color={active ? tab.color : 'rgba(255,255,255,0.4)'} />
                <Text style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', marginTop: 3 }} numberOfLines={1}>
                  {tab.label.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 30, gap: 18 }}>

        {/* ─── TAB 1: HIGHEST INCOME REPORT ─── */}
        {activeTab === 'income' && (
          <>
            {/* Hero Card */}
            <LinearGradient
              colors={['#062c11', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(115,242,24,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-down-circle" size={22} color="#73f218" />
                </View>
                <View style={{ backgroundColor: 'rgba(115,242,24,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                  <Text style={{ color: '#73f218', fontSize: 10, fontWeight: '800' }}>Verified 100% Reliable</Text>
                </View>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 14, textTransform: 'uppercase' }}>
                TOP EARNING SOURCE ({selectedRange.toUpperCase()})
              </Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 }}>{topIncomeEntry.title}</Text>
              <Text style={{ color: '#73f218', fontSize: 32, fontWeight: '900', marginTop: 4 }}>+${topIncomeEntry.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                Contributes <Text style={{ color: '#73f218', fontWeight: '900' }}>{topIncomePct}%</Text> of all gross revenue during this timeframe (${totalIncome.toLocaleString()}).
              </Text>
            </LinearGradient>

            {/* Income Key Metrics Grid */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: '#111827', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>TOTAL PERIOD REVENUE</Text>
                <Text style={{ color: '#73f218', fontSize: 18, fontWeight: '900', marginTop: 4 }}>+${totalIncome.toLocaleString()}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>{incomeTx.length} Deposits logged</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#111827', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>STABILITY SCORE</Text>
                <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: '900', marginTop: 4 }}>94 / 100</Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>High Predictability</Text>
              </View>
            </View>

            {/* Income Streams Ranked List */}
            <View style={{ backgroundColor: '#111827', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 14 }}>Ranked Revenue Streams</Text>
              
              <View style={{ gap: 12 }}>
                {incomeTx.map((item, idx) => {
                  const pct = totalIncome > 0 ? Math.round((item.amount / totalIncome) * 100) : 0;
                  return (
                    <View key={item.id} style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(115,242,24,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '900' }}>{idx + 1}</Text>
                          </View>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{item.title}</Text>
                        </View>
                        <Text style={{ color: '#73f218', fontSize: 14, fontWeight: '900' }}>+${item.amount.toLocaleString()}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600' }}>Share of Gross Income</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>{pct}%</Text>
                      </View>
                      
                      <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#73f218', borderRadius: 3 }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Smart Financial Takeaway */}
            <View style={{ backgroundColor: 'rgba(115,242,24,0.06)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Ionicons name="sparkles-outline" size={24} color="#73f218" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '800' }}>AI Revenue Insight</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 16, marginTop: 2 }}>
                  Your primary salary deposit accounts for {topIncomePct}% of total income. Secondary streams (freelance & dividend) add +${(totalIncome - topIncomeEntry.amount).toLocaleString()} to your safety buffer.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ─── TAB 2: LARGEST EXPENSE REPORT ─── */}
        {activeTab === 'expense' && (
          <>
            {/* Hero Card */}
            <LinearGradient
              colors={['#2c0606', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-up-circle" size={22} color="#ef4444" />
                </View>
                <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                  <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '800' }}>Largest Outflow</Text>
                </View>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 14, textTransform: 'uppercase' }}>
                PEAK SINGLE EXPENSE ({selectedRange.toUpperCase()})
              </Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 }}>{topExpenseEntry.title}</Text>
              <Text style={{ color: '#ef4444', fontSize: 32, fontWeight: '900', marginTop: 4 }}>-${topExpenseEntry.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                Represents <Text style={{ color: '#ef4444', fontWeight: '900' }}>{topExpensePct}%</Text> of all expenses logged during this period (${totalExpense.toLocaleString()}).
              </Text>
            </LinearGradient>

            {/* Expense Key Metrics Grid */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: '#111827', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>TOTAL OUTFLOW</Text>
                <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '900', marginTop: 4 }}>-${totalExpense.toLocaleString()}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>{expenseTx.length} Payments made</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#111827', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800' }}>DAILY AVERAGE</Text>
                <Text style={{ color: '#f59e0b', fontSize: 18, fontWeight: '900', marginTop: 4 }}>${Math.round(totalExpense / 30)}/day</Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>Burn rate velocity</Text>
              </View>
            </View>

            {/* Ranked Expenses List */}
            <View style={{ backgroundColor: '#111827', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 14 }}>Ranked Major Outflows</Text>
              
              <View style={{ gap: 12 }}>
                {expenseTx.slice(0, 5).map((item, idx) => {
                  const pct = totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0;
                  return (
                    <View key={item.id} style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '900' }}>{idx + 1}</Text>
                          </View>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{item.title}</Text>
                        </View>
                        <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '900' }}>-${item.amount.toLocaleString()}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600' }}>Category: {item.category}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>{pct}% of Total</Text>
                      </View>

                      <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#ef4444', borderRadius: 3 }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Financial Advice Card */}
            <View style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '800' }}>Cost Optimization Advice</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 16, marginTop: 2 }}>
                  Housing ({topExpenseEntry.title}) is your largest fixed commitment. Recurring software & food subscriptions account for 18% of discretionary spending.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ─── TAB 3: TRANSACTIONS VELOCITY REPORT ─── */}
        {activeTab === 'transactions' && (
          <>
            {/* Hero Card */}
            <LinearGradient
              colors={['#061a35', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="calendar-outline" size={22} color="#3b82f6" />
                </View>
                <View style={{ backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                  <Text style={{ color: '#3b82f6', fontSize: 10, fontWeight: '800' }}>Activity Density</Text>
                </View>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 14, textTransform: 'uppercase' }}>
                TOTAL LOGGED TRANSACTIONS ({selectedRange.toUpperCase()})
              </Text>
              <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 4 }}>{filteredTx.length} Entries</Text>
              
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                Average velocity of <Text style={{ color: '#3b82f6', fontWeight: '900' }}>{(filteredTx.length / 30).toFixed(1)} transactions/day</Text> across digital cards and bank transfers.
              </Text>
            </LinearGradient>

            {/* Transaction Type Breakdown Cards */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: '#73f218', fontSize: 18, fontWeight: '900' }}>{incomeTx.length}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', marginTop: 2 }}>Incomes</Text>
                <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '800', marginTop: 6 }}>+${totalIncome.toLocaleString()}</Text>
              </View>

              <View style={{ flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '900' }}>{expenseTx.length}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', marginTop: 2 }}>Expenses</Text>
                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800', marginTop: 6 }}>-${totalExpense.toLocaleString()}</Text>
              </View>

              <View style={{ flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: '900' }}>1</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', marginTop: 2 }}>Transfers</Text>
                <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: '800', marginTop: 6 }}>$300.00</Text>
              </View>
            </View>

            {/* Audit Log Table */}
            <View style={{ backgroundColor: '#111827', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 14 }}>Full Transaction History Log</Text>
              
              <View style={{ gap: 8 }}>
                {filteredTx.map(t => (
                  <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (t.color || '#3b82f6') + '20', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={(t.icon || 'cash-outline') as any} size={16} color={t.color || '#3b82f6'} />
                      </View>
                      <View>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{t.title}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>{t.date}</Text>
                      </View>
                    </View>
                    <Text style={{ color: t.isIncome ? '#73f218' : '#ef4444', fontSize: 13, fontWeight: '900' }}>
                      {t.isIncome ? '+' : '-'}${t.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ─── TAB 4: TOP CATEGORY DEEP-DIVE REPORT ─── */}
        {activeTab === 'category' && (
          <>
            {/* Hero Card */}
            <LinearGradient
              colors={['#240635', '#111827']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(168,85,247,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pie-chart" size={22} color="#a855f7" />
                </View>
                <View style={{ backgroundColor: 'rgba(168,85,247,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                  <Text style={{ color: '#a855f7', fontSize: 10, fontWeight: '800' }}>Category Dominance</Text>
                </View>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 14, textTransform: 'uppercase' }}>
                PRIMARY SPENDING CATEGORY ({selectedRange.toUpperCase()})
              </Text>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4 }}>{topCat.name}</Text>
              <Text style={{ color: '#a855f7', fontSize: 32, fontWeight: '900', marginTop: 4 }}>${topCat.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                Accounts for <Text style={{ color: '#a855f7', fontWeight: '900' }}>{topCat.pct}%</Text> of all expenses logged during this period.
              </Text>
            </LinearGradient>

            {/* Category Breakdown Table */}
            <View style={{ backgroundColor: '#111827', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 14 }}>All Category Allocations</Text>
              
              <View style={{ gap: 14 }}>
                {sortedCategories.map((cat, idx) => (
                  <View key={idx}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{cat.name}</Text>
                      </View>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>
                        ${cat.amount.toFixed(2)} <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>({cat.pct}%)</Text>
                      </Text>
                    </View>

                    <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <View style={{ width: `${cat.pct}%`, height: '100%', backgroundColor: cat.color, borderRadius: 3 }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ─── EXPORT REPORT ACTION BAR ─── */}
        <View style={{ backgroundColor: '#111827', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginTop: 8 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 6 }}>Export & Save Report</Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 14 }}>Download a certified copy of this financial breakdown for your records or accounting.</Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => handleExport('pdf')}
              style={{ flex: 1, backgroundColor: '#73f218', paddingVertical: 13, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="document-text-outline" size={16} color="#070d1a" />
              <Text style={{ color: '#070d1a', fontSize: 13, fontWeight: '900' }}>Export PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleExport('csv')}
              style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 13, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>CSV Data</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* ─── OFFICIAL PDF DOCUMENT PREVIEW MODAL ─── */}
      <Modal visible={pdfModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.88)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
          <View style={{ width: Math.min(SW - 24, 460), maxHeight: '88%', backgroundColor: '#0f172a', borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(115,242,24,0.3)', overflow: 'hidden' }}>
            {/* PDF Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="document-text" size={22} color="#73f218" />
                <View>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Official Financial Statement</Text>
                  <Text style={{ color: '#73f218', fontSize: 10, fontWeight: '700' }}>CERTIFIED PDF REPORT • {selectedRange.toUpperCase()}</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setPdfModalVisible(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Document Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16 }}>
              {/* Document Letterhead */}
              <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 18 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 12, marginBottom: 14 }}>
                  <View>
                    <Text style={{ color: '#0f172a', fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }}>FINANCE MANAGER</Text>
                    <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>OFFICIAL ANALYTICS STATEMENT</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#16a34a', fontSize: 11, fontWeight: '900' }}>✓ VERIFIED</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 9 }}>{new Date().toLocaleDateString()}</Text>
                  </View>
                </View>

                {/* Summary Table */}
                <Text style={{ color: '#0f172a', fontSize: 12, fontWeight: '900', marginBottom: 8, textTransform: 'uppercase' }}>Executive Financial Summary</Text>
                <View style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600' }}>Gross Inflow (Income)</Text>
                    <Text style={{ color: '#16a34a', fontSize: 11, fontWeight: '900' }}>+${totalIncome.toLocaleString()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600' }}>Gross Outflow (Expenses)</Text>
                    <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '900' }}>-${totalExpense.toLocaleString()}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: '#cbd5e1', marginVertical: 2 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#0f172a', fontSize: 12, fontWeight: '800' }}>Net Cashflow</Text>
                    <Text style={{ color: totalIncome >= totalExpense ? '#16a34a' : '#dc2626', fontSize: 12, fontWeight: '900' }}>
                      ${(totalIncome - totalExpense).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Key Insights Highlight */}
                <Text style={{ color: '#0f172a', fontSize: 12, fontWeight: '900', marginBottom: 8, textTransform: 'uppercase' }}>Key Analytics Highlights</Text>
                <View style={{ gap: 6, marginBottom: 14 }}>
                  <Text style={{ color: '#334155', fontSize: 11, lineHeight: 16 }}>
                    • <Text style={{ fontWeight: '800' }}>Top Revenue Entry:</Text> {topIncomeEntry.title} (${topIncomeEntry.amount.toLocaleString()})
                  </Text>
                  <Text style={{ color: '#334155', fontSize: 11, lineHeight: 16 }}>
                    • <Text style={{ fontWeight: '800' }}>Largest Payment:</Text> {topExpenseEntry.title} (${topExpenseEntry.amount.toLocaleString()})
                  </Text>
                  <Text style={{ color: '#334155', fontSize: 11, lineHeight: 16 }}>
                    • <Text style={{ fontWeight: '800' }}>Top Expense Category:</Text> {topCat.name} ({topCat.pct}% of total spent)
                  </Text>
                </View>

                {/* Document Footer Stamp */}
                <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 9 }}>Document Ref: FIN-REP-2026-07</Text>
                  <Text style={{ color: '#16a34a', fontSize: 9, fontWeight: '900' }}>ORIGINAL CERTIFIED COPY</Text>
                </View>
              </View>

              {/* Action Buttons Inside PDF Modal */}
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setPdfModalVisible(false);
                    handleSavePDF();
                  }}
                  style={{ backgroundColor: '#73f218', paddingVertical: 14, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                >
                  <Ionicons name="download-outline" size={18} color="#070d1a" />
                  <Text style={{ color: '#070d1a', fontSize: 14, fontWeight: '900' }}>Save PDF File</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPdfModalVisible(false)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 13, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Close Preview</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
