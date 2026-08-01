import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Platform, Modal, Animated, Easing, Dimensions, TextInput, RefreshControl, Share, Alert, KeyboardAvoidingView, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCurrency } from '../../context/CurrencyContext';
import { useGoals } from '../../context/GoalContext';
import { useTransactions } from '../../context/TransactionContext';
import { useAccounts } from '../../context/AccountContext';
import { useBills } from '../../context/BillContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Responsive helpers
const isSmallScreen = SCREEN_WIDTH < 375;  // iPhone SE, Galaxy A10, etc.
const iconCircleSize = isSmallScreen ? 38 : 46;
const iconSize = isSmallScreen ? 17 : 21;
// Card widths — always proportional to screen, min 130px, max 175px
const SAVINGS_CARD_WIDTH = Math.min(Math.max(SCREEN_WIDTH * 0.38, 130), 175);
const PAYMENT_CARD_WIDTH = Math.min(Math.max(SCREEN_WIDTH * 0.36, 125), 165);
// Physical card minimum height — 22% of screen height
const PHYSICAL_CARD_MIN_HEIGHT = Math.max(SCREEN_HEIGHT * 0.22, 160);

// ─── Sub-Components ────────────────────────────────────────────────────────────

const AnimatedCounter = ({ value, style, duration = 800, balanceHidden, prefix = '$', ...rest }: any) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = count;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = progress * (2 - progress); // Ease out quad
      const currentValue = startValue + easedProgress * (endValue - startValue);
      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    const animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  if (balanceHidden) {
    return <Text style={style} {...rest}>••••••</Text>;
  }

  return (
    <Text style={style} {...rest}>
      {prefix}{count.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </Text>
  );
};

const QuickActionButton = ({ icon, label, onPress, isActive }: any) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={onPress}
    style={{
      alignItems: 'center',
      flex: 1,
      marginHorizontal: isSmallScreen ? 3 : 5,
      borderRadius: 20,
      paddingVertical: isSmallScreen ? 12 : 16,
      paddingHorizontal: isSmallScreen ? 4 : 8,
      // Glassmorphism
      backgroundColor: isActive ? 'rgba(115, 242, 24, 0.18)' : 'rgba(255, 255, 255, 0.18)',
      borderWidth: 1.5,
      borderColor: isActive ? 'rgba(115, 242, 24, 0.6)' : 'rgba(255, 255, 255, 0.45)',
      ...({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as any),
      shadowColor: isActive ? '#73f218' : '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isActive ? 0.35 : 0.1,
      shadowRadius: 12,
      elevation: isActive ? 6 : 3,
    }}
  >
    {/* Glowing icon circle — scales with screen width */}
    <View style={{
      width: iconCircleSize, height: iconCircleSize, borderRadius: iconCircleSize / 2,
      backgroundColor: isActive ? 'rgba(115, 242, 24, 0.25)' : 'rgba(255, 255, 255, 0.25)',
      borderWidth: 1,
      borderColor: isActive ? 'rgba(115, 242, 24, 0.5)' : 'rgba(255,255,255,0.4)',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: isSmallScreen ? 6 : 10,
      shadowColor: '#73f218',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isActive ? 0.6 : 0.2,
      shadowRadius: 8,
    }}>
      <Ionicons name={icon} size={iconSize} color={isActive ? '#73f218' : '#fff'} />
    </View>
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      style={{
        color: isActive ? '#73f218' : 'rgba(255,255,255,0.9)',
        fontSize: isSmallScreen ? 9 : 11,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.2,
      }}
    >{label}</Text>
  </TouchableOpacity>
);

const SavingsGoalCard = ({ label, icon, saved, target, color, currencySymbol = '$', onPress }: any) => {
  const pct = Math.min(Math.round((saved / target) * 100), 100);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{
      width: SAVINGS_CARD_WIDTH, padding: 18, borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
      marginRight: 12,
    }}>
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: color + '25',
        alignItems: 'center', justifyContent: 'center', marginBottom: 14,
      }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '500', marginBottom: 14 }}>
        {currencySymbol}{saved.toLocaleString()} of {currencySymbol}{target.toLocaleString()}
      </Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${pct}%` as any }} />
      </View>
      <Text style={{ color: color, fontWeight: '800', fontSize: 11, marginTop: 8 }}>{pct}% saved</Text>
    </TouchableOpacity>
  );
};

const UpcomingPaymentCard = ({ title, amount, daysLeft, icon, isPrimary, currencySymbol = '$', onPress }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{
    width: PAYMENT_CARD_WIDTH, padding: 16, borderRadius: 20, marginRight: 12,
    backgroundColor: isPrimary ? '#73f218' : 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: isPrimary ? '#73f218' : 'rgba(255,255,255,0.08)',
    shadowColor: isPrimary ? '#73f218' : 'transparent',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isPrimary ? 0.4 : 0,
    shadowRadius: 12, elevation: isPrimary ? 6 : 0,
  }}>
    <View style={{
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: isPrimary ? 'rgba(255,255,255,0.3)' : 'rgba(115,242,24,0.15)',
      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    }}>
      <Ionicons name={icon} size={20} color={isPrimary ? '#0f172a' : '#73f218'} />
    </View>
    <Text style={{ color: isPrimary ? '#0f172a' : '#fff', fontWeight: '700', fontSize: 13, marginBottom: 4 }}>{title}</Text>
    <Text style={{ color: isPrimary ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 16, marginBottom: 6 }}>{currencySymbol}{amount}/mo</Text>
    <View style={{
      alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 20,
      backgroundColor: isPrimary ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)',
    }}>
      <Text style={{ color: isPrimary ? '#0f172a' : 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' }}>
        {daysLeft <= 1 ? 'Due tomorrow' : `${daysLeft} days left`}
      </Text>
    </View>
  </TouchableOpacity>
);

const TransactionItem = ({ title, date, amount, icon, isIncome, currencySymbol = '$', onPress }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#f9fafb',
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
      }}>
        <Ionicons name={icon} size={20} color="#374151" />
      </View>
      <View>
        <Text style={{ color: '#111827', fontWeight: '700', fontSize: 14 }}>{title}</Text>
        <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>{date}</Text>
      </View>
    </View>
    <Text style={{ fontWeight: '800', fontSize: 15, color: isIncome ? '#73f218' : '#ef4444' }}>
      {isIncome ? '+' : '-'}{currencySymbol}{amount}
    </Text>
  </TouchableOpacity>
);

// ─── Add Transaction Modal Component ──────────────────────────────────────────

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

const INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'cash-outline' },
  { name: 'Freelance', icon: 'laptop-outline' },
  { name: 'Business', icon: 'briefcase-outline' },
  { name: 'Investment', icon: 'trending-up-outline' },
  { name: 'Gift', icon: 'gift-outline' },
  { name: 'Other', icon: 'options-outline' },
];

const EXPENSE_CATEGORIES = [
  { name: 'Food', icon: 'basket-outline' },
  { name: 'Subscriptions', icon: 'color-palette-outline' },
  { name: 'Shopping', icon: 'bag-handle-outline' },
  { name: 'Transport', icon: 'car-outline' },
  { name: 'Housing', icon: 'home-outline' },
  { name: 'Utilities', icon: 'flash-outline' },
  { name: 'Entertainment', icon: 'film-outline' },
  { name: 'Other', icon: 'options-outline' },
];

const ACCOUNTS = ['Overall', 'Cards', 'MobileMoney', 'Savings'];

const AddTransactionModal = ({ visible, initialType = 'expense', onClose, onSave }: any) => {
  const { currency } = useCurrency();
  const [type, setType] = useState<'income' | 'expense'>(initialType);
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Food');
  const [account, setAccount] = useState('Overall');
  const [datePreset, setDatePreset] = useState('Today');

  // Currency State (Syncs with global app default currency)
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  useEffect(() => {
    setType(initialType);
    setCategory(initialType === 'income' ? 'Salary' : 'Food');
    if (currency) {
      setSelectedCurrency(currency);
    }
  }, [initialType, visible, currency]);

  const activeModalCurrency = selectedCurrency && selectedCurrency.code ? selectedCurrency : currency;

  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    setCategory(newType === 'income' ? 'Salary' : 'Food');
    try { Haptics.selectionAsync(); } catch (e) {}
  };

  const handleSave = () => {
    const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title or merchant name for this transaction.');
      return;
    }

    const currentCatList = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const matchedCategory = currentCatList.find(c => c.name === category) || currentCatList[0];

    onSave({
      type,
      title: title.trim(),
      amount: numericAmount,
      currencySymbol: selectedCurrency.symbol,
      currencyCode: selectedCurrency.code,
      category: matchedCategory.name,
      account,
      datePreset,
      icon: matchedCategory.icon,
    });

    // Reset form
    setAmount('');
    setTitle('');
    onClose();
  };

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isIncome = type === 'income';
  const themeColor = isIncome ? '#73f218' : '#ef4444';

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{
        position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: Platform.OS === 'web' ? ('100vw' as any) : '100%',
        height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        justifyContent: 'flex-end',
        alignItems: 'center',
        zIndex: 99999,
      }}>
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%', maxWidth: 500, alignSelf: 'center' }}
        >
          <View style={{
            width: '100%',
            maxWidth: 500,
            alignSelf: 'center',
            backgroundColor: '#0f172a',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            padding: 24,
            borderWidth: 1.5,
            borderColor: 'rgba(255, 255, 255, 0.15)',
            maxHeight: SCREEN_HEIGHT * 0.88,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
                Add {isIncome ? 'Income' : 'Expense'}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Type Switcher */}
              <View style={{
                flexDirection: 'row',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 16,
                padding: 4,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleTypeChange('expense')}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: !isIncome ? '#ef4444' : 'transparent',
                  }}
                >
                  <Text style={{ color: !isIncome ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 13 }}>
                    Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleTypeChange('income')}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: isIncome ? '#73f218' : 'transparent',
                  }}
                >
                  <Text style={{ color: isIncome ? '#0f172a' : 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 13 }}>
                    Income
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount & Currency Section */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  Amount & Currency
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  {/* Amount Input Box */}
                  <View style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderWidth: 1.5,
                    borderColor: themeColor + '60',
                  }}>
                    <Text style={{ color: themeColor, fontSize: (activeModalCurrency.symbol || '').length > 2 ? 18 : 26, fontWeight: '800', marginRight: 6 }}>
                      {activeModalCurrency.symbol}
                    </Text>
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0.00"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      keyboardType="decimal-pad"
                      style={{
                        flex: 1,
                        color: '#fff',
                        fontSize: 26,
                        fontWeight: '800',
                        outlineStyle: 'none',
                      } as any}
                    />
                  </View>

                  {/* Currency Selector Box */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e){}
                      setShowCurrencyPicker(true);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      borderWidth: 1.5,
                      borderColor: 'rgba(255,255,255,0.15)',
                      gap: 6,
                    }}
                  >
                    <Image
                      source={{ uri: activeModalCurrency.flagUrl }}
                      style={{ width: 22, height: 16, borderRadius: 3, resizeMode: 'cover' }}
                    />
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                      {activeModalCurrency.code}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Title Input */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  Title / Source
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={isIncome ? 'e.g. Salary, Client Work, Dividend' : 'e.g. Groceries, Coffee, Netflix'}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: '600',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    outlineStyle: 'none',
                  } as any}
                />
              </View>

              {/* Category Selector */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                  Category
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {categories.map(cat => {
                    const isSelected = category === cat.name;
                    return (
                      <TouchableOpacity
                        key={cat.name}
                        onPress={() => {
                          setCategory(cat.name);
                          try { Haptics.selectionAsync(); } catch (e) {}
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 14,
                          backgroundColor: isSelected ? themeColor + '25' : 'rgba(255,255,255,0.05)',
                          borderWidth: 1.5,
                          borderColor: isSelected ? themeColor : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Ionicons name={cat.icon as any} size={16} color={isSelected ? themeColor : 'rgba(255,255,255,0.6)'} />
                        <Text style={{ color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' }}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Target Account */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                  Account / Wallet
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {ACCOUNTS.map(acc => {
                    const isSelected = account === acc;
                    return (
                      <TouchableOpacity
                        key={acc}
                        onPress={() => {
                          setAccount(acc);
                          try { Haptics.selectionAsync(); } catch (e) {}
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                          borderWidth: 1,
                          borderColor: isSelected ? '#fff' : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Text style={{ color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' }}>
                          {acc === 'MobileMoney' ? 'Mobile Money' : acc}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Date Preset */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                  Date
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {['Today', 'Yesterday'].map(d => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDatePreset(d)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: datePreset === d ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                        borderWidth: 1,
                        borderColor: datePreset === d ? '#fff' : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <Text style={{ color: datePreset === d ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' }}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSave}
                style={{
                  backgroundColor: themeColor,
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                  marginBottom: 20,
                  shadowColor: themeColor,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  elevation: 5,
                }}
              >
                <Text style={{ color: isIncome ? '#0f172a' : '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }}>
                  Save {isIncome ? 'Income' : 'Expense'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* ── Currency Selection Sheet ── */}
      <Modal transparent visible={showCurrencyPicker} animationType="fade" onRequestClose={() => setShowCurrencyPicker(false)} statusBarTranslucent>
        <View style={{
          position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: Platform.OS === 'web' ? ('100vw' as any) : '100%',
          height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          paddingHorizontal: 16,
          zIndex: 99999,
        }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowCurrencyPicker(false)}
          />
          <View style={{
            width: '100%',
            maxWidth: 380,
            alignSelf: 'center',
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
              <TouchableOpacity onPress={() => setShowCurrencyPicker(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8 }}>
              {CURRENCIES.map(c => {
                const isSelected = selectedCurrency.code === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedCurrency(c);
                      setShowCurrencyPicker(false);
                      try { Haptics.selectionAsync(); } catch(e){}
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
    </Modal>
  );
};

// ─── Search Modal ────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Income', 'Expenses', 'Subscriptions'];

const SearchModal = ({ visible, onClose, insets }: any) => {
  const { transactions } = useTransactions();
  const { formatAmount } = useCurrency();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const inputRef = useRef<any>(null);

  // Responsive values scoped to this component
  const hPad        = isSmallScreen ? 12 : 16;
  const inputHeight = isSmallScreen ? 42 : 48;
  const inputFs     = isSmallScreen ? 13 : 15;
  const pillPadH    = isSmallScreen ? 12 : 16;
  const pillPadV    = isSmallScreen ? 5  : 7;
  const pillFs      = isSmallScreen ? 11 : 13;

  const filtered = transactions.filter(t => {
    const matchesQuery = query.trim() === '' || t.title.toLowerCase().includes(query.toLowerCase()) || (t.category && t.category.toLowerCase().includes(query.toLowerCase()));
    const matchesCat =
      activeCategory === 'All' ? true :
      activeCategory === 'Income' ? t.isIncome :
      activeCategory === 'Expenses' ? !t.isIncome :
      activeCategory === 'Subscriptions' ? t.category === 'Subscription' : true;
    return matchesQuery && matchesCat;
  });

  const handleClose = () => {
    setQuery('');
    setActiveCategory('All');
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onShow={() => inputRef.current?.focus()} onRequestClose={handleClose} statusBarTranslucent>
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#0f172a',
        alignItems: 'center',
        zIndex: 9999,
      }}>
        <View style={{ width: '100%', maxWidth: 600, flex: 1, alignSelf: 'center' }}>

        {/* ── Top bar ── */}
        <View style={{
          paddingTop: Platform.OS === 'web' ? 20 : insets.top + 12,
          paddingHorizontal: hPad,
          paddingBottom: isSmallScreen ? 10 : 14,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}>

          {/* Search input row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmallScreen ? 8 : 10 }}>
            <View style={{
              flex: 1, flexDirection: 'row', alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 14,
              paddingHorizontal: isSmallScreen ? 10 : 14,
              height: inputHeight,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
            }}>
              <Ionicons name="search-outline" size={isSmallScreen ? 16 : 19} color="rgba(255,255,255,0.4)" />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder={isSmallScreen ? 'Search...' : 'Search transactions, budgets...'}
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={{
                  flex: 1, color: '#fff',
                  fontSize: inputFs, fontWeight: '500',
                  marginLeft: 8,
                  outlineStyle: 'none',
                } as any}
                returnKeyType="search"
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: '#73f218', fontSize: isSmallScreen ? 13 : 15, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Category filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: isSmallScreen ? 10 : 14 }}
            contentContainerStyle={{ gap: isSmallScreen ? 6 : 8, paddingRight: 4 }}
          >
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={{
                    paddingHorizontal: pillPadH,
                    paddingVertical: pillPadV,
                    borderRadius: 20,
                    backgroundColor: isActive ? '#73f218' : 'rgba(255,255,255,0.07)',
                    borderWidth: 1,
                    borderColor: isActive ? '#73f218' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <Text style={{
                    color: isActive ? '#0f172a' : 'rgba(255,255,255,0.7)',
                    fontSize: pillFs, fontWeight: '700',
                  }}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Results area ── */}
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: hPad,
            paddingTop: isSmallScreen ? 12 : 16,
            paddingBottom: 40,
          }}
        >
          {query.trim() === '' && activeCategory === 'All' ? (
            // ── Default: recent chips + browse all ──
            <View>
              <Text style={{
                color: 'rgba(255,255,255,0.4)', fontWeight: '700',
                fontSize: isSmallScreen ? 10 : 11,
                textTransform: 'uppercase', letterSpacing: 1,
                marginBottom: isSmallScreen ? 10 : 14,
              }}>Recent Searches</Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isSmallScreen ? 6 : 8, marginBottom: isSmallScreen ? 20 : 28 }}>
                {['Adobe Creative', 'Rent', 'Netflix', 'Groceries', 'Coffee'].map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setQuery(item)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: isSmallScreen ? 10 : 14,
                      paddingVertical: isSmallScreen ? 6 : 8,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderRadius: 20,
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <Ionicons name="time-outline" size={isSmallScreen ? 11 : 13} color="rgba(255,255,255,0.4)" />
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: isSmallScreen ? 12 : 13, fontWeight: '500' }}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{
                color: 'rgba(255,255,255,0.4)', fontWeight: '700',
                fontSize: isSmallScreen ? 10 : 11,
                textTransform: 'uppercase', letterSpacing: 1,
                marginBottom: isSmallScreen ? 10 : 14,
              }}>Browse All</Text>
              {transactions.slice(0, 10).map((t: any, i: number) => (
                <SearchResultRow key={t.id || i} result={{
                  title: t.title,
                  subtitle: `${t.category || 'General'} · ${t.date}`,
                  amount: `${t.isIncome ? '+' : '-'}${formatAmount(t.amount)}`,
                  icon: t.icon || (t.isIncome ? 'cash-outline' : 'card-outline'),
                  color: t.color || (t.isIncome ? '#73f218' : '#ef4444'),
                  isIncome: t.isIncome,
                }} />
              ))}
            </View>

          ) : filtered.length === 0 ? (
            // ── Empty state ──
            <View style={{ alignItems: 'center', paddingTop: isSmallScreen ? 40 : 60 }}>
              <View style={{
                width: isSmallScreen ? 56 : 72,
                height: isSmallScreen ? 56 : 72,
                borderRadius: isSmallScreen ? 28 : 36,
                backgroundColor: 'rgba(255,255,255,0.05)',
                alignItems: 'center', justifyContent: 'center', marginBottom: isSmallScreen ? 14 : 20,
              }}>
                <Ionicons name="search-outline" size={isSmallScreen ? 24 : 32} color="rgba(255,255,255,0.2)" />
              </View>
              <Text style={{ color: '#fff', fontSize: isSmallScreen ? 16 : 18, fontWeight: '800', marginBottom: 8 }}>No results found</Text>
              <Text style={{
                color: 'rgba(255,255,255,0.4)', fontSize: isSmallScreen ? 13 : 14,
                textAlign: 'center', lineHeight: 20, paddingHorizontal: 20,
              }}>
                Nothing matched{'\n'}
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>"{query}"</Text>
              </Text>
            </View>

          ) : (
            // ── Filtered results ──
            <View>
              <Text style={{
                color: 'rgba(255,255,255,0.4)', fontWeight: '700',
                fontSize: isSmallScreen ? 10 : 11,
                textTransform: 'uppercase', letterSpacing: 1,
                marginBottom: isSmallScreen ? 10 : 14,
              }}>
                {filtered.length} Result{filtered.length !== 1 ? 's' : ''}
              </Text>
              {filtered.map((t: any, i: number) => (
                <SearchResultRow key={t.id || i} result={{
                  title: t.title,
                  subtitle: `${t.category || 'General'} · ${t.date}`,
                  amount: `${t.isIncome ? '+' : '-'}${formatAmount(t.amount)}`,
                  icon: t.icon || (t.isIncome ? 'cash-outline' : 'card-outline'),
                  color: t.color || (t.isIncome ? '#73f218' : '#ef4444'),
                  isIncome: t.isIncome,
                }} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
      </View>
    </Modal>
  );
};

const SearchResultRow = ({ result }: any) => {
  const rowPadV  = isSmallScreen ? 10 : 13;
  const rowPadH  = isSmallScreen ? 10 : 14;
  const circleSize = isSmallScreen ? 36 : 42;
  const iconSz   = isSmallScreen ? 16 : 19;
  const titleFs  = isSmallScreen ? 13 : 14;
  const subFs    = isSmallScreen ? 11 : 12;
  const amountFs = isSmallScreen ? 13 : 14;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: isSmallScreen ? 10 : 14,
        paddingVertical: rowPadV, paddingHorizontal: rowPadH,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16, marginBottom: 8,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
      }}
    >
      <View style={{
        width: circleSize, height: circleSize, borderRadius: circleSize / 2,
        backgroundColor: result.color + '20',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: result.color + '40',
        flexShrink: 0,
      }}>
        <Ionicons name={result.icon} size={iconSz} color={result.color} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '700', fontSize: titleFs }}>{result.title}</Text>
        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.4)', fontSize: subFs, marginTop: 2 }}>{result.subtitle}</Text>
      </View>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          color: result.isIncome ? '#73f218' : '#f87171',
          fontWeight: '800', fontSize: amountFs,
          flexShrink: 0,
        }}
      >{result.amount}</Text>
    </TouchableOpacity>
  );
};

// ─── Main Screen ────────────────────────────────────────────────────────────────

export function DashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { currency, formatAmount, convertAmount } = useCurrency();
  const { savingsGoals: rawGoals } = useGoals();
  const { transactions: rawTransactions, addTransaction, totalIncome, totalExpenses, monthlyIncome: ctxMonthlyIncome, monthlyExpenses: ctxMonthlyExpenses } = useTransactions();
  const { accounts: liveAccounts, totalNetWorthUSD } = useAccounts();
  const { bills: globalBills } = useBills();
  const [fullName, setFullName] = useState('User');
  const [activeCard, setActiveCard] = useState('Overall');
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const unpaidBills = useMemo(() => globalBills.filter(b => !b.isPaid), [globalBills]);
  const incomeNotifications = useMemo(() => rawTransactions.filter(t => t.isIncome), [rawTransactions]);
  const [hasSeenNotifications, setHasSeenNotifications] = useState(false);

  const unreadCount = unpaidBills.length + incomeNotifications.length;
  const hasUnread = unreadCount > 0 && !hasSeenNotifications;

  // Modal & Transaction State
  const [addTxModalVisible, setAddTxModalVisible] = useState(false);
  const [txInitialType, setTxInitialType] = useState<'income' | 'expense'>('expense');

  // Account Card Data State (Dynamic from central AccountContext)
  const momoAcc = liveAccounts.find(a => a.type === 'MobileMoney' || a.name.toLowerCase().includes('momo') || a.name.toLowerCase().includes('mtn'));
  const savingsAcc = liveAccounts.find(a => a.type === 'Savings');
  const cardsAcc = liveAccounts.find(a => (a.type as string) === 'CreditCard' || (a.type as string) === 'Checking' || (a.type as string) === 'Cards' || a.name.toLowerCase().includes('visa'));
  const cashAcc = liveAccounts.find(a => a.type === 'Cash' || a.name.toLowerCase().includes('cash'));
  const overallAcc = liveAccounts.find(a => a.type === 'Overall' || a.id === 'acc-overall');

  const cardData = useMemo(() => ({
    Overall: {
      balance: overallAcc ? overallAcc.balance : (totalIncome - totalExpenses + totalNetWorthUSD),
      income: ctxMonthlyIncome,
      expenses: ctxMonthlyExpenses,
    },
    MobileMoney: {
      balance: momoAcc ? momoAcc.balance : 0,
      income: momoAcc ? (momoAcc.income || 0) : 0,
      expenses: momoAcc ? (momoAcc.expenses || 0) : 0,
    },
    Savings: {
      balance: savingsAcc ? savingsAcc.balance : 0,
      income: savingsAcc ? (savingsAcc.income || 0) : 0,
      expenses: savingsAcc ? (savingsAcc.expenses || 0) : 0,
    },
    Cards: {
      balance: cardsAcc ? cardsAcc.balance : 0,
      income: cardsAcc ? (cardsAcc.income || 0) : 0,
      expenses: cardsAcc ? (cardsAcc.expenses || 0) : 0,
    },
    Cash: {
      balance: cashAcc ? cashAcc.balance : 0,
      income: cashAcc ? (cashAcc.income || 0) : 0,
      expenses: cashAcc ? (cashAcc.expenses || 0) : 0,
    },
  }), [overallAcc, momoAcc, savingsAcc, cardsAcc, cashAcc, totalIncome, totalExpenses, totalNetWorthUSD, ctxMonthlyIncome, ctxMonthlyExpenses]);

  // Monthly Budget Spent State (Dynamic from central TransactionContext)
  const budgetSpent = totalExpenses;
  const budgetLimit = 2500;
  const budgetPct = budgetLimit > 0 ? Math.min(Math.round((budgetSpent / budgetLimit) * 100), 100) : 0;

  // Format Helper & Initial Transactions State
  const today = new Date();
  const fmt = (d: Date, time: string) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    return `${day} ${month}, ${time}`;
  };
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);
  const threeDaysAgo = new Date(today); threeDaysAgo.setDate(today.getDate() - 3);

  const recentTransactions = useMemo(() => rawTransactions.map(t => ({
    title: t.title,
    date: t.date,
    amount: t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    currencySymbol: t.currencySymbol || currency.symbol,
    icon: t.icon || (t.isIncome ? 'cash-outline' : 'card-outline'),
    isIncome: t.isIncome,
    category: t.category,
    account: t.account,
  })), [rawTransactions, currency.symbol]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hideAnim = useRef(new Animated.Value(1)).current;
  const cardAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch(e){}
    setTimeout(() => {
      setRefreshing(false);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch(e){}
    }, 1500);
  }, []);

  const stickyHeaderOpacity = scrollY.interpolate({ inputRange: [50, 90], outputRange: [0, 1], extrapolate: 'clamp' });
  const stickyHeaderTranslateY = scrollY.interpolate({ inputRange: [50, 90], outputRange: [-10, 0], extrapolate: 'clamp' });
  const inlineHeaderOpacity = scrollY.interpolate({ inputRange: [0, 40], outputRange: [1, 0], extrapolate: 'clamp' });

  const handleSwitchCard = (newCard: string) => {
    if (activeCard === newCard) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e){}
    Animated.sequence([
      Animated.timing(cardAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setActiveCard(newCard), 150);
  };

  const toggleBalance = () => {
    try { Haptics.selectionAsync(); } catch(e){}
    Animated.sequence([
      Animated.timing(hideAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(hideAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setBalanceHidden(prev => !prev), 120);
  };

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

  const openAddTxModal = (initialMode: 'income' | 'expense') => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch(e){}
    setTxInitialType(initialMode);
    setAddTxModalVisible(true);
  };

  const handleSaveTransaction = (newTxData: {
    type: 'income' | 'expense';
    title: string;
    amount: number;
    currencySymbol?: string;
    currencyCode?: string;
    category: string;
    account: string;
    datePreset: string;
    icon: string;
  }) => {
    const isInc = newTxData.type === 'income';
    const now = new Date();
    if (newTxData.datePreset === 'Yesterday') {
      now.setDate(now.getDate() - 1);
    }
    const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = fmt(now, formattedTime);
    const symbol = newTxData.currencySymbol || '$';
    const amountFormatted = newTxData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const newTx = {
      title: newTxData.title,
      date: formattedDate,
      amount: amountFormatted,
      currencySymbol: symbol,
      icon: newTxData.icon || (isInc ? 'cash-outline' : 'card-outline'),
      isIncome: isInc,
    };

    addTransaction({
      title: newTxData.title,
      amount: newTxData.amount,
      isIncome: isInc,
      category: newTxData.category,
      account: newTxData.account,
      date: formattedDate,
      icon: newTxData.icon || (isInc ? 'cash-outline' : 'card-outline'),
      currencySymbol: symbol,
    });

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}

    Alert.alert(
      'Success 🎉',
      `${isInc ? 'Income' : 'Expense'} of ${symbol}${amountFormatted} for "${newTxData.title}" has been recorded.`
    );
  };

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.full_name) setFullName(user.user_metadata.full_name);
    }
    getProfile();
  }, []);

  const currentData = cardData[activeCard as keyof typeof cardData] || cardData['Overall'];
  const totalBalance = convertAmount(currentData.balance, 'USD', currency.code);
  const monthlyIncome = convertAmount(currentData.income, 'USD', currency.code);
  const monthlyExpenses = convertAmount(currentData.expenses, 'USD', currency.code);

  const savingsGoals = rawGoals.map(g => ({
    label: g.label,
    icon: g.icon,
    saved: g.saved,
    target: g.target,
    color: g.color || '#73f218',
    deadline: g.deadline || 'Dec 2026',
  }));

  const upcomingPayments = globalBills.filter(b => !b.isPaid).map(b => ({
    id: b.id,
    title: b.title,
    amount: b.amount.toString(),
    daysLeft: b.daysLeft,
    icon: b.icon || 'card-outline',
    isPrimary: b.isPrimary || false,
  }));

  // Group transactions into labelled buckets
  const getDateGroup = (dateStr: string): string => {
    const parts  = dateStr.split(', ')[0].split(' ');  // e.g. ['10', 'Jul']
    const day    = parseInt(parts[0]);
    const month  = parts[1];
    const now    = new Date();
    const todayD = now.getDate();
    const todayM = now.toLocaleString('en-US',{month:'short'});
    const diff   = todayD - day;
    if (month !== todayM)   return 'Older';
    if (diff === 0)          return 'Today';
    if (diff === 1)          return 'Yesterday';
    if (diff <= 6)           return 'Earlier this week';
    return 'Older';
  };

  const groupedTransactions = (() => {
    const groups: { label: string; items: typeof recentTransactions }[] = [];
    const seen: Record<string, number> = {};
    recentTransactions.forEach((tx: any) => {
      const label = getDateGroup(tx.date);
      if (seen[label] === undefined) {
        seen[label] = groups.length;
        groups.push({ label, items: [] });
      }
      groups[seen[label]].items.push(tx);
    });
    return groups;
  })();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Good morning', emoji: '☀️' };
    if (hour >= 12 && hour < 17) return { text: 'Good afternoon', emoji: '⛅' };
    if (hour >= 17 && hour < 21) return { text: 'Good evening', emoji: '🌆' };
    return { text: 'Good night', emoji: '🌙' };
  };

  const greeting = getGreeting();
  const firstName = fullName.split(' ')[0];

  const [moMoProvider, setMoMoProvider] = useState('MTN');

  const isPhysicalCard = activeCard === 'Cards' || activeCard === 'MobileMoney';
  
  let cardBgColor = '#a3e635';
  let cardLogoText = 'VISA';
  
  if (activeCard === 'MobileMoney') {
    cardBgColor = moMoProvider === 'Airtel' ? '#ef4444' : '#facc15';
    cardLogoText = moMoProvider === 'Airtel' ? 'Airtel Money' : 'MTN MoMo';
  }
  
  const cardNumberText = activeCard === 'Cards' ? '**** **** **** 5466' : '078* *** **89';

  const handleShareTransaction = async (tx: any) => {
    if (!tx) return;
    try {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e){}
      const sign = tx.isIncome ? '+' : '-';
      const symbol = tx.currencySymbol || '$';
      const message = `Transaction Receipt\n\nTitle: ${tx.title}\nDate: ${tx.date}\nAmount: ${sign}${symbol}${tx.amount}\nStatus: Completed\nCategory: ${tx.isIncome ? 'Income' : 'Expense'}\nTransaction ID: TRX-${Math.floor(Math.random() * 90000) + 10000}\n\nShared via Manager App`;
      await Share.share({
        message,
        title: `Receipt for ${tx.title}`,
      });
    } catch (error: any) {
      console.error('Error sharing: ', error.message);
    }
  };

  const handleCardPress = () => {
    if (activeCard === 'MobileMoney') {
      setMoMoProvider(prev => prev === 'MTN' ? 'Airtel' : 'MTN');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── STICKY COMPRESSED HEADER ── */}
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: Platform.OS === 'web' ? 70 : insets.top + 40,
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        zIndex: 50,
        opacity: stickyHeaderOpacity,
        transform: [{ translateY: stickyHeaderTranslateY }],
        paddingTop: Platform.OS === 'web' ? 12 : insets.top + 5,
        paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#73f218', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '800' }}>{fullName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{firstName}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => openAddTxModal('expense')}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#73f218', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={22} color="#0f172a" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowSearch(true)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="search-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={toggleNotifications}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
          >
            {hasUnread && (
              <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', zIndex: 10, borderWidth: 1.5, borderColor: '#0f172a' }} />
            )}
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: Platform.OS !== 'web' }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#73f218"
            colors={['#73f218']}
            progressBackgroundColor="#0f172a"
          />
        }
      >
        {/* ── HERO CARD — bleeds to the very top ── */}
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#1e3a5f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: Platform.OS === 'web' ? 12 : insets.top + 10,
            paddingBottom: 16,
            paddingHorizontal: 14,
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
            overflow: 'hidden',
          }}
        >
          {/* Decorative glows */}
          <View style={{
            position: 'absolute', top: -40, right: -40,
            width: 180, height: 180, borderRadius: 90,
            backgroundColor: '#73f218', opacity: 0.12,
          }} />
          <View style={{
            position: 'absolute', bottom: 0, left: -30,
            width: 140, height: 140, borderRadius: 70,
            backgroundColor: '#73f218', opacity: 0.07,
          }} />

          {/* Header row — inside the card */}
          <Animated.View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, opacity: inlineHeaderOpacity }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Avatar */}
              <View style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: '#73f218',
                alignItems: 'center', justifyContent: 'center',
                marginRight: 10,
              }}>
                <Text style={{ color: '#0f172a', fontSize: 16, fontWeight: '800' }}>
                  {fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '500', letterSpacing: 0.2 }}>
                  {greeting.emoji}  {greeting.text}
                </Text>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 1 }}>
                  {firstName} 👋
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => openAddTxModal('expense')}
                style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: '#73f218',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#73f218', shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.4, shadowRadius: 6, elevation: 3,
                }}>
                <Ionicons name="add" size={22} color="#0f172a" />
              </TouchableOpacity>
              <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => setShowSearch(true)}
                style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                <Ionicons name="search-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={toggleNotifications}
                style={{
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {hasUnread && (
                  <View style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: '#ef4444', zIndex: 10,
                    borderWidth: 1.5, borderColor: '#1e293b',
                  }} />
                )}
                <Ionicons name="notifications-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Balance / Physical Card */}
          <Animated.View style={{ opacity: cardAnim, transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
          {isPhysicalCard ? (
            <TouchableOpacity 
              activeOpacity={activeCard === 'MobileMoney' ? 0.9 : 1}
              onPress={handleCardPress}
              style={{
              backgroundColor: cardBgColor,
              borderRadius: 24,
              padding: 20,
              marginBottom: 0,
              position: 'relative',
              overflow: 'hidden',
              minHeight: PHYSICAL_CARD_MIN_HEIGHT,
              justifyContent: 'space-between',
            }}>
              {/* Decorative curves */}
              <View style={{ position: 'absolute', top: -40, left: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.15)' }} />
              <View style={{ position: 'absolute', bottom: -50, right: 50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(0,0,0,0.05)' }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  {/* Dynamic Logo */}
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ color: '#1a1f71', fontSize: 24, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 }}>{cardLogoText}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                    <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', letterSpacing: 3 }}>{cardNumberText}</Text>
                    <Ionicons name="eye-off-outline" size={16} color="#111827" style={{ marginLeft: 8 }} />
                  </View>
                </View>
                
                {/* Right vertical strip with chip and wireless */}
                <View style={{
                  backgroundColor: 'rgba(0,0,0,0.08)',
                  borderRadius: 20,
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  alignItems: 'center',
                  height: 140,
                  justifyContent: 'space-between',
                  marginTop: -4,
                }}>
                  <Ionicons name="wifi" size={24} color="#111827" style={{ transform: [{ rotate: '90deg' }] }} />
                  
                  {/* Smart Chip */}
                  <View style={{
                    width: 34, height: 26, borderRadius: 6, backgroundColor: '#e5e7eb',
                    borderWidth: 1, borderColor: '#9ca3af',
                    alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                  }}>
                    <View style={{ width: '100%', height: 1, backgroundColor: '#9ca3af', position: 'absolute' }} />
                    <View style={{ height: '100%', width: 1, backgroundColor: '#9ca3af', position: 'absolute' }} />
                    <View style={{ width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: '#9ca3af' }} />
                  </View>
                </View>
              </View>

              <View style={{ marginTop: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: '#111827', fontSize: 13, fontWeight: '700', marginBottom: 2 }}>{`${activeCard} Balance`}</Text>
                  <AnimatedCounter
                    value={totalBalance}
                    prefix={currency.symbol}
                    balanceHidden={balanceHidden}
                    style={{ color: '#111827', fontSize: 32, fontWeight: '800', letterSpacing: -1 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                </View>

                {/* Compact Income/Expense inside the card */}
                <View style={{ flexDirection: 'column', gap: 4 }}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', 
                    paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8
                  }}>
                    <Ionicons name="arrow-down-outline" size={11} color="#73f218" />
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>
                      {balanceHidden ? '••••' : `+${currency.symbol}${monthlyIncome.toLocaleString()}`}
                    </Text>
                  </View>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', 
                    paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8
                  }}>
                    <Ionicons name="arrow-up-outline" size={11} color="#ef4444" />
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>
                      {balanceHidden ? '••••' : `-${currency.symbol}${monthlyExpenses.toLocaleString()}`}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View>
              {/* Account Balance / Net Worth label + eye toggle */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '700', flex: 1 }}>
                  {activeCard === 'Overall' ? 'Net Worth (Overall Portfolio)' : `${activeCard} Account Balance`}
                </Text>
                <TouchableOpacity
                  onPress={toggleBalance}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={balanceHidden ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="rgba(255,255,255,0.5)"
                  />
                </TouchableOpacity>
              </View>
              <Animated.View style={{ opacity: hideAnim }}>
                <AnimatedCounter
                  value={totalBalance}
                  prefix={currency.symbol}
                  balanceHidden={balanceHidden}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  style={{ color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -1, marginBottom: 8 }}
                />

                {/* ── Monthly Net summary strip ── */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.25)',
                  borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10,
                  marginBottom: 14, alignSelf: 'flex-start', gap: 6,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                }}>
                  {/* Coloured dot */}
                  <View style={{
                    width: 7, height: 7, borderRadius: 4,
                    backgroundColor: monthlyIncome - monthlyExpenses >= 0 ? '#73f218' : '#ef4444',
                  }} />
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' }}>
                    This month:
                  </Text>
                  {balanceHidden ? (
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800' }}>
                      ••••
                    </Text>
                  ) : (
                    <>
                      <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '700' }}>
                        ↑ {currency.symbol}{monthlyIncome.toLocaleString()}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>·</Text>
                      <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>
                        ↓ {currency.symbol}{monthlyExpenses.toLocaleString()}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>·</Text>
                      <Text style={{
                        fontSize: 11, fontWeight: '800',
                        color: monthlyIncome - monthlyExpenses >= 0 ? '#73f218' : '#ef4444',
                      }}>
                        Net {monthlyIncome - monthlyExpenses >= 0 ? '+' : '-'}{currency.symbol}{Math.abs(monthlyIncome - monthlyExpenses).toLocaleString()}
                      </Text>
                    </>
                  )}
                </View>
              </Animated.View>
            </View>
          )}

          {/* Income / Expense pills */}
          {!isPhysicalCard && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{
                flex: 1, flexDirection: 'row', alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              }}>
                <View style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: '#73f218', alignItems: 'center', justifyContent: 'center', marginRight: 10,
                }}>
                  <Ionicons name="arrow-down-outline" size={16} color="#0f172a" />
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>INCOME</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                    {balanceHidden ? '••••' : `+${currency.symbol}${monthlyIncome.toLocaleString()}`}
                  </Text>
                </View>
              </View>
              <View style={{
                flex: 1, flexDirection: 'row', alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              }}>
                <View style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: 'rgba(239, 68, 68, 0.8)', alignItems: 'center', justifyContent: 'center', marginRight: 10,
                }}>
                  <Ionicons name="arrow-up-outline" size={14} color="#fff" />
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>EXPENSES</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                    {balanceHidden ? '••••' : `-${currency.symbol}${monthlyExpenses.toLocaleString()}`}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Prominent Home Page Action Row (+ Income / - Expense) ── */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openAddTxModal('income')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(115, 242, 24, 0.18)',
                borderWidth: 1.5,
                borderColor: 'rgba(115, 242, 24, 0.6)',
                borderRadius: 16,
                paddingVertical: 12,
                gap: 6,
                shadowColor: '#73f218',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 4,
              }}
            >
              <Ionicons name="add-circle" size={18} color="#73f218" />
              <Text style={{ color: '#73f218', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 }}>
                + Income
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('AllUpcomingPayments')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(59, 130, 246, 0.18)',
                borderWidth: 1.5,
                borderColor: 'rgba(59, 130, 246, 0.6)',
                borderRadius: 16,
                paddingVertical: 12,
                gap: 4,
                shadowColor: '#3b82f6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 4,
              }}
            >
              <Ionicons name="card" size={18} color="#60a5fa" />
              <Text style={{ color: '#60a5fa', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 }}>
                Pay Bills
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openAddTxModal('expense')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.18)',
                borderWidth: 1.5,
                borderColor: 'rgba(239, 68, 68, 0.6)',
                borderRadius: 16,
                paddingVertical: 12,
                gap: 4,
                shadowColor: '#ef4444',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 4,
              }}
            >
              <Ionicons name="remove-circle" size={18} color="#ef4444" />
              <Text style={{ color: '#f87171', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 }}>
                + Expense
              </Text>
            </TouchableOpacity>
          </View>

          </Animated.View>
        </LinearGradient>

        {/* ── CONTENT BELOW THE HERO CARD ── */}
        <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>

          {/* ── Quick Actions ── */}
          <LinearGradient
            colors={['#0f172a', '#1a2744', '#0f2010']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24,
              padding: 16,
              marginBottom: 12,
              overflow: 'hidden',
            }}
          >
            {/* Subtle glow orbs behind the glass */}
            <View style={{
              position: 'absolute', top: -20, left: '25%',
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: '#73f218', opacity: 0.15,
            }} />
            <View style={{
              position: 'absolute', bottom: -20, right: '20%',
              width: 60, height: 60, borderRadius: 30,
              backgroundColor: '#73f218', opacity: 0.1,
            }} />
            <View style={{ flexDirection: 'row', marginHorizontal: -5 }}>
              <QuickActionButton icon="grid-outline" label="Overall" isActive={activeCard === 'Overall'} onPress={() => handleSwitchCard('Overall')} />
              <QuickActionButton icon="wallet-outline" label="Savings" isActive={activeCard === 'Savings'} onPress={() => handleSwitchCard('Savings')} />
              <QuickActionButton icon="phone-portrait-outline" label={isSmallScreen ? 'MoMo' : 'Mobile Money'} isActive={activeCard === 'MobileMoney'} onPress={() => handleSwitchCard('MobileMoney')} />
              <QuickActionButton icon="card-outline" label="Cards" isActive={activeCard === 'Cards'} onPress={() => handleSwitchCard('Cards')} />
            </View>
          </LinearGradient>

          {/* ── Budget Progress ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('BudgetDetail')}
          >
          <View style={{
            backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 12,
            borderWidth: 1.5, borderColor: '#e5e7eb',
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View>
                <Text style={{ color: '#1f2937', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>Monthly Budget</Text>
                <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4, fontWeight: '500' }}>
                  You've spent {budgetPct}% of your budget
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: budgetPct > 80 ? '#ef4444' : '#65d315', fontWeight: '800', fontSize: 18 }}>{budgetPct}%</Text>
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
              </View>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#f3f4f6' }}>
              <View style={{
                height: 8, borderRadius: 4,
                backgroundColor: budgetPct > 80 ? '#ef4444' : '#65d315',
                width: `${budgetPct}%` as any,
              }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '500' }}>Spent: {formatAmount(budgetSpent)}</Text>
              <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '500' }}>Limit: {formatAmount(budgetLimit)}</Text>
            </View>
          </View>
          </TouchableOpacity>

          {/* ── Savings Goals ── */}
          <LinearGradient
            colors={['#0f172a', '#1a2744', '#0f2010']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24, paddingVertical: 20, marginBottom: 12,
              overflow: 'hidden'
            }}
          >
            {/* Subtle glow orbs */}
            <View style={{
              position: 'absolute', top: -30, right: -20,
              width: 120, height: 120, borderRadius: 60,
              backgroundColor: '#73f218', opacity: 0.08,
            }} />
            <View style={{ paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>Savings Goals</Text>
              {savingsGoals.length > 0 && (
                <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('AllSavingsGoals')}>
                  <Text style={{ color: '#73f218', fontSize: 13, fontWeight: '800' }}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {savingsGoals.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 }}>
                <Ionicons name="ribbon-outline" size={32} color="rgba(255,255,255,0.3)" style={{ marginBottom: 8 }} />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>No active goals</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginBottom: 12 }}>
                  Set up a savings goal to start tracking your targets
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('AllSavingsGoals')}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    paddingHorizontal: 16, paddingVertical: 8,
                    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
                  }}
                >
                  <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '800' }}>+ Add First Goal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
                {savingsGoals.map((goal, i) => (
                  <SavingsGoalCard
                    key={i}
                    {...goal}
                    currencySymbol={currency.symbol}
                    onPress={() => navigation.navigate('SavingsGoalDetail', { goal })}
                  />
                ))}
              </ScrollView>
            )}
          </LinearGradient>

          {/* ── Upcoming Payments ── */}
          <LinearGradient
            colors={['#0f172a', '#1a2744', '#0f2010']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24, paddingVertical: 20, marginBottom: 12,
              overflow: 'hidden',
            }}
          >
            {/* Subtle glow orb */}
            <View style={{
              position: 'absolute', bottom: -30, left: -20,
              width: 120, height: 120, borderRadius: 60,
              backgroundColor: '#73f218', opacity: 0.08,
            }} />
            <View style={{ paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>Upcoming Payments</Text>
              {upcomingPayments.length > 0 && (
                <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('AllUpcomingPayments')}>
                  <Text style={{ color: '#73f218', fontSize: 13, fontWeight: '800' }}>See all</Text>
                </TouchableOpacity>
              )}
            </View>

            {upcomingPayments.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 }}>
                <Ionicons name="checkmark-done-circle-outline" size={32} color="rgba(255,255,255,0.3)" style={{ marginBottom: 8 }} />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>All Caught Up!</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginBottom: 12 }}>
                  No upcoming subscriptions or bills due soon
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('AllUpcomingPayments')}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    paddingHorizontal: 16, paddingVertical: 8,
                    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
                  }}
                >
                  <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '800' }}>+ Add Payment</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
                {upcomingPayments.map((p, i) => (
                  <UpcomingPaymentCard 
                    key={i} 
                    {...p} 
                    currencySymbol={currency.symbol}
                    onPress={() => navigation.navigate('UpcomingPaymentDetail', {
                      payment: {
                        name: p.title,
                        amount: p.amount,
                        daysLeft: p.daysLeft,
                        icon: p.icon,
                        color: p.isPrimary ? '#73f218' : '#60a5fa'
                      }
                    })}
                  />
                ))}
              </ScrollView>
            )}
          </LinearGradient>

          {/* ── Recent Transactions ── */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16 }}>Recent Transactions</Text>
              {groupedTransactions.length > 0 && (
                <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('AllTransactions')}>
                  <Text style={{ color: '#73f218', fontSize: 12, fontWeight: '700' }}>See all</Text>
                </TouchableOpacity>
              )}
            </View>

            {groupedTransactions.length === 0 ? (
              <View style={{
                alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20,
                backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb'
              }}>
                <Ionicons name="receipt-outline" size={32} color="#9ca3af" style={{ marginBottom: 8 }} />
                <Text style={{ color: '#111827', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>No transactions yet</Text>
                <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center' }}>
                  Your activity history will appear here once you make a transaction.
                </Text>
              </View>
            ) : (
              groupedTransactions.map(group => (
                <View key={group.label}>
                  {/* Section header */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 2,
                  }}>
                    <Text style={{
                      color: '#6b7280', fontSize: 11, fontWeight: '700',
                      textTransform: 'uppercase', letterSpacing: 0.8,
                      marginRight: 8,
                    }}>{group.label}</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
                  </View>
                  {/* Transactions in this group */}
                  {group.items.map((tx: any, i: number) => (
                    <TransactionItem
                      key={i}
                      {...tx}
                      currencySymbol={tx.currencySymbol && tx.currencySymbol !== '$' ? tx.currencySymbol : currency.symbol}
                      onPress={() => setSelectedTransaction(tx)}
                    />
                  ))}
                </View>
              ))
            )}
          </View>

        </View>
      </Animated.ScrollView>

      {/* ── ADD TRANSACTION MODAL ── */}
      <AddTransactionModal
        visible={addTxModalVisible}
        initialType={txInitialType}
        onClose={() => setAddTxModalVisible(false)}
        onSave={handleSaveTransaction}
      />

      {/* ── NOTIFICATIONS MODAL ── */}
      <Modal transparent visible={showNotifications} animationType="fade" onRequestClose={toggleNotifications} statusBarTranslucent>
        <View style={{
          position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: Platform.OS === 'web' ? ('100vw' as any) : '100%',
          height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          alignItems: 'center',
          paddingHorizontal: 16,
          zIndex: 99999,
        }}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
            activeOpacity={1} 
            onPress={toggleNotifications} 
          />
          <Animated.View
            style={{ 
              width: '100%',
              maxWidth: 420,
              alignSelf: 'center',
              marginTop: Platform.OS === 'web' ? 60 : insets.top + 40, 
              backgroundColor: '#1e293b', 
              borderRadius: 24, 
              padding: 20, 
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              maxHeight: SCREEN_HEIGHT * 0.8,
              shadowColor: '#000', 
              shadowOffset: { width: 0, height: 10 }, 
              shadowOpacity: 0.4, 
              shadowRadius: 20, 
              elevation: 10,
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0]
                })
              }]
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Notifications & Alerts</Text>
                {(unpaidBills.length > 0 || incomeNotifications.length > 0) && (
                  <View style={{ backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}>
                    <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800' }}>{unpaidBills.length + incomeNotifications.length} New</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={toggleNotifications}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {/* ⚠️ Warning Payments / Unpaid Bills */}
              {unpaidBills.length > 0 && (
                <View style={{ marginBottom: 4 }}>
                  <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                    ⚠️ Warning Payments ({unpaidBills.length})
                  </Text>
                  {unpaidBills.map((bill, idx) => {
                    const isOverdue = bill.daysLeft <= 0;
                    const isUrgent = bill.daysLeft <= 3;
                    const badgeColor = isOverdue ? '#ef4444' : isUrgent ? '#f59e0b' : '#3b82f6';
                    return (
                      <TouchableOpacity
                        key={bill.id || idx}
                        activeOpacity={0.75}
                        onPress={() => {
                          toggleNotifications();
                          navigation.navigate('AllUpcomingPayments');
                        }}
                        style={{
                          flexDirection: 'row', gap: 12, alignItems: 'center',
                          backgroundColor: isOverdue ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)',
                          padding: 12, borderRadius: 16, marginBottom: 8,
                          borderWidth: 1, borderColor: badgeColor + '40'
                        }}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: badgeColor + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: badgeColor + '50' }}>
                          <Ionicons name={isOverdue ? 'alert-circle-outline' : 'warning-outline'} size={20} color={badgeColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{bill.title}</Text>
                            <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 13 }}>{formatAmount(bill.amount)}</Text>
                          </View>
                          <Text style={{ color: isOverdue ? '#ef4444' : 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                            {isOverdue ? '⚠️ Payment Due Today / Overdue' : `Payment due in ${bill.daysLeft} days`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* 💵 Upcoming Incomes */}
              {incomeNotifications.length > 0 && (
                <View style={{ marginBottom: 4 }}>
                  <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                    💰 Upcoming & Received Incomes ({incomeNotifications.length})
                  </Text>
                  {incomeNotifications.slice(0, 4).map((inc, idx) => (
                    <TouchableOpacity
                      key={inc.id || idx}
                      activeOpacity={0.75}
                      onPress={() => {
                        toggleNotifications();
                        navigation.navigate('AllTransactions');
                      }}
                      style={{
                        flexDirection: 'row', gap: 12, alignItems: 'center',
                        backgroundColor: 'rgba(115,242,24,0.05)',
                        padding: 12, borderRadius: 16, marginBottom: 8,
                        borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)'
                      }}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(115,242,24,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)' }}>
                        <Ionicons name="arrow-down-circle-outline" size={20} color="#73f218" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{inc.title}</Text>
                          <Text style={{ color: '#73f218', fontWeight: '800', fontSize: 13 }}>+{formatAmount(inc.amount)}</Text>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                          Expected income deposit • {inc.date || 'Scheduled'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Empty state */}
              {unpaidBills.length === 0 && incomeNotifications.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Ionicons name="shield-checkmark-outline" size={36} color="rgba(255,255,255,0.3)" style={{ marginBottom: 8 }} />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>No Pending Alerts</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                    All warning payments are cleared and incomes are up to date!
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* ── SEARCH MODAL ── */}
      <SearchModal visible={showSearch} onClose={() => setShowSearch(false)} insets={insets} />

      {/* ── TRANSACTION DETAIL MODAL ── */}
      <Modal transparent visible={!!selectedTransaction} animationType="fade" onRequestClose={() => setSelectedTransaction(null)} statusBarTranslucent>
        <View style={{
          position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: Platform.OS === 'web' ? ('100vw' as any) : '100%',
          height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          paddingHorizontal: 16,
          paddingVertical: 20,
          zIndex: 99999,
        }}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
            activeOpacity={1} 
            onPress={() => setSelectedTransaction(null)} 
          />
          <Animated.View style={{
            backgroundColor: '#1e293b',
            borderRadius: 24,
            width: '100%',
            maxWidth: 400,
            padding: isSmallScreen ? 18 : 22,
            borderWidth: 1.5,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            maxHeight: SCREEN_HEIGHT * 0.85,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
              {/* Header / Close */}
              <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
                <TouchableOpacity onPress={() => setSelectedTransaction(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={isSmallScreen ? 20 : 24} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              {/* Icon */}
              <View style={{
                width: isSmallScreen ? 52 : 60, 
                height: isSmallScreen ? 52 : 60, 
                borderRadius: isSmallScreen ? 26 : 30,
                backgroundColor: selectedTransaction?.isIncome ? 'rgba(115, 242, 24, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1,
                borderColor: selectedTransaction?.isIncome ? 'rgba(115, 242, 24, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                marginBottom: 12,
              }}>
                <Ionicons name={selectedTransaction?.icon} size={isSmallScreen ? 24 : 30} color={selectedTransaction?.isIncome ? '#73f218' : '#ef4444'} />
              </View>

              {/* Title & Amount */}
              <Text style={{ color: '#fff', fontSize: isSmallScreen ? 18 : 20, fontWeight: '800', marginBottom: 4, textAlign: 'center' }}>{selectedTransaction?.title}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: isSmallScreen ? 12 : 13, fontWeight: '500', marginBottom: isSmallScreen ? 14 : 18, textAlign: 'center' }}>{selectedTransaction?.date}</Text>
              
              <Text 
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={{ 
                fontSize: isSmallScreen ? 26 : 30, fontWeight: '900', 
                color: selectedTransaction?.isIncome ? '#73f218' : '#fff',
                marginBottom: isSmallScreen ? 18 : 22, letterSpacing: -1
              }}>
                {selectedTransaction?.isIncome ? '+' : '-'}{selectedTransaction?.currencySymbol && selectedTransaction?.currencySymbol !== '$' ? selectedTransaction?.currencySymbol : currency.symbol}{selectedTransaction?.amount}
              </Text>

              {/* Details Card */}
              <View style={{
                width: '100%',
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: 16, 
                padding: isSmallScreen ? 14 : 16, 
                gap: isSmallScreen ? 10 : 12,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: isSmallScreen ? 12 : 13, fontWeight: '600' }}>Status</Text>
                  <Text style={{ color: '#73f218', fontSize: isSmallScreen ? 12 : 13, fontWeight: '700' }}>Completed</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: isSmallScreen ? 12 : 13, fontWeight: '600' }}>Category</Text>
                  <Text style={{ color: '#fff', fontSize: isSmallScreen ? 12 : 13, fontWeight: '600' }}>{selectedTransaction?.isIncome ? 'Income' : 'Expense'}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' }}>Transaction ID</Text>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>#TRX-{Math.floor(Math.random() * 90000) + 10000}</Text>
                </View>
              </View>

              {/* Share / Export Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleShareTransaction(selectedTransaction)}
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderWidth: 1.5,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 16,
                  paddingVertical: 12,
                  marginTop: 16,
                  gap: 8,
                }}
              >
                <Ionicons name="share-social-outline" size={16} color="#73f218" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                  Share Receipt
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

    </View>
  );
}
