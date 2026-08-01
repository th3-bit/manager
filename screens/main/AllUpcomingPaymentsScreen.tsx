import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StatusBar, Platform, Dimensions, Modal,
  TextInput, KeyboardAvoidingView, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCurrency } from '../../context/CurrencyContext';
import { useBills } from '../../context/BillContext';

const { width: SW, height: SH } = Dimensions.get('window');

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
const isSmall = SW < 375;

// ─── Data ─────────────────────────────────────────────────────────────────────

type Payment = {
  title: string; amount: number; daysLeft: number;
  icon: string; isPrimary: boolean; category: 'Subscription' | 'Bill';
};

const INITIAL_PAYMENTS: Payment[] = [
  { title: 'Spotify',     amount: 10.99, daysLeft: 3,  icon: 'musical-notes-outline', isPrimary: true,  category: 'Subscription' },
  { title: 'Rent',        amount: 850.00, daysLeft: 7,  icon: 'home-outline',          isPrimary: false, category: 'Bill'         },
  { title: 'Netflix',     amount: 18.00,  daysLeft: 14, icon: 'tv-outline',            isPrimary: false, category: 'Subscription' },
  { title: 'Adobe Cloud', amount: 54.99,  daysLeft: 20, icon: 'color-palette-outline', isPrimary: false, category: 'Subscription' },
  { title: 'Electricity', amount: 120.00, daysLeft: 25, icon: 'flash-outline',          isPrimary: false, category: 'Bill'         },
];

const FILTERS = ['All', 'Due Soon', 'Bills', 'Subscriptions'];
const SORTS = ['Days Left', 'Amount'];
const ICON_OPTIONS = ['musical-notes-outline', 'home-outline', 'tv-outline', 'color-palette-outline', 'flash-outline', 'water-outline', 'card-outline', 'shield-checkmark-outline'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDaysLeftColor = (days: number) => {
  if (days <= 3) return '#ef4444'; // Red
  if (days <= 7) return '#f59e0b'; // Amber
  return '#73f218'; // Green
};

// ─── Card Component ───────────────────────────────────────────────────────────

const PaymentCard = ({ item, onPress }: { item: Payment; onPress: () => void }) => {
  const { currency } = useCurrency();
  const daysColor = getDaysLeftColor(item.daysLeft);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 20, marginBottom: 12,
        padding: isSmall ? 12 : 16,
        borderWidth: 1, borderColor: '#f3f4f6',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
      }}
    >
      {/* Icon Circle */}
      <View style={{
        width: isSmall ? 40 : 46, height: isSmall ? 40 : 46,
        borderRadius: isSmall ? 20 : 23,
        backgroundColor: 'rgba(115,242,24,0.1)',
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
      }}>
        <Ionicons name={item.icon as any} size={isSmall ? 18 : 22} color="#73f218" />
      </View>

      {/* Title & Metadata */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: '#111827', fontWeight: '800', fontSize: isSmall ? 14 : 15 }}>
          {item.title}
        </Text>
        <Text style={{ color: '#9ca3af', fontSize: isSmall ? 11 : 12, marginTop: 2 }}>
          {item.category}
        </Text>
      </View>

      {/* Amount and Due State */}
      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
        <Text style={{ color: '#111827', fontSize: isSmall ? 14 : 16, fontWeight: '800' }}>
          {currency.symbol}{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
        <View style={{
          marginTop: 6, paddingHorizontal: 8, paddingVertical: 3,
          borderRadius: 20, backgroundColor: daysColor + '18',
        }}>
          <Text style={{ color: daysColor, fontSize: 10, fontWeight: '800' }}>
            {item.daysLeft <= 0 ? 'Due today' : item.daysLeft === 1 ? 'Due tomorrow' : `Due in ${item.daysLeft} days`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Add New Payment Modal ──────────────────────────────────────────────────────

const AddPaymentModal = ({ visible, onClose, onAdd }: any) => {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'Subscription' | 'Bill'>('Subscription');
  const [icon, setIcon] = useState('musical-notes-outline');

  const { currency } = useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  useEffect(() => {
    if (visible && currency) {
      setSelectedCurrency(currency);
    }
  }, [visible, currency]);

  const activeCurrency = selectedCurrency && selectedCurrency.code ? selectedCurrency : currency;

  // Date selection states (to dynamically calculate days left!)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDay, setTempDay] = useState(new Date().getDate());
  const [tempMonth, setTempMonth] = useState(new Date().getMonth());
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [deadline, setDeadline] = useState('');
  const [calculatedDays, setCalculatedDays] = useState<number | null>(null);

  const [error, setError] = useState('');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const todayDate = new Date();

  const reset = () => {
    const fresh = new Date();
    setTitle(''); setAmount(''); setCategory('Subscription'); setIcon('musical-notes-outline');
    setDeadline(''); setCalculatedDays(null); setError('');
    setTempDay(fresh.getDate()); setTempMonth(fresh.getMonth()); setTempYear(fresh.getFullYear());
  };

  const handleClose = () => { reset(); onClose(); };

  const handleCreate = () => {
    if (!title.trim()) { setError('Please enter a name or utility provider.'); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError('Please enter a valid amount.'); return; }
    if (calculatedDays === null) { setError('Please select a payment date.'); return; }
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch(e){}
    const dueObj = new Date();
    dueObj.setDate(dueObj.getDate() + (calculatedDays || 0));
    onAdd({
      title: title.trim(),
      amount: Number(amount),
      daysLeft: calculatedDays,
      dueDate: dueObj.toISOString().split('T')[0],
      icon,
      isPrimary: false,
      category,
    });
    handleClose();
  };

  const confirmDate = () => {
    const selected = new Date(tempYear, tempMonth, tempDay);
    const today = new Date();
    // Reset hours to compare days
    today.setHours(0,0,0,0);
    selected.setHours(0,0,0,0);

    const diffTime = selected.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    setDeadline(`${tempDay} ${months[tempMonth]} ${tempYear}`);
    setCalculatedDays(diffDays);
    setShowDatePicker(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{
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
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          zIndex: 9999,
        }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={handleClose} />
          <View style={{
            width: '100%',
            maxWidth: 500,
            alignSelf: 'center',
            backgroundColor: '#0f172a', borderTopLeftRadius: 32, borderTopRightRadius: 32,
            paddingBottom: insets.bottom + 16, maxHeight: SH * 0.92,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
          {/* Header */}
          <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 6 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <View>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>Add Upcoming Payment</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>Never miss a renewal or bill again</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {/* Icon Picker */}
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 }}>CHOOSE ICON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 22 }}>
              {ICON_OPTIONS.map(ico => (
                <TouchableOpacity
                  key={ico} onPress={() => { try { Haptics.selectionAsync(); } catch(err){} setIcon(ico); }}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: icon === ico ? 'rgba(115,242,24,0.18)' : 'rgba(255,255,255,0.06)',
                    borderWidth: icon === ico ? 2 : 1, borderColor: icon === ico ? '#73f218' : 'rgba(255,255,255,0.1)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name={ico as any} size={20} color={icon === ico ? '#73f218' : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Category Toggle */}
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 }}>CATEGORY</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22 }}>
              {(['Subscription', 'Bill'] as const).map(cat => {
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat} onPress={() => { try { Haptics.selectionAsync(); } catch(err){} setCategory(cat); }}
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: 12,
                      backgroundColor: active ? 'rgba(115,242,24,0.15)' : 'rgba(255,255,255,0.04)',
                      borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.08)',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: active ? '#73f218' : 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 14 }}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Input Fields */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 }}>PROVIDER NAME</Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, height: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Netflix, Water Bill" placeholderTextColor="rgba(255,255,255,0.2)" style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', outlineStyle: 'none' } as any} />
              </View>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 }}>AMOUNT & CURRENCY</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, height: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Text style={{ color: '#73f218', fontSize: (activeCurrency.symbol || '').length > 2 ? 14 : 17, fontWeight: '800', marginRight: 6 }}>
                    {activeCurrency.symbol}
                  </Text>
                  <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor="rgba(255,255,255,0.2)" style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', outlineStyle: 'none' } as any} />
                </View>

                {/* Currency Selector Box */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowCurrencyPicker(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    height: 50,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    gap: 6,
                  }}
                >
                  <Image
                    source={{ uri: activeCurrency.flagUrl }}
                    style={{ width: 22, height: 16, borderRadius: 3, resizeMode: 'cover' }}
                  />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                    {activeCurrency.code}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Date Selection Trigger */}
            <View style={{ marginBottom: 22 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 }}>NEXT DUE DATE</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowDatePicker(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: 'rgba(115,242,24,0.08)', borderRadius: 14,
                  paddingHorizontal: 14, height: 50, borderWidth: 1, borderColor: 'rgba(115,242,24,0.3)',
                }}
              >
                <Ionicons name="calendar-outline" size={20} color="#73f218" style={{ marginRight: 10 }} />
                <Text style={{ flex: 1, color: deadline ? '#73f218' : 'rgba(115,242,24,0.4)', fontSize: 15, fontWeight: '700' }}>
                  {deadline || 'Select payment date'}
                </Text>
                {calculatedDays !== null && (
                  <View style={{ backgroundColor: 'rgba(115,242,24,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginRight: 8 }}>
                    <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '800' }}>{calculatedDays}d left</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color="rgba(115,242,24,0.5)" />
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {error !== '' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
              </View>
            )}

            {/* Create CTA Button */}
            <TouchableOpacity onPress={handleCreate} activeOpacity={0.85} style={{ borderRadius: 16, overflow: 'hidden' }}>
              <LinearGradient colors={['#73f218', '#73f218cc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 }}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#0f172a" />
                <Text style={{ color: '#0f172a', fontSize: 16, fontWeight: '900' }}>Confirm Payment Info</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Custom Calendar Picker Modal ── */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => setShowDatePicker(false)} />
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: '#1e293b', borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 16 }}>Select Payment Date</Text>

            {/* Calendar Controls */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  const now = new Date();
                  if (tempYear === now.getFullYear() && tempMonth === now.getMonth()) return;
                  if (tempMonth === 0) { setTempMonth(11); setTempYear(prev => prev - 1); }
                  else { setTempMonth(prev => prev - 1); }
                }}
                style={{ padding: 4, opacity: (tempYear === todayDate.getFullYear() && tempMonth === todayDate.getMonth()) ? 0.3 : 1 }}
                disabled={tempYear === todayDate.getFullYear() && tempMonth === todayDate.getMonth()}
              >
                <Ionicons name="chevron-back" size={20} color="#73f218" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{months[tempMonth]} {tempYear}</Text>
              <TouchableOpacity onPress={() => { if (tempMonth === 11) { setTempMonth(0); setTempYear(prev => prev + 1); } else { setTempMonth(prev => prev + 1); } }} style={{ padding: 4 }}>
                <Ionicons name="chevron-forward" size={20} color="#73f218" />
              </TouchableOpacity>
            </View>

            {/* Weekdays Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <Text key={day} style={{ color: 'rgba(255,255,255,0.3)', width: 34, textAlign: 'center', fontSize: 12, fontWeight: '700' }}>{day}</Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 20 }}>
              {(() => {
                const daysInMonth = new Date(tempYear, tempMonth + 1, 0).getDate();
                const firstDayIndex = new Date(tempYear, tempMonth, 1).getDay();
                const gridItems = [];
                for (let i = 0; i < firstDayIndex; i++) {
                  gridItems.push(<View key={`empty-${i}`} style={{ width: '14.28%', height: 36 }} />);
                }
                const currentY = todayDate.getFullYear();
                const currentM = todayDate.getMonth();
                const currentD = todayDate.getDate();

                for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
                  const isPast = (tempYear === currentY && tempMonth === currentM && dayNum < currentD) || (tempYear < currentY) || (tempYear === currentY && tempMonth < currentM);
                  const isSelected = tempDay === dayNum;
                  gridItems.push(
                    <TouchableOpacity
                      key={`day-${dayNum}`} disabled={isPast} onPress={() => { try { Haptics.selectionAsync(); } catch(err){} setTempDay(dayNum); }}
                      style={{ width: '14.28%', height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: isSelected ? '#73f218' : 'transparent', opacity: isPast ? 0.2 : 1 }}
                    >
                      <Text style={{ color: isSelected ? '#0f172a' : '#fff', fontSize: 13, fontWeight: isSelected ? '800' : '500' }}>{dayNum}</Text>
                    </TouchableOpacity>
                  );
                }
                return gridItems;
              })()}
            </View>

            {/* Cancel/Confirm Actions */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDate} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#73f218', alignItems: 'center' }}>
                <Text style={{ color: '#0f0f1a', fontSize: 14, fontWeight: '800' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Currency Selection Sheet ── */}
      <Modal transparent visible={showCurrencyPicker} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowCurrencyPicker(false)}
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

// ─── Main Screen ─────────────────────────────────────────────────────────────────

export function AllUpcomingPaymentsScreen({ navigation }: any) {
  const { currency } = useCurrency();
  const { bills, addBill, markAsPaid } = useBills();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Days Left');
  const [showAdd, setShowAdd] = useState(false);

  const payments: Payment[] = useMemo(() => {
    return bills.filter(b => !b.isPaid).map(b => ({
      title: b.title,
      amount: b.amount,
      daysLeft: b.daysLeft,
      icon: b.icon,
      isPrimary: b.isPrimary || false,
      category: b.category,
    }));
  }, [bills]);

  const handleAdd = (newPayment: Payment) => {
    addBill({
      title: newPayment.title,
      amount: newPayment.amount,
      daysLeft: newPayment.daysLeft,
      dueDate: `${newPayment.daysLeft} days`,
      icon: newPayment.icon,
      category: newPayment.category,
    });
  };

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (filter === 'All') return true;
      if (filter === 'Due Soon') return p.daysLeft <= 7;
      if (filter === 'Bills') return p.category === 'Bill';
      if (filter === 'Subscriptions') return p.category === 'Subscription';
      return true;
    });
  }, [payments, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'Days Left') return a.daysLeft - b.daysLeft;
      if (sortBy === 'Amount') return b.amount - a.amount;
      return 0;
    });
  }, [filtered, sortBy]);

  // Aggregate stats
  const totalUpcoming = payments.reduce((acc, p) => acc + p.amount, 0);
  const next30Days = payments.filter(p => p.daysLeft <= 30).reduce((acc, p) => acc + p.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header Layout */}
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f2010']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          paddingTop: Platform.OS === 'web' ? 16 : insets.top + 10,
          paddingBottom: 20, paddingHorizontal: 16,
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', bottom: -40, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: '#73f218', opacity: 0.06 }} />
        <View style={{ position: 'absolute', top: -30, left: -10, width: 100, height: 100, borderRadius: 50, backgroundColor: '#3b82f6', opacity: 0.06 }} />

        {/* Back and Subtitle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Upcoming Payments</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500', marginTop: 1 }}>{payments.length} active payments</Text>
          </View>
        </View>

        {/* Aggregate Stats Card */}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 16,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 18,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 }}>TOTAL UPCOMING</Text>
              <Text style={{ color: '#fff', fontSize: isSmall ? 20 : 24, fontWeight: '900', marginTop: 3, letterSpacing: -0.5 }}>
                {currency.symbol}{totalUpcoming.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 }}>NEXT 30 DAYS</Text>
              <Text style={{ color: '#73f218', fontSize: isSmall ? 20 : 24, fontWeight: '900', marginTop: 3, letterSpacing: -0.5 }}>
                {currency.symbol}{next30Days.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>

        {/* Filters and Sort Controls */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
          {FILTERS.map(f => {
            const active = filter === f;
            return (
              <TouchableOpacity key={f} onPress={() => setFilter(f)} style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: active ? '#73f218' : 'rgba(255,255,255,0.07)',
                borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.1)',
              }}>
                <Text style={{ color: active ? '#0f172a' : 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' }}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '600', alignSelf: 'center', marginRight: 4 }}>Sort:</Text>
          {SORTS.map(s => {
            const active = sortBy === s;
            return (
              <TouchableOpacity key={s} onPress={() => setSortBy(s)} style={{
                paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
              }}>
                <Text style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* Payments List Container */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {sorted.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="card-outline" size={28} color="#d1d5db" />
            </View>
            <Text style={{ color: '#374151', fontSize: 16, fontWeight: '700', marginBottom: 6 }}>No payments found</Text>
            <Text style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>All caught up! No bills match this filter.</Text>
          </View>
        ) : (
          sorted.map((item, i) => (
            <PaymentCard
              key={i} item={item}
              onPress={() => navigation.navigate('UpcomingPaymentDetail', {
                payment: {
                  name: item.title,
                  amount: item.amount,
                  daysLeft: item.daysLeft,
                  icon: item.icon,
                  color: item.category === 'Subscription' ? '#60a5fa' : '#73f218',
                }
              })}
            />
          ))
        )}

        {/* Add New Payment Button */}
        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 10, marginTop: 4,
            backgroundColor: '#fff', borderRadius: 20, padding: 16,
            borderWidth: 2, borderColor: '#73f218', borderStyle: 'dashed',
          }}
        >
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#73f21818', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={20} color="#73f218" />
          </View>
          <Text style={{ color: '#73f218', fontSize: 15, fontWeight: '800' }}>Add New Payment</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Payment Form modal */}
      <AddPaymentModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
      />
    </View>
  );
}
