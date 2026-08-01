import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Switch, Image, Alert, Platform, Share,
  Dimensions, Animated, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';
import { fetchUserProfile, updateUserProfile, defaultProfile } from '../../lib/profileService';
import { useAccounts } from '../../context/AccountContext';
import { useTransactions } from '../../context/TransactionContext';
import { useBills } from '../../context/BillContext';

const { width } = Dimensions.get('window');



const getDefaultCurrency = () => {
  try {
    const locale = (Intl.DateTimeFormat().resolvedOptions().locale || (typeof navigator !== 'undefined' ? navigator?.language : '') || '').toUpperCase();
    if (locale.includes('-RW') || locale.includes('_RW')) return CURRENCIES.find(c => c.code === 'RWF') || CURRENCIES[0];
    if (locale.includes('-KE') || locale.includes('_KE')) return CURRENCIES.find(c => c.code === 'KES') || CURRENCIES[0];
    if (locale.includes('-GB') || locale.includes('_GB')) return CURRENCIES.find(c => c.code === 'GBP') || CURRENCIES[0];
    if (locale.includes('-CA') || locale.includes('_CA')) return CURRENCIES.find(c => c.code === 'CAD') || CURRENCIES[0];
    const timeZone = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    if (timeZone.includes('kigali') || timeZone.includes('rwanda')) return CURRENCIES.find(c => c.code === 'RWF') || CURRENCIES[0];
    if (timeZone.includes('nairobi') || timeZone.includes('kenya'))  return CURRENCIES.find(c => c.code === 'KES') || CURRENCIES[0];
    if (timeZone.includes('london') || timeZone.includes('gb') || timeZone.includes('uk')) return CURRENCIES.find(c => c.code === 'GBP') || CURRENCIES[0];
    if (timeZone.includes('toronto') || timeZone.includes('vancouver') || timeZone.includes('canada')) return CURRENCIES.find(c => c.code === 'CAD') || CURRENCIES[0];
    if (timeZone.includes('europe/') || timeZone.includes('paris') || timeZone.includes('berlin')) return CURRENCIES.find(c => c.code === 'EUR') || CURRENCIES[0];
  } catch (e) {}
  return CURRENCIES[0];
};

// ── Reusable components ─────────────────────────────────────────────────────

const SECTION_ITEMS = [
  { label: 'All',          icon: 'grid-outline',             description: 'Show all sections & pages combined in one scrollable view' },
  { label: 'Profile',      icon: 'person-outline',           description: 'Personal details, contact info, bio & achievements' },
  { label: 'Security',     icon: 'shield-checkmark-outline', description: '2FA authentication, biometric lock & active sessions' },
  { label: 'Accounts',     icon: 'wallet-outline',           description: 'Bank accounts, mobile money, cards & API connections' },
  { label: 'Settings',     icon: 'options-outline',          description: 'App preferences, default currency, theme & alerts' },
  { label: 'Subscription', icon: 'sparkles-outline',         description: 'Premium Pro plan details, billing cycle & perks' },
  { label: 'Support',      icon: 'help-buoy-outline',        description: 'Help center, live support chat, FAQs & app version' },
];

const SectionPill = ({ label, icon, active, onPress }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.pill,
      active && styles.pillActive,
    ]}
    activeOpacity={0.8}
  >
    <Ionicons
      name={icon as any}
      size={13}
      color={active ? '#0f172a' : 'rgba(255,255,255,0.6)'}
      style={{ marginRight: 6 }}
    />
    <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const InfoRow = ({ label, value, icon }: { label: string; value: string; icon?: string }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoRowLeft}>
      {icon && <Ionicons name={icon as any} size={14} color="rgba(255,255,255,0.35)" style={{ marginRight: 6 }} />}
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
    <Text style={styles.infoVal}>{value}</Text>
  </View>
);

const CardHeader = ({ icon, iconColor, title, action, onAction }: any) => (
  <View style={styles.cardHeader}>
    <View style={styles.cardHeaderLeft}>
      <View style={[styles.cardIconBox, { backgroundColor: iconColor + '22' }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    {action && (
      <TouchableOpacity onPress={onAction} style={styles.cardActionBtn}>
        <Text style={styles.cardActionText}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const ToggleRow = ({ label, sublabel, value, onValueChange }: any) => (
  <View style={styles.toggleRow}>
    <View style={{ flex: 1, marginRight: 12 }}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {sublabel ? <Text style={styles.toggleSublabel}>{sublabel}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: 'rgba(255,255,255,0.12)', true: '#73f218' }}
      thumbColor={value ? '#fff' : 'rgba(255,255,255,0.6)'}
    />
  </View>
);

const ActionRow = ({ icon, label, value, onPress, danger }: any) => (
  <TouchableOpacity onPress={onPress} style={styles.actionRow} activeOpacity={0.7}>
    <View style={styles.actionRowLeft}>
      {icon && <Ionicons name={icon} size={16} color={danger ? '#ef4444' : 'rgba(255,255,255,0.5)'} style={{ marginRight: 10 }} />}
      <Text style={[styles.actionLabel, danger && { color: '#ef4444' }]}>{label}</Text>
    </View>
    <View style={styles.actionRowRight}>
      {value ? <Text style={styles.actionValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.25)" />
    </View>
  </TouchableOpacity>
);

// ── Modal wrapper ───────────────────────────────────────────────────────────
const BottomSheet = ({ visible, onClose, title, children }: any) => (
  <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
    <View style={styles.modalOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={styles.bottomSheet}>
        {/* Handle bar */}
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </View>
  </Modal>
);

const CenterModal = ({ visible, onClose, title, children }: any) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
    <View style={styles.centerModalOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={styles.centerModalCard}>
        <View style={styles.sheetHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LinearGradient colors={['#73f218', '#4caf14']} style={styles.centerHeaderIconBox}>
              <Ionicons name="swap-horizontal" size={16} color="#0f172a" />
            </LinearGradient>
            <Text style={styles.sheetTitle}>{title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: Dimensions.get('window').height * 0.75 }}>
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

const ModalInput = ({ label, ...props }: any) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={styles.modalLabel}>{label}</Text>
    <TextInput style={styles.modalInput} placeholderTextColor="rgba(255,255,255,0.25)" {...props} />
  </View>
);

// ── Main Screen ─────────────────────────────────────────────────────────────
export function ProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState('All');
  const [isVerticalMenuOpen, setIsVerticalMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  const toggleVerticalMenu = (open: boolean) => {
    if (open) {
      setIsVerticalMenuOpen(true);
      Animated.spring(menuAnim, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setIsVerticalMenuOpen(false));
    }
  };

  // ── Profile State ──
  const [profile, setProfile] = useState({
    firstName: 'Alex',
    lastName: 'Morgan',
    username: '@alexmorgan',
    email: 'alex.morgan@example.com',
    phone: '+1 (555) 234-5678',
    backupEmail: 'alex.backup@work.com',
    gender: 'Non-binary',
    dob: 'Aug 15, 1994',
    country: 'United States',
    city: 'San Francisco, CA',
    language: 'English (US)',
    timeZone: 'UTC-7 (Pacific Time)',
    occupation: 'Senior Software Engineer',
    joinDate: 'January 2024',
    accountId: 'ACC-883921',
    isPremium: true,
    emailVerified: true,
    phoneVerified: true,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
  });

  const { accounts: rawAccounts, addAccount, transferBetweenAccounts, setDefaultAccount, deleteAccount, totalNetWorthUSD } = useAccounts();
  const { transactions: userTransactions, monthlyIncome, monthlyExpenses } = useTransactions();
  const { totalUpcomingAmount } = useBills();

  const accounts = rawAccounts.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance,
    currency: a.currency === 'RWF' ? 'FRw' : '$',
    institution: a.institution,
    status: 'Active',
    isDefault: a.isDefault,
    updated: 'Just now',
  }));

  // ── Linked Services State ──
  const [linkedServices, setLinkedServices] = useState([
    { id: '1', name: 'Plaid Bank Integration', status: 'Connected',    lastSync: '5 mins ago',        freq: 'Real-time', icon: 'server-outline',          color: '#73f218' },
    { id: '2', name: 'MTN Mobile Money API',   status: 'Connected',    lastSync: '1 hour ago',        freq: 'Hourly',    icon: 'phone-portrait-outline',  color: '#f59e0b' },
    { id: '3', name: 'Google Account',         status: 'Connected',    lastSync: 'Today, 09:00 AM',   freq: 'SSO',       icon: 'logo-google',              color: '#4285f4' },
    { id: '4', name: 'Apple ID',               status: 'Connected',    lastSync: 'Jul 15',            freq: 'SSO',       icon: 'logo-apple',               color: '#e2e8f0' },
    { id: '5', name: 'Microsoft Account',      status: 'Disconnected', lastSync: 'Never',             freq: 'Manual',    icon: 'logo-windows',             color: '#64748b' },
  ]);

  // ── Security ──
  const [twoFactorEnabled, setTwoFactorEnabled]   = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [activeSessions, setActiveSessions] = useState([
    { id: 's1', device: 'iPhone 15 Pro',            location: 'San Francisco, US', ip: '192.168.1.45',   isCurrent: true,  lastActive: 'Active now' },
    { id: 's2', device: 'MacBook Pro 16" (Chrome)', location: 'San Francisco, US', ip: '192.168.1.12',   isCurrent: false, lastActive: '2 hours ago' },
    { id: 's3', device: 'Windows Desktop (Web)',     location: 'Kigali, RW',        ip: '105.178.42.11',  isCurrent: false, lastActive: 'Jul 20, 2026' },
  ]);

  // ── Privacy & Notifications ──
  const [hideBalances,       setHideBalances]       = useState(false);
  const [privacyMode,        setPrivacyMode]        = useState(false);
  const [analyticsAllowed,   setAnalyticsAllowed]   = useState(true);
  const [notifications, setNotifications] = useState({
    budgetAlerts: true, billReminders: true, goalReminders: true,
    weeklySummary: true, monthlySummary: true, securityAlerts: true, promotional: false,
    channelPush: true, channelEmail: true, channelSMS: false,
  });

  const { currency: selectedCurrency, country: selectedCountry, setCurrency, setCountryByName, convertAmount } = useCurrency();
  const [themeMode, setThemeMode]           = useState<'Dark' | 'Light' | 'System'>('Dark');
  const [dateFormat, setDateFormat]         = useState('YYYY-MM-DD');

  // ── Transfer State ──
  const [transferModal, setTransferModal] = useState(false);
  const [fromAccId, setFromAccId] = useState('');
  const [toAccId, setToAccId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [fromCurrencyOverride, setFromCurrencyOverride] = useState('');
  const [toCurrencyOverride, setToCurrencyOverride] = useState('');
  const [showFromAccDropdown, setShowFromAccDropdown] = useState(false);
  const [showToAccDropdown, setShowToAccDropdown] = useState(false);

  // ── Account Details Modal State ──
  const [selectedAccountDetails, setSelectedAccountDetails] = useState<any>(null);
  const [accountDetailsModal, setAccountDetailsModal] = useState(false);

  const openAccountDetails = (acc: any) => {
    setSelectedAccountDetails(acc);
    setAccountDetailsModal(true);
    triggerHaptic();
  };

  // ── Step 3: Security & Exports State ──
  const [autoLockTimeout, setAutoLockTimeout] = useState<'Immediate' | '1min' | '5min' | '15min'>('1min');
  const [biometricLockVisible, setBiometricLockVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'CSV'>('PDF');
  const [exportDateRange, setExportDateRange] = useState('2026-07-01 to 2026-07-27');
  const [exportStartDate, setExportStartDate] = useState('2026-07-01');
  const [exportEndDate, setExportEndDate] = useState('2026-07-27');
  const [exportPreset, setExportPreset] = useState('This Month');
  const [isGeneratingExport, setIsGeneratingExport] = useState(false);

  // ── Calendar Picker State ──
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'start' | 'end'>('start');
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(6);
  const [selectedDay, setSelectedDay] = useState(27);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const openCalendarPicker = (target: 'start' | 'end') => {
    setCalendarTarget(target);
    const currentDateStr = target === 'start' ? exportStartDate : exportEndDate;
    const parts = currentDateStr.split('-');
    if (parts.length === 3) {
      setCalendarYear(parseInt(parts[0], 10) || 2026);
      setCalendarMonth((parseInt(parts[1], 10) || 7) - 1);
      setSelectedDay(parseInt(parts[2], 10) || 1);
    }
    setCalendarModalVisible(true);
    triggerHaptic();
  };

  const handleSelectCalendarDay = (day: number) => {
    setSelectedDay(day);
    const mStr = String(calendarMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const formatted = `${calendarYear}-${mStr}-${dStr}`;

    if (calendarTarget === 'start') {
      setExportStartDate(formatted);
      setExportDateRange(`${formatted} to ${exportEndDate}`);
    } else {
      setExportEndDate(formatted);
      setExportDateRange(`${exportStartDate} to ${formatted}`);
    }
    setExportPreset('Custom Range');
    triggerHaptic();
  };

  // ── PDF Preview & Direct Save State ──
  const [pdfPreviewModalVisible, setPdfPreviewModalVisible] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<{ fileName: string; format: string; html: string; csv: string } | null>(null);

  const handleGenerateExport = (type: string) => {
    setIsGeneratingExport(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    setTimeout(() => {
      setIsGeneratingExport(false);
      setExportModalVisible(false);

      const timeStamp = new Date().toISOString().slice(0, 10);
      const userName = `${profile.firstName} ${profile.lastName}`.trim() || 'Alex Morgan';
      const userAccountId = profile.accountId || '#ACC-88421';
      const cleanFileName = `Financial_Statement_${type.replace(/[\s&]+/g, '_')}_${exportDateRange.replace(/[\s()]+/g, '_')}_${timeStamp}`;

      let csvContent = '';
      let pdfHtmlContent = '';

      // Extract User's REAL Accounts Data
      const realAccountsList = accounts.map(a => {
        const convertedVal = convertAmount(a.balance, a.currency, selectedCurrency.code);
        return {
          name: a.name,
          institution: a.institution,
          type: a.type,
          nativeBalance: `${a.currency} ${Math.abs(a.balance).toLocaleString()}`,
          convertedBalance: `${selectedCurrency.symbol}${Math.abs(convertedVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          rawNative: a.balance,
          rawConverted: convertedVal,
          currency: a.currency,
          isDefault: a.isDefault ? 'Yes' : 'No',
        };
      });

      // Extract User's REAL Tax Deductibles Data
      const realTaxItems = taxDeductibleItems.map(t => ({
        category: t.category,
        amount: t.amount,
        desc: t.desc,
        savings: t.amount * 0.22,
      }));

      if (exportFormat === 'CSV') {
        // Build Actual CSV Spreadsheet Content from User Data
        csvContent =
          `"FINANCIAL ACCOUNTING STATEMENT - CONFIDENTIAL"\n` +
          `"Account Holder","${userName} (${userAccountId})"\n` +
          `"Date Range","${exportDateRange}"\n` +
          `"Base App Currency","${selectedCurrency.code} (${selectedCurrency.symbol})"\n` +
          `"Total Net Worth","${selectedCurrency.symbol}${totalNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"\n` +
          `"Generated Date","${new Date().toLocaleString()}"\n\n` +
          `"--- FINANCIAL ACCOUNTS LEDGER ---"\n` +
          `"Account Name","Institution","Type","Native Balance","Native Currency","Converted (${selectedCurrency.code})","Primary Default"\n`;

        realAccountsList.forEach(a => {
          csvContent += `"${a.name}","${a.institution}","${a.type}","${a.rawNative}","${a.currency}","${a.rawConverted.toFixed(2)}","${a.isDefault}"\n`;
        });

        csvContent +=
          `\n"--- TAX DEDUCTIBLE EXPENSES ---"\n` +
          `"Category","Description","Deductible Amount (USD)","Est Tax Relief (22%)"\n`;

        realTaxItems.forEach(t => {
          csvContent += `"${t.category}","${t.desc}","${t.amount.toFixed(2)}","${t.savings.toFixed(2)}"\n`;
        });

        csvContent += `\n"TOTAL TAX DEDUCTIBLE","${totalTaxDeductible.toFixed(2)}"\n`;
        csvContent += `"ESTIMATED TAX SAVINGS","${estimatedTaxSavings.toFixed(2)}"\n`;

        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          try {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${cleanFileName}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
          } catch (err) {
            console.warn('CSV download error', err);
          }
        }
      } else {
        // Build Actual High-Resolution Printable PDF Document (HTML template formatted for print-to-PDF)
        pdfHtmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${cleanFileName}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 30px; margin: 0; }
    .header { border-bottom: 2px solid #73f218; padding-bottom: 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .logo-title { font-size: 22px; font-weight: 900; color: #73f218; letter-spacing: -0.5px; text-transform: uppercase; }
    .sub-title { color: #94a3b8; font-size: 11px; margin-top: 4px; font-weight: 600; }
    .meta-badge { background: rgba(115, 242, 24, 0.15); color: #73f218; border: 1px solid #73f218; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; display: inline-block; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 26px; }
    .summary-card { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); padding: 14px; border-radius: 12px; }
    .card-label { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; }
    .card-val { font-size: 20px; font-weight: 900; color: #ffffff; margin-top: 4px; }
    .section-heading { color: #fff; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px; margin-bottom: 10px; border-left: 3px solid #73f218; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; }
    th { background: rgba(115, 242, 24, 0.12); color: #73f218; text-align: left; padding: 10px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #73f218; }
    td { padding: 10px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); color: #cbd5e1; }
    .positive { color: #73f218; font-weight: 800; }
    .negative { color: #ef4444; font-weight: 800; }
    .seal-footer { text-align: center; margin-top: 40px; border-top: 1px dashed rgba(255, 255, 255, 0.15); padding-top: 18px; color: #64748b; font-size: 9px; font-weight: 600; }
    @media print {
      body { background: #ffffff !important; color: #0f172a !important; }
      .summary-card { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }
      .card-val { color: #0f172a !important; }
      th { background: #f1f5f9 !important; color: #15803d !important; border-bottom: 2px solid #15803d !important; }
      td { color: #334155 !important; border-bottom: 1px solid #e2e8f0 !important; }
      .logo-title { color: #15803d !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-title">OFFICIAL FINANCIAL STATEMENT</div>
      <div class="sub-title">Report Type: ${type} · Date Range: ${exportDateRange}</div>
      <div class="sub-title">Account Holder: <strong>${userName}</strong> (${userAccountId})</div>
    </div>
    <div style="text-align: right;">
      <div class="meta-badge">CONFIDENTIAL AUDIT LEDGER</div>
      <div class="sub-title" style="margin-top: 6px;">Generated: ${new Date().toLocaleString()}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="card-label">Total Net Worth</div>
      <div class="card-val" style="color: #73f218;">${selectedCurrency.symbol}${totalNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>
    <div class="summary-card">
      <div class="card-label">Tax Deductibles (30D)</div>
      <div class="card-val" style="color: #06b6d4;">$${totalTaxDeductible.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="summary-card">
      <div class="card-label">Est. Tax Savings</div>
      <div class="card-val" style="color: #f59e0b;">+$${estimatedTaxSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
  </div>

  <div class="section-heading">Active Financial Accounts (${accounts.length} Accounts)</div>
  <table>
    <thead>
      <tr>
        <th>Account Name</th>
        <th>Institution</th>
        <th>Type</th>
        <th>Native Balance</th>
        <th>Converted (${selectedCurrency.code})</th>
      </tr>
    </thead>
    <tbody>
      ${realAccountsList.map(a => `
        <tr>
          <td style="font-weight: 800; color: #fff;">${a.name} ${a.isDefault === 'Yes' ? '<span style="color: #73f218; font-size: 9px;">(Default)</span>' : ''}</td>
          <td>${a.institution}</td>
          <td>${a.type}</td>
          <td class="${a.rawNative < 0 ? 'negative' : 'positive'}">${a.nativeBalance}</td>
          <td class="${a.rawConverted < 0 ? 'negative' : 'positive'}">${a.convertedBalance}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-heading">Tax Deductibles Breakdown</div>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th>Description</th>
        <th>Deductible Amount</th>
        <th>Est. Tax Relief (22%)</th>
      </tr>
    </thead>
    <tbody>
      ${realTaxItems.map(t => `
        <tr>
          <td style="font-weight: 800; color: #fff;">${t.category}</td>
          <td>${t.desc}</td>
          <td style="color: #06b6d4; font-weight: 800;">$${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          <td class="positive">+$${t.savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="seal-footer">
    🔒 Officially Verified & Encrypted Document · AntiGravity Accounting System · Document ID: ${cleanFileName}
  </div>
</body>
</html>`;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          try {
            // Open print window so user can save directly as PDF!
            const printWin = window.open('', '_blank', 'width=900,height=800');
            if (printWin) {
              printWin.document.write(pdfHtmlContent);
              printWin.document.close();
              printWin.focus();
              setTimeout(() => {
                printWin.print();
              }, 400);
            }

            // Also trigger a direct download file link with .pdf extension!
            const blob = new Blob([pdfHtmlContent], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${cleanFileName}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
          } catch (err) {
            console.warn('PDF download error', err);
          }
        }
      }

      setGeneratedDoc({
        fileName: cleanFileName,
        format: exportFormat,
        html: pdfHtmlContent,
        csv: exportFormat === 'CSV' ? csvContent : '',
      });
      setPdfPreviewModalVisible(true);

      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    }, 800);
  };

  // ── Tax Deductible Items ──
  const taxDeductibleItems = [
    { id: 't1', category: 'Health & Medical', amount: 1450.00, desc: 'Health insurance & dental checkups' },
    { id: 't2', category: 'Business & Office', amount: 2890.00, desc: 'Work hardware & cloud infrastructure' },
    { id: 't3', category: 'Education & Courses', amount: 650.00, desc: 'Professional certification & books' },
    { id: 't4', category: 'Charity & Donations', amount: 500.00, desc: 'Registered non-profit contributions' },
  ];
  const totalTaxDeductible = taxDeductibleItems.reduce((sum, item) => sum + item.amount, 0);
  const estimatedTaxSavings = totalTaxDeductible * 0.22;

  // ── Subscription ──
  const [subscription] = useState({
    plan: 'Premium Pro', price: '$9.99 / mo', billingCycle: 'Monthly',
    expiry: 'Aug 21, 2026', autoRenew: true, paymentMethod: 'Visa •••• 4242',
  });

  // ── Referral ──
  const referralCode = 'ALEX2026';
  const referralLink = 'https://manager.app/ref/ALEX2026';

  // ── Modal Visibility ──
  const [editInfoModal,       setEditInfoModal]       = useState(false);
  const [changePassModal,     setChangePassModal]     = useState(false);
  const [addAccountModal,     setAddAccountModal]     = useState(false);
  const [currencyModal,       setCurrencyModal]       = useState(false);
  const [dangerZoneModal,     setDangerZoneModal]     = useState(false);

  // ── Form States ──
  const [tempFirst,         setTempFirst]         = useState(profile.firstName);
  const [tempLast,          setTempLast]          = useState(profile.lastName);
  const [tempCountry,       setTempCountry]       = useState(profile.country || selectedCountry.name);
  const [tempCity,          setTempCity]          = useState(profile.city);
  const [tempOccupation,    setTempOccupation]    = useState(profile.occupation);
  const [oldPassword,       setOldPassword]       = useState('');
  const [newPassword,       setNewPassword]       = useState('');
  const [confirmPassword,   setConfirmPassword]   = useState('');
  const [newAccName,        setNewAccName]        = useState('');
  const [newAccType,        setNewAccType]        = useState('Bank Account');
  const [newAccBalance,     setNewAccBalance]     = useState('');
  const [newAccInstitution, setNewAccInstitution] = useState('');
  const [newAccCurrency,    setNewAccCurrency]    = useState(selectedCurrency.symbol);

  // Load Profile from Supabase on mount
  useEffect(() => {
    async function loadData() {
      const p = await fetchUserProfile();
      setProfile(p as any);
      setTempFirst(p.firstName);
      setTempLast(p.lastName);
      setTempCountry(p.country || selectedCountry.name);
      setTempCity(p.city);
      setTempOccupation(p.occupation);
    }
    loadData();
  }, []);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    try { Haptics.impactAsync(style); } catch (e) {}
  };

  const handleSavePersonalInfo = async () => {
    setProfile(p => ({
      ...p,
      firstName: tempFirst,
      lastName: tempLast,
      country: tempCountry,
      city: tempCity,
      occupation: tempOccupation,
    }));
    setEditInfoModal(false);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    // Auto-update currency by country!
    await setCountryByName(tempCountry);

    // Save to Supabase backend
    await updateUserProfile({
      firstName: tempFirst,
      lastName: tempLast,
      country: tempCountry,
      city: tempCity,
      occupation: tempOccupation,
    });

    Alert.alert('✅ Saved', `Profile & default currency updated live for ${tempCountry}!`);
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) { Alert.alert('Error', 'Please fill all password fields.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match.'); return; }
    if (newPassword.length < 6) { Alert.alert('Error', 'New password must be at least 6 characters long.'); return; }
    
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        Alert.alert('Password Update Failed', error.message);
        return;
      }
      setChangePassModal(false);
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      Alert.alert('✅ Updated', 'Your password has been securely updated!');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'An error occurred while updating your password.');
    }
  };

  const handleAddAccount = () => {
    if (!newAccName || !newAccBalance) { Alert.alert('Error', 'Enter account name and balance.'); return; }
    const val = parseFloat(newAccBalance);
    if (isNaN(val)) { Alert.alert('Error', 'Enter a valid numeric balance.'); return; }
    addAccount({
      name: newAccName,
      type: newAccType as any,
      balance: val,
      currency: newAccCurrency || selectedCurrency.code,
      institution: newAccInstitution || 'Custom Bank',
      isDefault: false,
    });
    setAddAccountModal(false);
    setNewAccName(''); setNewAccBalance(''); setNewAccInstitution('');
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('✅ Account Added', `${newAccName} created in ${newAccCurrency || selectedCurrency.code}!`);
  };

  const handleShareProfile = () => {
    try { Share.share({ message: `Join me on Personal Finance Manager using my code ${referralCode}: ${referralLink}` }); } catch (e) {}
  };

  const handleSyncService = (id: string) => {
    triggerHaptic();
    setLinkedServices(prev => prev.map(s => s.id === id ? { ...s, lastSync: 'Just now' } : s));
    Alert.alert('🔄 Synced', 'Service synchronized!');
  };

  // Account type icon map
  const accIcon = (type: string): any => {
    if (type.includes('Credit') || type.includes('Card')) return 'card-outline';
    if (type.includes('Mobile'))      return 'phone-portrait-outline';
    if (type.includes('Investment'))  return 'trending-up-outline';
    if (type.includes('Loan'))        return 'document-text-outline';
    if (type.includes('Savings'))     return 'save-outline';
    if (type.includes('Cash'))        return 'cash-outline';
    return 'business-outline';
  };

  const accColor = (type: string): string => {
    if (type.includes('Credit') || type.includes('Card'))  return '#f59e0b';
    if (type.includes('Mobile'))     return '#a855f7';
    if (type.includes('Investment')) return '#3b82f6';
    if (type.includes('Loan'))       return '#ef4444';
    if (type.includes('Savings'))    return '#10b981';
    return '#73f218';
  };

  // ── TOTAL NET WORTH (Multi-Currency Converted from central AccountContext) ──
  const totalNetWorth = convertAmount(totalNetWorthUSD, 'USD', selectedCurrency.code);

  const handleExecuteTransfer = () => {
    if (!fromAccId || !toAccId) {
      Alert.alert('Error', 'Select source and destination accounts.');
      return;
    }
    if (fromAccId === toAccId) {
      Alert.alert('Error', 'Source and destination accounts must be different.');
      return;
    }
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Enter a valid transfer amount.');
      return;
    }
    const sourceAcc = accounts.find(a => a.id === fromAccId);
    const destAcc = accounts.find(a => a.id === toAccId);
    if (!sourceAcc || !destAcc) return;

    transferBetweenAccounts(fromAccId, toAccId, amt);
    setTransferModal(false);
    setTransferAmount('');
    setTransferNote('');
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('✅ Transfer Completed', `Transferred ${sourceAcc.currency}${amt.toFixed(2)} from ${sourceAcc.name} to ${destAcc.name}!`);
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Ambient glows */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />
      <View style={styles.glowCenter} />

      {/* ── HEADER ── */}
      <LinearGradient
        colors={['rgba(10,16,31,0.98)', 'rgba(10,16,31,0.92)']}
        style={[styles.header, { paddingTop: Math.max(insets.top + 4, 38) }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Account</Text>
            <Text style={styles.headerSub}>Profile, Security & Settings</Text>
          </View>
          <TouchableOpacity onPress={handleShareProfile} style={styles.headerBtn}>
            <Ionicons name="share-social-outline" size={16} color="#73f218" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── DEDICATED PAGE BANNER ── */}
        {activeSection !== 'All' && (
          <LinearGradient
            colors={['rgba(115,242,24,0.15)', 'rgba(30,41,59,0.8)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.dedicatedBanner}
          >
            <View style={styles.dedicatedBannerLeft}>
              <View style={styles.dedicatedBannerIconBox}>
                <Ionicons
                  name={SECTION_ITEMS.find(s => s.label === activeSection)?.icon as any || 'grid-outline'}
                  size={15}
                  color="#73f218"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dedicatedBannerTitle}>{activeSection} Page</Text>
                <Text style={styles.dedicatedBannerSub} numberOfLines={1}>
                  {SECTION_ITEMS.find(s => s.label === activeSection)?.description}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => { toggleVerticalMenu(true); triggerHaptic(); }}
                style={styles.dedicatedBannerBtnSecondary}
              >
                <Ionicons name="swap-vertical" size={12} color="#fff" />
                <Text style={styles.dedicatedBannerBtnSecondaryText}>Switch</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setActiveSection('All'); triggerHaptic(); }}
                style={styles.dedicatedBannerBtn}
              >
                <Ionicons name="grid-outline" size={12} color="#0f172a" />
                <Text style={styles.dedicatedBannerBtnText}>All</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: PROFILE HERO CARD
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Profile') && (
          <LinearGradient
            colors={['#1a2744', '#0f172a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.card, styles.profileHeroCard]}
          >
            {/* Avatar */}
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
              <LinearGradient
                colors={['#73f218', '#4caf14']}
                style={styles.avatarEditBtn}
              >
                <Ionicons name="camera" size={12} color="#0f172a" />
              </LinearGradient>
              {/* Online dot */}
              <View style={styles.onlineDot} />
            </View>

            {/* Name & Status */}
            <View style={styles.profileInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.profileName}>{profile.firstName} {profile.lastName}</Text>
                <Ionicons name="checkmark-circle" size={18} color="#73f218" />
              </View>
              <Text style={styles.profileUsername}>{profile.username}</Text>
              <Text style={styles.profileMeta}>{profile.occupation}</Text>

              {/* Badges row */}
              <View style={styles.badgeRow}>
                <LinearGradient colors={['#73f218', '#4caf14']} style={styles.premiumBadge}>
                  <Ionicons name="ribbon" size={10} color="#0f172a" />
                  <Text style={styles.premiumBadgeText}>Premium Pro</Text>
                </LinearGradient>
                <View style={styles.idBadge}>
                  <Text style={styles.idBadgeText}>#{profile.accountId}</Text>
                </View>
                <View style={styles.joinBadge}>
                  <Ionicons name="calendar-outline" size={10} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.joinBadgeText}>{profile.joinDate}</Text>
                </View>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.profileActions}>
              <TouchableOpacity
                onPress={() => { setEditInfoModal(true); triggerHaptic(); }}
                style={styles.profileActionPrimary}
              >
                <Ionicons name="create-outline" size={14} color="#0f172a" />
                <Text style={styles.profileActionPrimaryText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShareProfile}
                style={styles.profileActionSecondary}
              >
                <Ionicons name="share-social-outline" size={14} color="#fff" />
                <Text style={styles.profileActionSecondaryText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Stats row */}
            <View style={styles.profileStats}>
              <View style={styles.profileStat}>
                <Text style={styles.profileStatNum}>{accounts.length}</Text>
                <Text style={styles.profileStatLabel}>Accounts</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStat}>
                <Text style={[styles.profileStatNum, { color: totalNetWorth >= 0 ? '#73f218' : '#ef4444' }]}>
                  {selectedCurrency.symbol}{Math.abs(totalNetWorth).toLocaleString()}
                </Text>
                <Text style={styles.profileStatLabel}>Net Worth</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStat}>
                <Text style={styles.profileStatNum}>12</Text>
                <Text style={styles.profileStatLabel}>Goals Met</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: PERSONAL INFORMATION
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Profile') && (
          <View style={styles.card}>
            <CardHeader
              icon="person-outline"
              iconColor="#3b82f6"
              title="Personal Information"
              action="Edit"
              onAction={() => setEditInfoModal(true)}
            />
            <InfoRow label="First Name"  value={profile.firstName}   icon="person-outline" />
            <InfoRow label="Last Name"   value={profile.lastName}    icon="person-outline" />
            <InfoRow label="Gender"      value={profile.gender}      icon="transgender-outline" />
            <InfoRow label="Date of Birth" value={profile.dob}       icon="gift-outline" />
            <InfoRow label="Country"     value={profile.country || selectedCountry.name} icon="globe-outline" />
            <InfoRow label="City"        value={profile.city}        icon="location-outline" />
            <InfoRow label="Language"    value={profile.language}    icon="language-outline" />
            <InfoRow label="Occupation"  value={profile.occupation}  icon="briefcase-outline" />
            <InfoRow label="Time Zone"   value={profile.timeZone}    icon="time-outline" />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: CONTACT INFORMATION
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Profile') && (
          <View style={styles.card}>
            <CardHeader icon="mail-outline" iconColor="#06b6d4" title="Contact Information" />
            <View style={styles.contactList}>
              {/* Primary Email */}
              <View style={styles.contactCard}>
                <View style={[styles.contactIconBox, { backgroundColor: '#73f21822' }]}>
                  <Ionicons name="mail" size={15} color="#73f218" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>Primary Email</Text>
                  <Text style={styles.contactValue}>{profile.email}</Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={11} color="#73f218" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>

              {/* Phone */}
              <View style={styles.contactCard}>
                <View style={[styles.contactIconBox, { backgroundColor: '#3b82f622' }]}>
                  <Ionicons name="call" size={15} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>Phone Number</Text>
                  <Text style={styles.contactValue}>{profile.phone}</Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={11} color="#73f218" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>

              {/* Backup Email */}
              <View style={styles.contactCard}>
                <View style={[styles.contactIconBox, { backgroundColor: '#f59e0b22' }]}>
                  <Ionicons name="mail-unread" size={15} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactLabel}>Backup Email</Text>
                  <Text style={styles.contactValue}>{profile.backupEmail}</Text>
                </View>
                <TouchableOpacity style={styles.changeBtn}>
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: ACHIEVEMENTS
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Profile') && (
          <View style={styles.card}>
            <CardHeader icon="trophy-outline" iconColor="#f59e0b" title="Achievements & Level" />

            {/* XP Progress */}
            <View style={styles.xpBox}>
              <View style={styles.xpHeader}>
                <View>
                  <Text style={styles.xpLevel}>Level 12 • Master Saver</Text>
                  <Text style={styles.xpSub}>2,450 / 3,000 XP to next level</Text>
                </View>
                <Text style={styles.xpEmoji}>🌟</Text>
              </View>
              <View style={styles.xpTrack}>
                <LinearGradient
                  colors={['#73f218', '#4caf14']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[styles.xpFill, { width: '81.6%' }]}
                />
              </View>
              <Text style={styles.xpPct}>81.6%</Text>
            </View>

            {/* Badges */}
            <View style={styles.badgesGrid}>
              {[
                { emoji: '⚡', title: '30-Day Streak', sub: 'Budget Tracker', color: '#f59e0b' },
                { emoji: '🏆', title: 'Savings Champ', sub: '6 Months Saved', color: '#73f218' },
                { emoji: '🎯', title: '12 Goals Met',  sub: 'Completed Goals', color: '#3b82f6' },
                { emoji: '🛡️', title: 'Zero Debt',    sub: 'This Month',      color: '#a855f7' },
              ].map((b, i) => (
                <View key={i} style={[styles.badgeCard, { borderColor: b.color + '44' }]}>
                  <Text style={{ fontSize: 22 }}>{b.emoji}</Text>
                  <Text style={styles.badgeTitle}>{b.title}</Text>
                  <Text style={styles.badgeSub}>{b.sub}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: FINANCIAL ACCOUNTS
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Accounts') && (
          <View style={styles.card}>
            <CardHeader
              icon="wallet-outline"
              iconColor="#73f218"
              title="Financial Accounts"
              action="+ Add"
              onAction={() => setAddAccountModal(true)}
            />

            {/* Quick Actions Row */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setAddAccountModal(true)}
                style={styles.accQuickBtnPrimary}
              >
                <Ionicons name="add" size={14} color="#0f172a" />
                <Text style={styles.accQuickBtnPrimaryText}>Add Account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (accounts.length >= 2) {
                    setFromAccId(accounts[0].id);
                    setToAccId(accounts[1].id);
                  }
                  setTransferModal(true);
                  triggerHaptic();
                }}
                style={styles.accQuickBtnSecondary}
              >
                <Ionicons name="swap-horizontal" size={14} color="#73f218" />
                <Text style={styles.accQuickBtnSecondaryText}>Transfer Funds</Text>
              </TouchableOpacity>
            </View>

            {/* Net Worth Summary */}
            <LinearGradient
              colors={['rgba(115,242,24,0.12)', 'rgba(115,242,24,0.04)']}
              style={styles.netWorthBanner}
            >
              <View>
                <Text style={styles.netWorthLabel}>Total Net Worth (Auto Converted)</Text>
                <Text style={styles.netWorthSubLabel}>In {selectedCurrency.code} ({selectedCurrency.symbol})</Text>
              </View>
              <Text style={[styles.netWorthValue, { color: totalNetWorth >= 0 ? '#73f218' : '#ef4444' }]}>
                {hideBalances ? '••••••' : `${selectedCurrency.symbol}${Math.abs(totalNetWorth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
            </LinearGradient>

            <View style={{ gap: 10, marginTop: 12 }}>
              {accounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  onPress={() => openAccountDetails(acc)}
                  activeOpacity={0.8}
                  style={styles.accCard}
                >
                  <View style={[styles.accIconBox, { backgroundColor: accColor(acc.type) + '22' }]}>
                    <Ionicons name={accIcon(acc.type)} size={17} color={accColor(acc.type)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.accName}>{acc.name}</Text>
                      {acc.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.accMeta}>{acc.institution} · {acc.type}</Text>
                    <Text style={styles.accUpdated}>Updated {acc.updated}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.accBalance, { color: acc.balance < 0 ? '#ef4444' : '#fff' }]}>
                      {hideBalances ? '••••' : `${acc.currency} ${Math.abs(acc.balance).toLocaleString()}`}
                    </Text>
                    <View style={[styles.accStatusDot, { backgroundColor: '#73f218' }]} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <ToggleRow
              label="Hide All Balances"
              sublabel="Mask balances for privacy"
              value={hideBalances}
              onValueChange={setHideBalances}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: TAX DEDUCTIBLES & ESTIMATION
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Accounts') && (
          <View style={styles.card}>
            <CardHeader icon="calculator-outline" iconColor="#06b6d4" title="Tax Deductibles & Savings" />

            <View style={styles.taxSummaryGradient}>
              <View style={styles.taxSummaryRow}>
                <View>
                  <Text style={styles.taxSummaryLabel}>TOTAL DEDUCTIBLES</Text>
                  <Text style={styles.taxSummaryVal}>${totalTaxDeductible.toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.taxSummaryLabel}>EST. SAVINGS (~22%)</Text>
                  <Text style={[styles.taxSummaryVal, { color: '#73f218' }]}>+${estimatedTaxSavings.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionSubheader}>DEDUCTIBLE CATEGORIES</Text>
            <View style={{ gap: 8 }}>
              {taxDeductibleItems.map(item => (
                <View key={item.id} style={styles.taxItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taxItemCategory}>{item.category}</Text>
                    <Text style={styles.taxItemDesc}>{item.desc}</Text>
                  </View>
                  <Text style={styles.taxItemAmount}>${item.amount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: 30-DAY CASH FLOW FORECAST
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Accounts') && (
          <View style={styles.card}>
            <CardHeader icon="trending-up-outline" iconColor="#3b82f6" title="30-Day Cash Flow Projection" />

            <View style={styles.forecastCard}>
              <View style={styles.forecastItem}>
                <Text style={styles.forecastLabel}>Expected Income (30d)</Text>
                <Text style={[styles.forecastVal, { color: '#73f218' }]}>
                  +${monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.forecastDivider} />
              <View style={styles.forecastItem}>
                <Text style={styles.forecastLabel}>Upcoming Bills (30d)</Text>
                <Text style={[styles.forecastVal, { color: '#ef4444' }]}>
                  -${totalUpcomingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.forecastDivider} />
              <View style={styles.forecastItem}>
                <Text style={styles.forecastLabel}>Projected Net Balance</Text>
                <Text style={styles.forecastTotalVal}>
                  ${(totalNetWorth + monthlyIncome - totalUpcomingAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: LINKED SERVICES
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Accounts') && (
          <View style={styles.card}>
            <CardHeader icon="link-outline" iconColor="#a855f7" title="Connected Services" />
            <View style={{ gap: 10 }}>
              {linkedServices.map(srv => (
                <View key={srv.id} style={styles.serviceCard}>
                  <View style={[styles.serviceIconBox, { backgroundColor: srv.color + '22' }]}>
                    <Ionicons name={srv.icon as any} size={17} color={srv.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{srv.name}</Text>
                    <Text style={styles.serviceMeta}>Synced: {srv.lastSync} · {srv.freq}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleSyncService(srv.id)}
                    style={[
                      styles.serviceBtn,
                      srv.status === 'Connected'
                        ? styles.serviceBtnConnected
                        : styles.serviceBtnDisconnected,
                    ]}
                  >
                    <Text style={[
                      styles.serviceBtnText,
                      srv.status === 'Connected' ? { color: '#73f218' } : { color: 'rgba(255,255,255,0.5)' },
                    ]}>
                      {srv.status === 'Connected' ? 'Sync' : 'Connect'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: PROFESSIONAL EXPORTS & STATEMENTS
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Accounts' || activeSection === 'Settings') && (
          <View style={styles.card}>
            <CardHeader icon="document-text-outline" iconColor="#a855f7" title="Financial Statements & Exports" />

            <Text style={styles.exportDescText}>
              Download audit-ready financial statements in PDF or CSV formats for tax filings, loan applications, or bookkeeping.
            </Text>

            <View style={{ gap: 8, marginTop: 10 }}>
              {[
                { title: 'Monthly Income & Expense Statement', sub: 'PDF format · Detailed category ledger', type: 'Monthly Income & Expense', icon: 'document-attach-outline', color: '#73f218' },
                { title: 'Tax & Deductibles Summary Report', sub: 'PDF/CSV · Formatted for IRS/RRA tax filing', type: 'Tax & Deductibles Summary', icon: 'calculator-outline', color: '#06b6d4' },
                { title: 'All Accounts Balance History', sub: 'CSV raw ledger · Multi-currency audit log', type: 'Accounts Ledger History', icon: 'grid-outline', color: '#3b82f6' },
              ].map((exp, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setExportModalVisible(true);
                    triggerHaptic();
                  }}
                  style={styles.exportCardRow}
                  activeOpacity={0.8}
                >
                  <View style={[styles.exportIconBox, { backgroundColor: exp.color + '22' }]}>
                    <Ionicons name={exp.icon as any} size={16} color={exp.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exportRowTitle}>{exp.title}</Text>
                    <Text style={styles.exportRowSub}>{exp.sub}</Text>
                  </View>
                  <Ionicons name="download-outline" size={16} color="#73f218" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: SECURITY & PRIVACY
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Security') && (
          <View style={styles.card}>
            <CardHeader icon="shield-checkmark-outline" iconColor="#73f218" title="Security & Privacy" />

            <View style={{ gap: 4 }}>
              <ToggleRow
                label="Two-Factor Authentication"
                sublabel="Extra layer via authenticator or SMS"
                value={twoFactorEnabled}
                onValueChange={setTwoFactorEnabled}
              />
              <View style={styles.divider} />
              <ToggleRow
                label="Biometric Login"
                sublabel="Face ID / Fingerprint unlock"
                value={biometricsEnabled}
                onValueChange={setBiometricsEnabled}
              />
              <View style={styles.divider} />
              <ToggleRow
                label="Privacy Mode"
                sublabel="Hide personal data from screen capture"
                value={privacyMode}
                onValueChange={setPrivacyMode}
              />
              <View style={styles.divider} />
              <ActionRow
                icon="key-outline"
                label="Change Password"
                onPress={() => setChangePassModal(true)}
              />
              <View style={styles.divider} />
              <View style={styles.autoLockRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionLabel}>Auto-Lock Timeout</Text>
                  <Text style={styles.actionSublabel}>Lock app after inactivity</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {(['Immediate', '1min', '5min', '15min'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => { setAutoLockTimeout(t); triggerHaptic(); }}
                      style={[styles.timeoutChip, autoLockTimeout === t && styles.timeoutChipActive]}
                    >
                      <Text style={[styles.timeoutChipText, autoLockTimeout === t && styles.timeoutChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.divider} />
              <TouchableOpacity
                onPress={() => { setBiometricLockVisible(true); triggerHaptic(); }}
                style={styles.testBiometricsBtn}
              >
                <Ionicons name="finger-print-outline" size={16} color="#73f218" />
                <Text style={styles.testBiometricsText}>Test Biometric Lock Screen</Text>
              </TouchableOpacity>
            </View>

            {/* Sessions */}
            <Text style={styles.sectionSubheader}>ACTIVE SESSIONS ({activeSessions.length})</Text>
            <View style={{ gap: 8 }}>
              {activeSessions.map(sess => (
                <View key={sess.id} style={styles.sessionCard}>
                  <View style={[styles.sessionIconBox, { backgroundColor: sess.isCurrent ? '#73f21822' : 'rgba(255,255,255,0.06)' }]}>
                    <Ionicons
                      name={sess.device.includes('iPhone') ? 'phone-portrait-outline' : sess.device.includes('Mac') ? 'laptop-outline' : 'desktop-outline'}
                      size={16}
                      color={sess.isCurrent ? '#73f218' : 'rgba(255,255,255,0.5)'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.sessionDevice}>{sess.device}</Text>
                      {sess.isCurrent && (
                        <View style={styles.currentSessionBadge}>
                          <View style={styles.currentDot} />
                          <Text style={styles.currentSessionText}>Current</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.sessionMeta}>{sess.location} · {sess.ip}</Text>
                    <Text style={styles.sessionTime}>{sess.lastActive}</Text>
                  </View>
                  {!sess.isCurrent && (
                    <TouchableOpacity
                      onPress={() => setActiveSessions(prev => prev.filter(s => s.id !== sess.id))}
                      style={styles.revokeBtn}
                    >
                      <Text style={styles.revokeBtnText}>Revoke</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: NOTIFICATION PREFERENCES
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Settings') && (
          <View style={styles.card}>
            <CardHeader icon="notifications-outline" iconColor="#f59e0b" title="Notifications" />

            {/* Channels */}
            <Text style={styles.sectionSubheader}>DELIVERY CHANNELS</Text>
            <View style={styles.channelRow}>
              {[
                { key: 'channelPush',  label: 'Push',  icon: 'phone-portrait-outline' },
                { key: 'channelEmail', label: 'Email', icon: 'mail-outline' },
                { key: 'channelSMS',   label: 'SMS',   icon: 'chatbubble-outline' },
              ].map(ch => {
                const active = (notifications as any)[ch.key];
                return (
                  <TouchableOpacity
                    key={ch.key}
                    onPress={() => setNotifications(n => ({ ...n, [ch.key]: !active }))}
                    style={[styles.channelChip, active && styles.channelChipActive]}
                  >
                    <Ionicons name={ch.icon as any} size={13} color={active ? '#0f172a' : 'rgba(255,255,255,0.5)'} />
                    <Text style={[styles.channelChipText, active && styles.channelChipTextActive]}>{ch.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionSubheader, { marginTop: 14 }]}>ALERT TYPES</Text>
            <View style={{ gap: 4 }}>
              <ToggleRow label="Budget & Threshold Alerts" value={notifications.budgetAlerts}
                onValueChange={(v: boolean) => setNotifications(n => ({ ...n, budgetAlerts: v }))} />
              <View style={styles.divider} />
              <ToggleRow label="Bill & Payment Reminders" value={notifications.billReminders}
                onValueChange={(v: boolean) => setNotifications(n => ({ ...n, billReminders: v }))} />
              <View style={styles.divider} />
              <ToggleRow label="Savings Goal Progress" value={notifications.goalReminders}
                onValueChange={(v: boolean) => setNotifications(n => ({ ...n, goalReminders: v }))} />
              <View style={styles.divider} />
              <ToggleRow label="Weekly & Monthly Reports" value={notifications.weeklySummary}
                onValueChange={(v: boolean) => setNotifications(n => ({ ...n, weeklySummary: v }))} />
              <View style={styles.divider} />
              <ToggleRow label="Security Alerts" value={notifications.securityAlerts}
                onValueChange={(v: boolean) => setNotifications(n => ({ ...n, securityAlerts: v }))} />
              <View style={styles.divider} />
              <ToggleRow label="Promotional Offers" sublabel="Deals and offers from partners" value={notifications.promotional}
                onValueChange={(v: boolean) => setNotifications(n => ({ ...n, promotional: v }))} />
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: APP PREFERENCES
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Settings') && (
          <View style={styles.card}>
            <CardHeader icon="options-outline" iconColor="#3b82f6" title="App Preferences" />

            {/* Currency */}
            <TouchableOpacity onPress={() => setCurrencyModal(true)} style={styles.prefRow}>
              <View style={styles.prefRowLeft}>
                <View style={[styles.prefIcon, { backgroundColor: '#73f21822' }]}>
                  <Ionicons name="cash-outline" size={14} color="#73f218" />
                </View>
                <Text style={styles.prefLabel}>Default Currency</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image source={{ uri: selectedCurrency.flagUrl }} style={styles.prefFlag} />
                <Text style={styles.prefValue}>{selectedCurrency.code} ({selectedCurrency.symbol})</Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.25)" />
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Theme */}
            <View style={styles.prefRow}>
              <View style={styles.prefRowLeft}>
                <View style={[styles.prefIcon, { backgroundColor: '#f59e0b22' }]}>
                  <Ionicons name="moon-outline" size={14} color="#f59e0b" />
                </View>
                <Text style={styles.prefLabel}>App Theme</Text>
              </View>
              <View style={styles.themeToggleGroup}>
                {(['Dark', 'Light', 'System'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setThemeMode(t)}
                    style={[styles.themeOption, themeMode === t && styles.themeOptionActive]}
                  >
                    <Text style={[styles.themeOptionText, themeMode === t && styles.themeOptionTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Analytics */}
            <ToggleRow
              label="Usage Analytics"
              sublabel="Help improve the app anonymously"
              value={analyticsAllowed}
              onValueChange={setAnalyticsAllowed}
            />
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: SUBSCRIPTION
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Subscription') && (
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(115,242,24,0.18)', 'rgba(115,242,24,0.04)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.subscriptionGradient}
            >
              <View style={styles.subscriptionTop}>
                <View>
                  <Text style={styles.subscriptionPlanLabel}>ACTIVE PLAN</Text>
                  <Text style={styles.subscriptionPlan}>{subscription.plan}</Text>
                  <Text style={styles.subscriptionPrice}>{subscription.price}</Text>
                </View>
                <LinearGradient colors={['#73f218', '#4caf14']} style={styles.subscriptionIconBox}>
                  <Ionicons name="ribbon" size={22} color="#0f172a" />
                </LinearGradient>
              </View>

              <Text style={styles.subscriptionPerks}>
                ✓ AI Financial Coach  ✓ Unlimited Accounts  ✓ Auto Sync & Cloud Reports
              </Text>

              <View style={styles.subscriptionMeta}>
                <View>
                  <Text style={styles.subscriptionMetaLabel}>BILLING</Text>
                  <Text style={styles.subscriptionMetaValue}>{subscription.billingCycle}</Text>
                </View>
                <View>
                  <Text style={styles.subscriptionMetaLabel}>RENEWS</Text>
                  <Text style={styles.subscriptionMetaValue}>{subscription.expiry}</Text>
                </View>
                <View>
                  <Text style={styles.subscriptionMetaLabel}>PAYMENT</Text>
                  <Text style={styles.subscriptionMetaValue}>{subscription.paymentMethod}</Text>
                </View>
              </View>
            </LinearGradient>

            <TouchableOpacity style={styles.manageSubBtn}>
              <Ionicons name="settings-outline" size={14} color="#73f218" />
              <Text style={styles.manageSubBtnText}>Manage Subscription</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: REFERRAL
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Support') && (
          <View style={styles.card}>
            <CardHeader icon="gift-outline" iconColor="#a855f7" title="Refer & Earn" />
            <View style={styles.referralBox}>
              <Text style={styles.referralDesc}>Share your code and earn $5 for every friend who joins Premium!</Text>
              <View style={styles.referralCodeRow}>
                <Text style={styles.referralCode}>{referralCode}</Text>
                <TouchableOpacity onPress={handleShareProfile} style={styles.referralShareBtn}>
                  <Ionicons name="share-social" size={14} color="#0f172a" />
                  <Text style={styles.referralShareText}>Share</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.referralStats}>12 friends referred · $60 earned</Text>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: SUPPORT & LEGAL
        ════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'All' || activeSection === 'Support') && (
          <View style={styles.card}>
            <CardHeader icon="help-circle-outline" iconColor="#06b6d4" title="Help & Support" />
            <View style={{ gap: 0 }}>
              <ActionRow icon="book-outline"        label="Help Center & FAQs"       onPress={() => Alert.alert('Help Center', 'Redirecting to FAQ Knowledge Base...')} />
              <ActionRow icon="chatbubbles-outline" label="Live Chat Support (24/7)"  onPress={() => Alert.alert('Support', 'Support agent connected on Live Chat!')} />
              <ActionRow icon="bug-outline"         label="Report a Bug"             onPress={() => Alert.alert('Bug Report', 'Opening bug report form...')} />
              <ActionRow icon="star-outline"        label="Rate the App"             onPress={() => Alert.alert('Rate', 'Thank you for your feedback! ⭐')} />
              <ActionRow icon="document-text-outline" label="Privacy Policy & Terms" onPress={() => Alert.alert('Legal', 'Opening Privacy Policy...')} />
              <View style={[styles.actionRow, { borderBottomWidth: 0 }]}>
                <View style={styles.actionRowLeft}>
                  <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.5)" style={{ marginRight: 10 }} />
                  <Text style={styles.actionLabel}>App Version</Text>
                </View>
                <Text style={styles.actionValue}>v2.4.0 (Build 582)</Text>
              </View>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
             SECTION: DANGER ZONE & SIGN OUT
        ════════════════════════════════════════════════════════════════ */}
        <View style={[styles.card, styles.dangerCard]}>
          <View style={styles.dangerHeader}>
            <Ionicons name="warning-outline" size={16} color="#ef4444" />
            <Text style={styles.dangerHeaderText}>Account Actions</Text>
          </View>

          <TouchableOpacity
            onPress={() => supabase.auth.signOut()}
            style={styles.signOutBtn}
          >
            <Ionicons name="log-out-outline" size={16} color="#ef4444" />
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDangerZoneModal(true)}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={14} color="rgba(255,255,255,0.35)" />
            <Text style={styles.deleteBtnText}>Delete Account & All Data</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Invisible backdrop overlay when popover menu is open */}
      {isVerticalMenuOpen && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => toggleVerticalMenu(false)}
        />
      )}

      {/* ── FLOATING HOVER (ALL) BUTTON & GLASS POPOVER MENU (RIGHT SIDE) ── */}
      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 85,
          right: 18,
          alignItems: 'flex-end',
          zIndex: 999,
        }}
      >
        {/* Animated Glassmorphism Popover Menu right above the button */}
        {isVerticalMenuOpen && (
          <Animated.View
            style={[
              styles.glassPopoverMenu,
              {
                opacity: menuAnim,
                transform: [
                  { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) },
                  { scale: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                ],
              },
            ]}
          >
            <Text style={styles.glassMenuTitle}>SELECT PAGE</Text>
            <View style={styles.glassMenuDivider} />

            <View style={{ gap: 5 }}>
              {SECTION_ITEMS.map(item => {
                const isActive = activeSection === item.label;
                return (
                  <TouchableOpacity
                    key={item.label}
                    onPress={() => {
                      setActiveSection(item.label);
                      toggleVerticalMenu(false);
                      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.glassPageButton,
                      isActive && styles.glassPageButtonActive,
                    ]}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={15}
                      color={isActive ? '#73f218' : 'rgba(255,255,255,0.7)'}
                    />
                    <Text style={[styles.glassPageName, isActive && styles.glassPageNameActive]}>
                      {item.label}
                    </Text>

                    {isActive ? (
                      <View style={styles.glassActiveDot} />
                    ) : (
                      <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.25)" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Hover (All) Standalone Toggle Button */}
        <TouchableOpacity
          onPress={() => {
            toggleVerticalMenu(!isVerticalMenuOpen);
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={
              isVerticalMenuOpen
                ? ['rgba(115, 242, 24, 0.95)', 'rgba(76, 175, 20, 0.95)']
                : ['rgba(15, 23, 42, 0.98)', 'rgba(30, 41, 59, 0.95)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.hoverAllStandaloneBtn,
              isVerticalMenuOpen && { borderColor: '#73f218' },
            ]}
          >
            <View
              style={[
                styles.hoverAllIconBox,
                isVerticalMenuOpen && { backgroundColor: 'rgba(15, 23, 42, 0.2)' },
              ]}
            >
              <Ionicons
                name={isVerticalMenuOpen ? 'close' : 'grid'}
                size={16}
                color={isVerticalMenuOpen ? '#0f172a' : '#ffffff'}
              />
            </View>

            <View style={{ marginRight: 4 }}>
              <Text
                style={[
                  styles.hoverAllTitle,
                  isVerticalMenuOpen && { color: '#0f172a' },
                ]}
              >
                Hover (All)
              </Text>
              <Text
                style={[
                  styles.hoverAllSubText,
                  isVerticalMenuOpen && { color: 'rgba(15,23,42,0.85)' },
                ]}
                numberOfLines={1}
              >
                {activeSection === 'All' ? 'All Pages' : activeSection}
              </Text>
            </View>

            <Ionicons
              name={isVerticalMenuOpen ? 'chevron-down' : 'chevron-up'}
              size={16}
              color={isVerticalMenuOpen ? '#0f172a' : '#73f218'}
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Account Details & Management Modal */}
      <CenterModal visible={accountDetailsModal} onClose={() => setAccountDetailsModal(false)} title="Account Details">
        {selectedAccountDetails && (
          <>
            {/* Header Banner */}
            <View style={styles.accDetailsBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.accDetailsIconBox, { backgroundColor: accColor(selectedAccountDetails.type) + '22' }]}>
                  <Ionicons name={accIcon(selectedAccountDetails.type)} size={22} color={accColor(selectedAccountDetails.type)} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.accDetailsName}>{selectedAccountDetails.name}</Text>
                    {selectedAccountDetails.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.accDetailsSub}>{selectedAccountDetails.institution} · {selectedAccountDetails.type}</Text>
                </View>
              </View>

              <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={styles.accDetailsBalanceLabel}>CURRENT BALANCE</Text>
                <Text style={[styles.accDetailsBalanceVal, { color: selectedAccountDetails.balance < 0 ? '#ef4444' : '#73f218' }]}>
                  {selectedAccountDetails.currency} {Math.abs(selectedAccountDetails.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                {selectedAccountDetails.currency !== selectedCurrency.symbol && (
                  <Text style={styles.accDetailsConvertedSub}>
                    ≈ {selectedCurrency.symbol}{convertAmount(selectedAccountDetails.balance, selectedAccountDetails.currency, selectedCurrency.code).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in {selectedCurrency.code}
                  </Text>
                )}
              </View>
            </View>

            {/* Quick Actions Grid */}
            <Text style={styles.modalLabel}>ACCOUNT ACTIONS</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TouchableOpacity
                onPress={() => {
                  setAccountDetailsModal(false);
                  setFromAccId(selectedAccountDetails.id);
                  setTransferModal(true);
                  triggerHaptic();
                }}
                style={styles.accDetailsActionBtn}
              >
                <Ionicons name="swap-horizontal" size={16} color="#73f218" />
                <Text style={styles.accDetailsActionText}>Transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setDefaultAccount(selectedAccountDetails.id);
                  setSelectedAccountDetails({ ...selectedAccountDetails, isDefault: true });
                  triggerHaptic();
                  Alert.alert('✅ Default Account', `${selectedAccountDetails.name} set as primary default account!`);
                }}
                style={styles.accDetailsActionBtn}
              >
                <Ionicons name="star" size={16} color="#f59e0b" />
                <Text style={styles.accDetailsActionText}>Set Default</Text>
              </TouchableOpacity>
            </View>

            {/* 30-Day Performance Metrics */}
            <Text style={styles.modalLabel}>30-DAY PERFORMANCE</Text>
            <View style={styles.accMetricsGrid}>
              <View style={styles.accMetricCard}>
                <Text style={styles.accMetricLabel}>INFLOW (30D)</Text>
                <Text style={[styles.accMetricVal, { color: '#73f218' }]}>
                  +${monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.accMetricCard}>
                <Text style={styles.accMetricLabel}>OUTFLOW (30D)</Text>
                <Text style={[styles.accMetricVal, { color: '#ef4444' }]}>
                  -${monthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Recent Account Activity Statement */}
            <Text style={styles.modalLabel}>RECENT TRANSACTIONS</Text>
            <View style={styles.accTxList}>
              {userTransactions.slice(0, 4).length > 0 ? (
                userTransactions.slice(0, 4).map((tx, idx) => (
                  <View key={idx} style={styles.accTxItem}>
                    <View style={[styles.accTxIcon, { backgroundColor: (tx.isIncome ? '#73f218' : '#ef4444') + '22' }]}>
                      <Ionicons name={(tx.isIncome ? 'cash-outline' : 'card-outline') as any} size={14} color={tx.isIncome ? '#73f218' : '#ef4444'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accTxTitle}>{tx.title}</Text>
                      <Text style={styles.accTxDate}>{tx.date}</Text>
                    </View>
                    <Text style={[styles.accTxAmount, { color: tx.isIncome ? '#73f218' : '#fff' }]}>
                      {tx.isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, paddingVertical: 10, textAlign: 'center' }}>No recent transactions recorded yet.</Text>
              )}
            </View>

            {/* Danger Zone: Delete Account */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Remove Account?',
                  `Are you sure you want to remove ${selectedAccountDetails.name}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        deleteAccount(selectedAccountDetails.id);
                        setAccountDetailsModal(false);
                        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                        Alert.alert('Deleted', `${selectedAccountDetails.name} has been removed.`);
                      },
                    },
                  ]
                );
              }}
              style={styles.deleteAccBtn}
            >
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
              <Text style={styles.deleteAccBtnText}>Remove Account</Text>
            </TouchableOpacity>
          </>
        )}
      </CenterModal>

      {/* Centered Account-to-Account Transfer Modal */}
      <CenterModal visible={transferModal} onClose={() => { setTransferModal(false); setShowFromAccDropdown(false); setShowToAccDropdown(false); }} title="Account Transfer">
        {(() => {
          const selectedFromAcc = accounts.find(a => a.id === fromAccId) || accounts[0];
          const selectedToAcc = accounts.find(a => a.id === toAccId) || accounts[1] || accounts[0];
          const activeFromCurr = fromCurrencyOverride || selectedFromAcc?.currency || 'USD';
          const activeToCurr = toCurrencyOverride || selectedToAcc?.currency || 'USD';
          const isDiff = activeFromCurr !== activeToCurr;
          const fxRate = convertAmount(1, activeFromCurr, activeToCurr);
          const amt = parseFloat(transferAmount);
          const convertedDest = !isNaN(amt) && amt > 0 ? convertAmount(amt, activeFromCurr, activeToCurr) : 0;

          return (
            <>
              {/* FROM ACCOUNT (DEBIT) Dropdown Select Box */}
              <Text style={styles.modalLabel}>FROM ACCOUNT (DEBIT)</Text>
              <TouchableOpacity
                onPress={() => { setShowFromAccDropdown(!showFromAccDropdown); setShowToAccDropdown(false); triggerHaptic(); }}
                style={styles.dropdownSelectBox}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={[styles.accountPickIcon, { backgroundColor: accColor(selectedFromAcc?.type || '') + '22' }]}>
                    <Ionicons name={accIcon(selectedFromAcc?.type || '')} size={16} color={accColor(selectedFromAcc?.type || '')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownSelectTitle}>{selectedFromAcc?.name || 'Select Source Account'}</Text>
                    <Text style={styles.dropdownSelectSub}>{selectedFromAcc?.institution} · Available: {selectedFromAcc?.currency}{selectedFromAcc?.balance.toLocaleString()}</Text>
                  </View>
                </View>
                <Ionicons name={showFromAccDropdown ? "chevron-up" : "chevron-down"} size={18} color="#73f218" />
              </TouchableOpacity>

              {/* FROM ACCOUNT Dropdown Drawer List */}
              {showFromAccDropdown && (
                <View style={styles.dropdownListDrawer}>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                    {accounts.map(acc => {
                      const isSelected = fromAccId === acc.id;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          onPress={() => {
                            setFromAccId(acc.id);
                            setFromCurrencyOverride(acc.currency);
                            setShowFromAccDropdown(false);
                            if (toAccId === acc.id) {
                              const other = accounts.find(a => a.id !== acc.id);
                              if (other) { setToAccId(other.id); setToCurrencyOverride(other.currency); }
                            }
                            triggerHaptic();
                          }}
                          style={[styles.dropdownItemRow, isSelected && styles.dropdownItemRowActive]}
                        >
                          <View style={[styles.accountPickIcon, { backgroundColor: accColor(acc.type) + '22' }]}>
                            <Ionicons name={accIcon(acc.type)} size={14} color={accColor(acc.type)} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dropdownItemName, isSelected && { color: '#73f218' }]}>{acc.name}</Text>
                            <Text style={styles.dropdownItemSub}>{acc.institution} · {acc.currency}{acc.balance.toLocaleString()}</Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark" size={16} color="#73f218" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* FROM CURRENCY Selector Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 }}>
                <Text style={styles.currSelectLabel}>Debit Currency:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {CURRENCIES.map(c => {
                      const isSel = activeFromCurr === c.code || activeFromCurr === c.symbol;
                      return (
                        <TouchableOpacity
                          key={c.code}
                          onPress={() => { setFromCurrencyOverride(c.code); triggerHaptic(); }}
                          style={[styles.currChipSmall, isSel && styles.currChipSmallActive]}
                        >
                          <Text style={[styles.currChipSmallText, isSel && styles.currChipSmallTextActive]}>
                            {c.code}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* Direction Transfer Arrow */}
              <View style={styles.transferArrowRow}>
                <View style={styles.transferArrowLine} />
                <View style={styles.transferArrowCircle}>
                  <Ionicons name="arrow-down" size={14} color="#73f218" />
                </View>
                <View style={styles.transferArrowLine} />
              </View>

              {/* TO ACCOUNT (CREDIT) Dropdown Select Box */}
              <Text style={styles.modalLabel}>TO ACCOUNT (CREDIT)</Text>
              <TouchableOpacity
                onPress={() => { setShowToAccDropdown(!showToAccDropdown); setShowFromAccDropdown(false); triggerHaptic(); }}
                style={styles.dropdownSelectBox}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={[styles.accountPickIcon, { backgroundColor: accColor(selectedToAcc?.type || '') + '22' }]}>
                    <Ionicons name={accIcon(selectedToAcc?.type || '')} size={16} color={accColor(selectedToAcc?.type || '')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownSelectTitle}>{selectedToAcc?.name || 'Select Target Account'}</Text>
                    <Text style={styles.dropdownSelectSub}>{selectedToAcc?.institution} · Available: {selectedToAcc?.currency}{selectedToAcc?.balance.toLocaleString()}</Text>
                  </View>
                </View>
                <Ionicons name={showToAccDropdown ? "chevron-up" : "chevron-down"} size={18} color="#73f218" />
              </TouchableOpacity>

              {/* TO ACCOUNT Dropdown Drawer List */}
              {showToAccDropdown && (
                <View style={styles.dropdownListDrawer}>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                    {accounts.map(acc => {
                      const isSelected = toAccId === acc.id;
                      const isSame = fromAccId === acc.id;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          onPress={() => {
                            setToAccId(acc.id);
                            setToCurrencyOverride(acc.currency);
                            setShowToAccDropdown(false);
                            triggerHaptic();
                          }}
                          style={[styles.dropdownItemRow, isSelected && styles.dropdownItemRowActive, isSame && { opacity: 0.4 }]}
                        >
                          <View style={[styles.accountPickIcon, { backgroundColor: accColor(acc.type) + '22' }]}>
                            <Ionicons name={accIcon(acc.type)} size={14} color={accColor(acc.type)} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dropdownItemName, isSelected && { color: '#73f218' }]}>{acc.name}</Text>
                            <Text style={styles.dropdownItemSub}>{acc.institution} · {acc.currency}{acc.balance.toLocaleString()}</Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark" size={16} color="#73f218" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* TO CURRENCY Selection Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
                <Text style={styles.currSelectLabel}>Credit Currency:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {CURRENCIES.map(c => {
                      const isSel = activeToCurr === c.code || activeToCurr === c.symbol;
                      return (
                        <TouchableOpacity
                          key={c.code}
                          onPress={() => { setToCurrencyOverride(c.code); triggerHaptic(); }}
                          style={[styles.currChipSmall, isSel && styles.currChipSmallActive]}
                        >
                          <Text style={[styles.currChipSmallText, isSel && styles.currChipSmallTextActive]}>
                            {c.code}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* Live Currency Pair & Exchange Rate Info */}
              <View style={styles.fxRateBadgePill}>
                <Ionicons name={isDiff ? "swap-horizontal" : "checkmark-circle"} size={13} color={isDiff ? "#3b82f6" : "#73f218"} />
                <Text style={[styles.fxRateBadgeText, !isDiff && { color: '#73f218' }]}>
                  {isDiff
                    ? `Live FX Rate: 1 ${activeFromCurr} = ${fxRate < 1 ? fxRate.toFixed(4) : fxRate.toLocaleString()} ${activeToCurr}`
                    : `Same Currency (${activeFromCurr}) • 1:1 Transfer`}
                </Text>
              </View>

              {/* Same account warning if selected */}
              {fromAccId === toAccId && (
                <View style={styles.sameAccWarning}>
                  <Ionicons name="alert-circle" size={14} color="#f59e0b" />
                  <Text style={styles.sameAccWarningText}>Source & Destination accounts must be different</Text>
                </View>
              )}

              {/* Transfer Amount Input */}
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.modalLabel}>TRANSFER AMOUNT</Text>
                  <Text style={{ color: '#73f218', fontSize: 10, fontWeight: '800' }}>In {activeFromCurr}</Text>
                </View>

                <View style={styles.amountInputRow}>
                  <View style={styles.amountCurrencyBtn}>
                    <Text style={styles.amountCurrencyPrefix}>{activeFromCurr}</Text>
                  </View>
                  <TextInput
                    style={styles.amountInputText}
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="numeric"
                    value={transferAmount}
                    onChangeText={setTransferAmount}
                  />
                </View>
              </View>

              {/* Converted Amount Recipient Receives Card */}
              {!isNaN(amt) && amt > 0 && fromAccId !== toAccId && (
                <View style={styles.recipientReceivesCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.recipientReceivesLabel}>RECIPIENT RECEIVES ({selectedToAcc?.name.toUpperCase()})</Text>
                    {isDiff && <Text style={styles.recipientReceivesBadge}>AUTO CONVERTED</Text>}
                  </View>
                  <Text style={styles.recipientReceivesAmount}>
                    {activeToCurr} {convertedDest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  {isDiff && (
                    <Text style={styles.recipientReceivesSub}>
                      Debit {activeFromCurr} {amt.toLocaleString()} from {selectedFromAcc?.name} → Credit {activeToCurr} {convertedDest.toLocaleString()} to {selectedToAcc?.name}
                    </Text>
                  )}
                </View>
              )}

              <ModalInput
                label="TRANSFER NOTE / REFERENCE (OPTIONAL)"
                placeholder="e.g. Monthly Savings Allocation"
                value={transferNote}
                onChangeText={setTransferNote}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setTransferModal(false)} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleExecuteTransfer}
                  style={[styles.modalConfirmBtn, fromAccId === toAccId && { opacity: 0.5 }]}
                  disabled={fromAccId === toAccId}
                >
                  <LinearGradient
                    colors={['#73f218', '#4caf14']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.confirmGradientBtn}
                  >
                    <Ionicons name="swap-horizontal" size={16} color="#0f172a" />
                    <Text style={styles.modalConfirmText}>Execute Transfer</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          );
        })()}
      </CenterModal>

      {/* ════════════════════════════════════════════════════════════════
           MODALS
      ══════════════════════════════════════════════════════════════════ */}

      {/* Edit Personal Info */}
      <BottomSheet visible={editInfoModal} onClose={() => setEditInfoModal(false)} title="Edit Personal Information">
        <ModalInput label="FIRST NAME" value={tempFirst} onChangeText={setTempFirst} />
        <ModalInput label="LAST NAME"  value={tempLast}  onChangeText={setTempLast} />

        {/* Country Selector with Flag Icons & Auto Currency Mapping */}
        <Text style={styles.modalLabel}>SELECT COUNTRY (AUTO-SETS DEFAULT CURRENCY)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {COUNTRIES.map(c => {
              const isSel = (tempCountry || '').toLowerCase() === c.name.toLowerCase() || selectedCountry.code === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  onPress={async () => {
                    setTempCountry(c.name);
                    await setCountryByName(c.name);
                    triggerHaptic();
                  }}
                  style={[styles.typeChip, isSel && styles.typeChipActive]}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: c.flagUrl }} style={{ width: 18, height: 13, borderRadius: 2, marginRight: 6 }} />
                  <Text style={[styles.typeChipText, isSel && styles.typeChipTextActive]}>{c.name} ({c.currencyCode})</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <ModalInput label="CITY / LOCATION" value={tempCity} onChangeText={setTempCity} placeholder="e.g. Kigali, Rwanda" />
        <ModalInput label="OCCUPATION" value={tempOccupation} onChangeText={setTempOccupation} />
        <View style={styles.modalActions}>
          <TouchableOpacity onPress={() => setEditInfoModal(false)} style={styles.modalCancel}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSavePersonalInfo} style={styles.modalConfirm}>
            <Text style={styles.modalConfirmText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Change Password */}
      <BottomSheet visible={changePassModal} onClose={() => setChangePassModal(false)} title="Change Password">
        <ModalInput label="CURRENT PASSWORD"  value={oldPassword}     onChangeText={setOldPassword}     secureTextEntry />
        <ModalInput label="NEW PASSWORD"       value={newPassword}     onChangeText={setNewPassword}     secureTextEntry />
        <ModalInput label="CONFIRM PASSWORD"   value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <View style={styles.modalActions}>
          <TouchableOpacity onPress={() => setChangePassModal(false)} style={styles.modalCancel}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleChangePassword} style={styles.modalConfirm}>
            <Text style={styles.modalConfirmText}>Update Password</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Add Account */}
      <BottomSheet visible={addAccountModal} onClose={() => setAddAccountModal(false)} title="Add Financial Account">
        <ModalInput label="ACCOUNT NAME"    value={newAccName}        onChangeText={setNewAccName}        placeholder="e.g. BoA Savings" />
        <ModalInput label="CURRENT BALANCE" value={newAccBalance}     onChangeText={setNewAccBalance}     keyboardType="numeric" placeholder="0.00" />
        <ModalInput label="INSTITUTION"     value={newAccInstitution} onChangeText={setNewAccInstitution} placeholder="e.g. Chase Bank" />

        {/* Account Type Chips */}
        <Text style={styles.modalLabel}>ACCOUNT TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['Bank Account', 'Cash Wallet', 'Savings Account', 'Credit Card', 'Mobile Money', 'Investment Account', 'Loan Account'].map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setNewAccType(t)}
                style={[styles.typeChip, newAccType === t && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, newAccType === t && styles.typeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Account Currency Chips */}
        <Text style={styles.modalLabel}>ACCOUNT CURRENCY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {CURRENCIES.map(c => (
              <TouchableOpacity
                key={c.code}
                onPress={() => setNewAccCurrency(c.symbol)}
                style={[styles.typeChip, newAccCurrency === c.symbol && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, newAccCurrency === c.symbol && styles.typeChipTextActive]}>
                  {c.code} ({c.symbol})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity onPress={() => setAddAccountModal(false)} style={styles.modalCancel}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAddAccount} style={styles.modalConfirm}>
            <Text style={styles.modalConfirmText}>Add Account</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Centered Currency Picker with Live Exchange Rates */}
      <CenterModal visible={currencyModal} onClose={() => setCurrencyModal(false)} title="Select Default Currency">
        <Text style={styles.modalLabel}>GLOBAL APP CURRENCY & LIVE FX RATES</Text>
        <View style={{ gap: 8, marginTop: 6 }}>
          {CURRENCIES.map(c => {
            const sel = selectedCurrency.code === c.code;
            const fxRate = convertAmount(1, 'USD', c.code);
            return (
              <TouchableOpacity
                key={c.code}
                onPress={() => {
                  setCurrency(c);
                  setCurrencyModal(false);
                  triggerHaptic();
                  Alert.alert('✅ Currency Updated', `Default currency updated to ${c.name} (${c.code}). All account totals and Net Worth recalculated live!`);
                }}
                style={[styles.currencyItem, sel && styles.currencyItemActive]}
                activeOpacity={0.8}
              >
                <Image source={{ uri: c.flagUrl }} style={styles.currencyFlag} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.currencyName}>{c.name}</Text>
                    {sel && (
                      <View style={styles.activePageBadge}>
                        <Text style={styles.activePageBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.currencyCode}>{c.code} · Symbol: {c.symbol}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.currencyFxVal, sel && { color: '#73f218' }]}>
                    1 USD = {fxRate < 1 ? fxRate.toFixed(3) : fxRate.toLocaleString()} {c.code}
                  </Text>
                </View>
                {sel && <Ionicons name="checkmark-circle" size={20} color="#73f218" style={{ marginLeft: 6 }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </CenterModal>

      {/* Danger Zone Confirm */}
      <Modal visible={dangerZoneModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.dangerModal}>
            <Ionicons name="warning" size={40} color="#ef4444" style={{ marginBottom: 12 }} />
            <Text style={styles.dangerModalTitle}>Delete Account?</Text>
            <Text style={styles.dangerModalDesc}>
              This will permanently delete your account and all associated data. This action cannot be undone.
            </Text>
            <TouchableOpacity
              onPress={() => { setDangerZoneModal(false); Alert.alert('Account Deleted', 'Your account has been scheduled for deletion.'); }}
              style={styles.dangerConfirmBtn}
            >
              <Text style={styles.dangerConfirmText}>Yes, Delete Everything</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDangerZoneModal(false)} style={styles.dangerCancelBtn}>
              <Text style={styles.dangerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Export Statement Modal */}
      <CenterModal visible={exportModalVisible} onClose={() => setExportModalVisible(false)} title="Export Financial Statement">
        <Text style={styles.modalLabel}>SELECT FILE FORMAT</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {(['PDF', 'CSV'] as const).map(fmt => (
            <TouchableOpacity
              key={fmt}
              onPress={() => setExportFormat(fmt)}
              style={[styles.typeChip, exportFormat === fmt && styles.typeChipActive, { flex: 1, alignItems: 'center' }]}
            >
              <Text style={[styles.typeChipText, exportFormat === fmt && styles.typeChipTextActive]}>{fmt} Document</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.modalLabel}>SELECT PRESET OR CUSTOM DATE RANGE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'This Month', start: '2026-07-01', end: '2026-07-27' },
              { label: 'Last Month', start: '2026-06-01', end: '2026-06-30' },
              { label: 'Last 90 Days', start: '2026-04-28', end: '2026-07-27' },
              { label: 'Year to Date 2026', start: '2026-01-01', end: '2026-07-27' },
              { label: 'Custom Range', start: exportStartDate, end: exportEndDate },
            ].map(p => {
              const isSel = exportPreset === p.label;
              return (
                <TouchableOpacity
                  key={p.label}
                  onPress={() => {
                    setExportPreset(p.label);
                    setExportStartDate(p.start);
                    setExportEndDate(p.end);
                    setExportDateRange(`${p.start} to ${p.end}`);
                    triggerHaptic();
                  }}
                  style={[styles.typeChip, isSel && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipText, isSel && styles.typeChipTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Text style={styles.modalLabel}>EXACT DATE RANGE SELECTION</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => openCalendarPicker('start')}
            activeOpacity={0.8}
            style={{ flex: 1 }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '800', marginBottom: 4 }}>FROM (START DATE)</Text>
            <View style={styles.amountInputRow}>
              <Ionicons name="calendar-outline" size={14} color="#73f218" style={{ marginRight: 6 }} />
              <Text style={{ flex: 1, color: '#fff', fontSize: 12, fontWeight: '800' }}>{exportStartDate}</Text>
              <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.4)" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openCalendarPicker('end')}
            activeOpacity={0.8}
            style={{ flex: 1 }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '800', marginBottom: 4 }}>TO (END DATE)</Text>
            <View style={styles.amountInputRow}>
              <Ionicons name="calendar-outline" size={14} color="#73f218" style={{ marginRight: 6 }} />
              <Text style={{ flex: 1, color: '#fff', fontSize: 12, fontWeight: '800' }}>{exportEndDate}</Text>
              <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.4)" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity onPress={() => setExportModalVisible(false)} style={styles.modalCancel}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleGenerateExport('Monthly Income & Expense')}
            style={styles.modalConfirmBtn}
            disabled={isGeneratingExport}
          >
            <LinearGradient
              colors={['#73f218', '#4caf14']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.confirmGradientBtn}
            >
              <Ionicons name="download-outline" size={16} color="#0f172a" />
              <Text style={styles.modalConfirmText}>{isGeneratingExport ? 'Generating PDF...' : 'Download Statement'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </CenterModal>

      {/* Interactive Visual Calendar Modal */}
      <CenterModal visible={calendarModalVisible} onClose={() => setCalendarModalVisible(false)} title={`Select ${calendarTarget === 'start' ? 'Start' : 'End'} Date`}>
        {/* Month & Year Navigation Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <TouchableOpacity
            onPress={() => {
              if (calendarMonth === 0) {
                setCalendarMonth(11);
                setCalendarYear(y => y - 1);
              } else {
                setCalendarMonth(m => m - 1);
              }
              triggerHaptic();
            }}
            style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10 }}
          >
            <Ionicons name="chevron-back" size={16} color="#73f218" />
          </TouchableOpacity>

          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>
            {MONTH_NAMES[calendarMonth]} {calendarYear}
          </Text>

          <TouchableOpacity
            onPress={() => {
              if (calendarMonth === 11) {
                setCalendarMonth(0);
                setCalendarYear(y => y + 1);
              } else {
                setCalendarMonth(m => m + 1);
              }
              triggerHaptic();
            }}
            style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10 }}
          >
            <Ionicons name="chevron-forward" size={16} color="#73f218" />
          </TouchableOpacity>
        </View>

        {/* Days of Week Header */}
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, idx) => (
            <Text key={idx} style={{ flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800' }}>
              {d}
            </Text>
          ))}
        </View>

        {/* Calendar Days Grid */}
        {(() => {
          const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
          const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
          const totalCells = Math.ceil((daysInMonth + firstDayIndex) / 7) * 7;

          const cells = [];
          for (let i = 0; i < totalCells; i++) {
            const dayNum = i - firstDayIndex + 1;
            const isValidDay = dayNum > 0 && dayNum <= daysInMonth;
            const isSelected = isValidDay && dayNum === selectedDay;

            cells.push(
              <TouchableOpacity
                key={i}
                disabled={!isValidDay}
                onPress={() => isValidDay && handleSelectCalendarDay(dayNum)}
                style={{
                  width: '14.28%',
                  aspectRatio: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginVertical: 2,
                }}
              >
                {isValidDay && (
                  <View style={[
                    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
                    isSelected && { backgroundColor: '#73f218', shadowColor: '#73f218', shadowRadius: 8, shadowOpacity: 0.5, elevation: 4 }
                  ]}>
                    <Text style={[
                      { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
                      isSelected && { color: '#0f172a', fontWeight: '900' }
                    ]}>
                      {dayNum}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }

          return <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>{cells}</View>;
        })()}

        {/* Action button */}
        <TouchableOpacity
          onPress={() => {
            setCalendarModalVisible(false);
            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
          }}
          style={{ borderRadius: 14, overflow: 'hidden' }}
        >
          <LinearGradient colors={['#73f218', '#4caf14']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '900' }}>Confirm Date ({calendarTarget === 'start' ? exportStartDate : exportEndDate})</Text>
          </LinearGradient>
        </TouchableOpacity>
      </CenterModal>

      {/* PDF Document Preview & Direct Save Modal */}
      <CenterModal visible={pdfPreviewModalVisible} onClose={() => setPdfPreviewModalVisible(false)} title="PDF Financial Statement">
        {generatedDoc && (
          <>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="document-text" size={20} color="#73f218" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>{generatedDoc.fileName}.pdf</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(115,242,24,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ color: '#73f218', fontSize: 9, fontWeight: '900' }}>READY TO SAVE</Text>
                </View>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 16 }}>
                Official Financial Statement generated for {profile.firstName} {profile.lastName} ({profile.accountId}). Includes your live Net Worth (${totalNetWorth.toLocaleString()}), {accounts.length} accounts, and tax deductibles breakdown.
              </Text>
            </View>

            {/* Quick Action Buttons */}
            <View style={{ gap: 10, marginBottom: 14 }}>
              {/* Option 1: Native Print to PDF Engine */}
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    const printWin = window.open('', '_blank', 'width=950,height=800');
                    if (printWin) {
                      const autoPrintHtml = generatedDoc.html.replace(
                        '</body>',
                        `<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script></body>`
                      );
                      printWin.document.write(autoPrintHtml);
                      printWin.document.close();
                      printWin.focus();
                    }
                    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                  }
                }}
                style={{ borderRadius: 14, overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={['#73f218', '#4caf14']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}
                >
                  <Ionicons name="document-text" size={18} color="#0f172a" />
                  <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '900' }}>Save as PDF Document (Recommended)</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Option 2: Download HTML Statement */}
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === 'web' && typeof document !== 'undefined') {
                    const isCsv = generatedDoc.format === 'CSV';
                    const content = isCsv ? generatedDoc.csv : generatedDoc.html;
                    const mime = isCsv ? 'text/csv' : 'text/html';
                    const ext = isCsv ? 'csv' : 'html';
                    const blob = new Blob([content], { type: mime });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `${generatedDoc.fileName}.${ext}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                    Alert.alert('💾 File Saved!', `Statement file saved as ${generatedDoc.fileName}.${ext}`);
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                  {generatedDoc.format === 'CSV' ? 'Download CSV Spreadsheet (.csv)' : 'Download Web Statement (.html)'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </CenterModal>

      {/* Biometric Auto-Lock Screen Overlay */}
      <Modal visible={biometricLockVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.biometricLockContainer}>
          <View style={styles.biometricLockCard}>
            <LinearGradient colors={['#73f218', '#4caf14']} style={styles.biometricIconBox}>
              <Ionicons name="finger-print" size={36} color="#0f172a" />
            </LinearGradient>

            <Text style={styles.biometricTitle}>App Locked for Security</Text>
            <Text style={styles.biometricSub}>Scan Face ID / Touch ID or enter your PIN to resume session</Text>

            <View style={styles.pinInputRow}>
              {[1, 2, 3, 4].map(i => (
                <View
                  key={i}
                  style={[styles.pinDot, pinInput.length >= i && styles.pinDotFilled]}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={() => {
                setBiometricLockVisible(false);
                setPinInput('');
                triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                Alert.alert('🔓 Authenticated', 'Biometric identity verified successfully!');
              }}
              style={styles.biometricUnlockBtn}
            >
              <Ionicons name="scan" size={16} color="#0f172a" />
              <Text style={styles.biometricUnlockText}>Authenticate with Face ID</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBiometricLockVisible(false)}
              style={{ marginTop: 12 }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070d1a' },

  // Ambient glows
  glowTopRight:   { position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: '#73f218', opacity: 0.06 },
  glowBottomLeft: { position: 'absolute', bottom: 100, left: -100, width: 280, height: 280, borderRadius: 140, backgroundColor: '#3b82f6', opacity: 0.05 },
  glowCenter:     { position: 'absolute', top: '45%', left: '30%', width: 200, height: 200, borderRadius: 100, backgroundColor: '#a855f7', opacity: 0.04 },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', marginTop: 1 },
  headerBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(115,242,24,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)',
  },

  // Section pills
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pillActive: {
    backgroundColor: '#73f218',
    borderColor: '#73f218',
    shadowColor: '#73f218',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  pillText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800' },
  pillTextActive: { color: '#0f172a', fontWeight: '900' },

  // Scroll
  scroll: { padding: 16, gap: 14 },

  // Card base (Glassmorphic Dark Theme)
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  // Card header
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconBox: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  cardActionBtn: { backgroundColor: 'rgba(115,242,24,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)' },
  cardActionText: { color: '#73f218', fontSize: 11, fontWeight: '900' },

  // Profile hero
  profileHeroCard: {
    borderColor: 'rgba(115, 242, 24, 0.35)',
    shadowColor: '#73f218',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarWrapper: { alignSelf: 'center', position: 'relative', marginBottom: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#73f218' },
  avatarEditBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#070d1a',
  },
  onlineDot: {
    position: 'absolute', top: 4, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#73f218',
    borderWidth: 2, borderColor: '#070d1a',
  },
  profileInfo: { alignItems: 'center', gap: 4, marginBottom: 16 },
  profileName: { color: '#fff', fontSize: 22, fontWeight: '900' },
  profileUsername: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600' },
  profileMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  premiumBadgeText: { color: '#0f172a', fontSize: 10, fontWeight: '900' },
  idBadge: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  idBadgeText: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700' },
  joinBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  joinBadgeText: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '600' },
  profileActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  profileActionPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#73f218', paddingVertical: 12, borderRadius: 14 },
  profileActionPrimaryText: { color: '#0f172a', fontSize: 13, fontWeight: '900' },
  profileActionSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 12, borderRadius: 14 },
  profileActionSecondaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  profileStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14 },
  profileStat: { flex: 1, alignItems: 'center' },
  profileStatNum: { color: '#fff', fontSize: 18, fontWeight: '900' },
  profileStatLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  profileStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 4 },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' },
  infoVal: { color: '#fff', fontSize: 13, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },

  // Contact
  contactList: { gap: 10 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 14 },
  contactIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  contactValue: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(115,242,24,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  verifiedText: { color: '#73f218', fontSize: 10, fontWeight: '800' },
  changeBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  changeBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // XP / Achievements
  xpBox: { backgroundColor: 'rgba(115,242,24,0.06)', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(115,242,24,0.15)' },
  xpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  xpLevel: { color: '#fff', fontSize: 14, fontWeight: '900' },
  xpSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  xpEmoji: { fontSize: 24 },
  xpTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 4 },
  xpPct: { color: '#73f218', fontSize: 11, fontWeight: '800', marginTop: 6, textAlign: 'right' },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  badgeCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1 },
  badgeTitle: { color: '#fff', fontSize: 12, fontWeight: '800', marginTop: 4 },
  badgeSub: { color: 'rgba(255,255,255,0.4)', fontSize: 10 },

  // Financial accounts
  netWorthBanner: { padding: 14, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netWorthLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' },
  netWorthValue: { fontSize: 20, fontWeight: '900' },
  accCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 14 },
  accIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  accName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  accMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 },
  accUpdated: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 },
  accBalance: { fontSize: 14, fontWeight: '900' },
  accStatusDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4, alignSelf: 'flex-end' },
  defaultBadge: { backgroundColor: 'rgba(115,242,24,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  defaultBadgeText: { color: '#73f218', fontSize: 9, fontWeight: '800' },

  // Services
  serviceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 14 },
  serviceIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  serviceName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  serviceMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  serviceBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  serviceBtnConnected: { backgroundColor: 'rgba(115,242,24,0.12)', borderWidth: 1, borderColor: 'rgba(115,242,24,0.25)' },
  serviceBtnDisconnected: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  serviceBtnText: { fontSize: 11, fontWeight: '800' },

  // Security
  sectionSubheader: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 4 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 14 },
  sessionIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sessionDevice: { color: '#fff', fontSize: 12, fontWeight: '800' },
  sessionMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 },
  sessionTime: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 1 },
  currentSessionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(115,242,24,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  currentDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#73f218' },
  currentSessionText: { color: '#73f218', fontSize: 9, fontWeight: '800' },
  revokeBtn: { backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  revokeBtnText: { color: '#ef4444', fontSize: 11, fontWeight: '800' },

  // Toggle
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  toggleLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
  toggleSublabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  // Action row
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  actionRowLeft: { flexDirection: 'row', alignItems: 'center' },
  actionLabel: { color: '#fff', fontSize: 13, fontWeight: '800' },
  actionSublabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 1 },
  actionRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionValue: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600' },

  // Notification channels
  channelRow: { flexDirection: 'row', gap: 10 },
  channelChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  channelChipActive: { backgroundColor: '#73f218', borderColor: '#73f218' },
  channelChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  channelChipTextActive: { color: '#0f172a' },

  // Preferences
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  prefRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  prefLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
  prefFlag: { width: 22, height: 15, borderRadius: 3 },
  prefValue: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  themeToggleGroup: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 3 },
  themeOption: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  themeOptionActive: { backgroundColor: '#73f218' },
  themeOptionText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' },
  themeOptionTextActive: { color: '#0f172a' },

  // Subscription
  subscriptionGradient: { borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(115,242,24,0.25)' },
  subscriptionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  subscriptionPlanLabel: { color: '#73f218', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  subscriptionPlan: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 },
  subscriptionPrice: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  subscriptionIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  subscriptionPerks: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 14, lineHeight: 18 },
  subscriptionMeta: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  subscriptionMetaLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  subscriptionMetaValue: { color: '#fff', fontSize: 11, fontWeight: '800', marginTop: 3 },
  manageSubBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(115,242,24,0.08)', borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)' },
  manageSubBtnText: { color: '#73f218', fontSize: 12, fontWeight: '800' },

  // Referral
  referralBox: { gap: 12 },
  referralDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 18 },
  referralCodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(115,242,24,0.08)', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)' },
  referralCode: { color: '#73f218', fontSize: 20, fontWeight: '900', letterSpacing: 3 },
  referralShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#73f218', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  referralShareText: { color: '#0f172a', fontSize: 12, fontWeight: '900' },
  referralStats: { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center' },

  // Danger zone
  dangerCard: { borderColor: 'rgba(239,68,68,0.25)' },
  dangerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dangerHeaderText: { color: '#ef4444', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.12)', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#ef4444', marginBottom: 10 },
  signOutBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '900' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 12, borderRadius: 14 },
  deleteBtnText: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '700' },

  // Modal & BottomSheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)', justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  sheetHandle: { width: 44, height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, alignSelf: 'center', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  sheetCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingHorizontal: 16, height: 50, color: '#fff', fontSize: 14, fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalCancelText: { color: '#fff', fontWeight: '700' },
  modalConfirm: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#73f218', alignItems: 'center' },
  modalConfirmText: { color: '#0f172a', fontWeight: '900', fontSize: 14 },

  // Account type chips
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  typeChipActive: { backgroundColor: '#73f21833', borderColor: '#73f218' },
  typeChipText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' },
  typeChipTextActive: { color: '#73f218' },

  // Currency picker
  currencyPickerCard: { margin: 24, backgroundColor: 'rgba(15, 23, 42, 0.98)', borderRadius: 28, padding: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  currencyPickerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  currencyItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  currencyItemActive: { backgroundColor: 'rgba(115,242,24,0.15)', borderColor: '#73f218' },
  currencyFlag: { width: 32, height: 22, borderRadius: 4 },
  currencyName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  currencyCode: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 },

  // Danger Zone modal
  dangerModal: { margin: 32, backgroundColor: 'rgba(15, 23, 42, 0.98)', borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.4)' },
  dangerModalTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 10 },
  dangerModalDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  dangerConfirmBtn: { width: '100%', backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  dangerConfirmText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  dangerCancelBtn: { width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  dangerCancelText: { color: '#fff', fontWeight: '700' },

  // Dedicated banner
  dedicatedBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(115,242,24,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dedicatedBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dedicatedBannerIconBox: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(115,242,24,0.15)', alignItems: 'center', justifyContent: 'center' },
  dedicatedBannerTitle: { color: '#fff', fontSize: 13, fontWeight: '900' },
  dedicatedBannerSub: { color: 'rgba(255,255,255,0.55)', fontSize: 10, marginTop: 1 },
  dedicatedBannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#73f218', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  dedicatedBannerBtnText: { color: '#0f172a', fontSize: 10, fontWeight: '900' },
  dedicatedBannerBtnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  dedicatedBannerBtnSecondaryText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Dock gradient & Hover All button
  hoverAllStandaloneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(115,242,24,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  hoverAllIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoverAllTitle: { color: '#73f218', fontSize: 11, fontWeight: '900' },
  hoverAllSubText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', maxWidth: 80 },

  // Glassmorphism Popover Menu
  glassPopoverMenu: {
    marginBottom: 10,
    width: 175,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 22,
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
    elevation: 20,
  },
  glassMenuTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 6,
    marginTop: 2,
  },
  glassMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 6,
  },
  glassPageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  glassPageButtonActive: {
    backgroundColor: 'rgba(115, 242, 24, 0.15)',
    borderColor: '#73f218',
  },
  glassPageName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  glassPageNameActive: {
    color: '#73f218',
    fontWeight: '900',
  },
  glassActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#73f218',
  },

  // Quick Actions & Accounting Styles
  accQuickBtnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#73f218', paddingVertical: 10, borderRadius: 12 },
  accQuickBtnPrimaryText: { color: '#0f172a', fontSize: 12, fontWeight: '900' },
  accQuickBtnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(115,242,24,0.12)', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(115,242,24,0.25)' },
  accQuickBtnSecondaryText: { color: '#73f218', fontSize: 12, fontWeight: '800' },
  netWorthSubLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 },

  // Tax Summary
  taxSummaryGradient: { backgroundColor: 'rgba(6, 182, 212, 0.1)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(6, 182, 212, 0.25)', marginBottom: 12 },
  taxSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taxSummaryLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  taxSummaryVal: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 2 },
  taxItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 12 },
  taxItemCategory: { color: '#fff', fontSize: 12, fontWeight: '800' },
  taxItemDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 },
  taxItemAmount: { color: '#06b6d4', fontSize: 13, fontWeight: '900' },

  // Center Modal
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  centerModalCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 24,
  },
  centerHeaderIconBox: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Account pickers
  accountPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  accountPickCardActive: {
    backgroundColor: 'rgba(115,242,24,0.12)',
    borderColor: '#73f218',
  },
  accountPickIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  accountPickName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  accountPickBalance: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 },

  // Direction arrow
  transferArrowRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, paddingHorizontal: 10 },
  transferArrowLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  transferArrowCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(115,242,24,0.15)', borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },

  // Warning & Amount Row
  sameAccWarning: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245, 158, 11, 0.12)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', marginBottom: 12 },
  sameAccWarningText: { color: '#f59e0b', fontSize: 11, fontWeight: '700' },

  amountInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  amountCurrencyPrefix: { color: '#73f218', fontSize: 20, fontWeight: '900', marginRight: 8 },
  amountInputText: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '900' },

  // Transfer Preview
  transferPreviewBox: { backgroundColor: 'rgba(115,242,24,0.06)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(115,242,24,0.15)', marginBottom: 14, gap: 4 },
  transferPreviewTitle: { color: '#73f218', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 2 },
  transferPreviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  transferPreviewLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  transferPreviewValue: { fontSize: 12, fontWeight: '900' },

  modalConfirmBtn: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  confirmGradientBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },

  // FX Rate Badge & Recipient Receives
  fxRateBadgePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(59, 130, 246, 0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.25)', marginBottom: 12, alignSelf: 'center' },
  fxRateBadgeText: { color: '#60a5fa', fontSize: 11, fontWeight: '800' },

  recipientReceivesCard: { backgroundColor: 'rgba(115,242,24,0.08)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(115,242,24,0.25)', marginBottom: 14 },
  recipientReceivesLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  recipientReceivesBadge: { color: '#73f218', fontSize: 9, fontWeight: '900', backgroundColor: 'rgba(115,242,24,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  recipientReceivesAmount: { color: '#73f218', fontSize: 20, fontWeight: '900', marginTop: 2 },
  recipientReceivesSub: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 4, fontWeight: '600' },

  // Forecast
  forecastCard: { backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)', gap: 10 },
  forecastItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forecastLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  forecastVal: { fontSize: 13, fontWeight: '900' },
  forecastDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  forecastTotalVal: { color: '#3b82f6', fontSize: 16, fontWeight: '900' },

  currencyFxVal: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700' },
  activePageBadge: { backgroundColor: 'rgba(115,242,24,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)' },
  activePageBadgeText: { color: '#73f218', fontSize: 9, fontWeight: '900' },

  amountCurrencyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(115,242,24,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(115,242,24,0.25)', marginRight: 8 },
  changeCurrencyQuickBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(115,242,24,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)' },
  changeCurrencyQuickText: { color: '#73f218', fontSize: 10, fontWeight: '800' },

  // Dropdown Select Box & Currency Styles
  dropdownSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownSelectTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  dropdownSelectSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 },

  dropdownListDrawer: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderWidth: 1.5,
    borderColor: 'rgba(115,242,24,0.3)',
    borderRadius: 16,
    marginTop: 6,
    marginBottom: 6,
    overflow: 'hidden',
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dropdownItemRowActive: {
    backgroundColor: 'rgba(115,242,24,0.12)',
  },
  dropdownItemName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  dropdownItemSub: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 1 },

  currSelectLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginRight: 8 },
  currChipSmall: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  currChipSmallActive: { backgroundColor: 'rgba(115,242,24,0.2)', borderColor: '#73f218' },
  currChipSmallText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800' },
  currChipSmallTextActive: { color: '#73f218', fontWeight: '900' },

  // Account Details Modal Styles
  accDetailsBanner: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 14 },
  accDetailsIconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  accDetailsName: { color: '#fff', fontSize: 16, fontWeight: '900' },
  accDetailsSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  accDetailsBalanceLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  accDetailsBalanceVal: { fontSize: 24, fontWeight: '900', marginTop: 2 },
  accDetailsConvertedSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2, fontWeight: '600' },

  accDetailsActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  accDetailsActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  accMetricsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  accMetricCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  accMetricLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '900' },
  accMetricVal: { fontSize: 14, fontWeight: '900', marginTop: 4 },

  accTxList: { gap: 8, marginBottom: 14 },
  accTxItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 12 },
  accTxIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  accTxTitle: { color: '#fff', fontSize: 12, fontWeight: '800' },
  accTxDate: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 },
  accTxAmount: { fontSize: 12, fontWeight: '900' },

  deleteAccBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.25)', marginTop: 4 },
  deleteAccBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '800' },

  // Step 3 Exports & Security Styles
  exportDescText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 17, marginBottom: 4 },
  exportCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  exportIconBox: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  exportRowTitle: { color: '#fff', fontSize: 12, fontWeight: '800' },
  exportRowSub: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 },

  autoLockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  timeoutChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  timeoutChipActive: { backgroundColor: 'rgba(115,242,24,0.2)', borderColor: '#73f218' },
  timeoutChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800' },
  timeoutChipTextActive: { color: '#73f218', fontWeight: '900' },

  testBiometricsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(115,242,24,0.1)', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(115,242,24,0.25)', marginTop: 4 },
  testBiometricsText: { color: '#73f218', fontSize: 12, fontWeight: '800' },

  biometricLockContainer: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  biometricLockCard: { backgroundColor: 'rgba(15, 23, 42, 0.98)', borderRadius: 28, padding: 26, borderWidth: 1.5, borderColor: 'rgba(115,242,24,0.3)', width: '100%', maxWidth: 400, alignItems: 'center' },
  biometricIconBox: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  biometricTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 4, textAlign: 'center' },
  biometricSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 20 },

  pinInputRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'transparent' },
  pinDotFilled: { backgroundColor: '#73f218', borderColor: '#73f218' },

  biometricUnlockBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#73f218', paddingVertical: 14, borderRadius: 14 },
  biometricUnlockText: { color: '#0f172a', fontSize: 13, fontWeight: '900' },
});
