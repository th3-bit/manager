import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, StatusBar, Platform, Modal, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dimensions } from 'react-native';
import { useCurrency } from '../../context/CurrencyContext';
import { useTransactions } from '../../context/TransactionContext';

const { width: SW } = Dimensions.get('window');
const isSmall = SW < 375;

// ─── Full transaction list ────────────────────────────────────────────────────

const ALL_TRANSACTIONS = [
  { title: 'Amazon',      date: 'Today, 02:02 PM',       amount: '20.50',    icon: 'logo-amazon',           isIncome: false, category: 'Shopping'     },
  { title: 'Adobe',       date: 'Today, 03:22 PM',       amount: '130.50',   icon: 'color-palette-outline', isIncome: false, category: 'Subscription' },
  { title: 'Salary',      date: 'Yesterday, 09:00 AM',   amount: '3,200.00', icon: 'cash-outline',          isIncome: true,  category: 'Income'       },
  { title: 'Apple Inc.',  date: '2 days ago, 03:02 PM',  amount: '230.50',   icon: 'logo-apple',            isIncome: false, category: 'Subscription' },
  { title: 'Freelance',   date: '3 days ago, 04:00 PM',  amount: '500.00',   icon: 'laptop-outline',        isIncome: true,  category: 'Income'       },
  { title: 'Netflix',     date: '4 days ago, 10:00 AM',  amount: '18.00',    icon: 'tv-outline',            isIncome: false, category: 'Subscription' },
  { title: 'Groceries',   date: '5 days ago, 08:30 AM',  amount: '84.50',    icon: 'basket-outline',        isIncome: false, category: 'Food'         },
  { title: 'Spotify',     date: '6 days ago, 12:00 PM',  amount: '8.00',     icon: 'musical-notes-outline', isIncome: false, category: 'Subscription' },
  { title: 'Rent',        date: 'Jun 01, 09:00 AM',      amount: '650.00',   icon: 'home-outline',          isIncome: false, category: 'Housing'      },
  { title: 'Coffee',      date: 'Jun 01, 08:15 AM',      amount: '4.80',     icon: 'cafe-outline',          isIncome: false, category: 'Food'         },
];

const FILTERS = ['All', 'Income', 'Expenses', 'Subscriptions'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getGroup = (dateStr: string) => {
  if (dateStr.startsWith('Today'))       return 'Today';
  if (dateStr.startsWith('Yesterday'))   return 'Yesterday';
  if (dateStr.match(/^\d+ days? ago/))   return 'Earlier this week';
  return 'Older';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const TxRow = ({ tx, currencySymbol = '$', onPress }: any) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 16, marginBottom: 8,
      paddingVertical: isSmall ? 10 : 12,
      paddingHorizontal: isSmall ? 12 : 14,
      borderWidth: 1, borderColor: '#f3f4f6',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    }}
  >
    <View style={{
      width: isSmall ? 38 : 44, height: isSmall ? 38 : 44,
      borderRadius: isSmall ? 19 : 22,
      backgroundColor: '#f9fafb',
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    }}>
      <Ionicons name={tx.icon} size={isSmall ? 18 : 20} color="#374151" />
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: '#111827', fontWeight: '700', fontSize: isSmall ? 13 : 14 }}>{tx.title}</Text>
      <Text numberOfLines={1} style={{ color: '#9ca3af', fontSize: isSmall ? 10 : 11, marginTop: 2 }}>{tx.date}</Text>
    </View>
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      style={{ fontWeight: '800', fontSize: isSmall ? 13 : 15, color: tx.isIncome ? '#73f218' : '#ef4444', flexShrink: 0 }}
    >
      {tx.isIncome ? '+' : '-'}{currencySymbol}{tx.amount}
    </Text>
  </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export function AllTransactionsScreen({ navigation }: any) {
  const { currency } = useCurrency();
  const { transactions: rawTransactions } = useTransactions();
  const insets = useSafeAreaInsets();
  const [query, setQuery]           = useState('');
  const [filter, setFilter]         = useState('All');
  const [selected, setSelected]     = useState<any>(null);

  const transactionsList = useMemo(() => {
    return rawTransactions.map(t => ({
      title: t.title,
      date: t.date,
      amount: t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      icon: t.icon || (t.isIncome ? 'cash-outline' : 'card-outline'),
      isIncome: t.isIncome,
      category: t.category || 'General',
    }));
  }, [rawTransactions]);

  const filtered = useMemo(() => {
    return transactionsList.filter(tx => {
      const matchQ = query.trim() === '' || tx.title.toLowerCase().includes(query.toLowerCase());
      const matchF =
        filter === 'All'           ? true :
        filter === 'Income'        ? tx.isIncome :
        filter === 'Expenses'      ? !tx.isIncome && tx.category !== 'Subscription' :
        filter === 'Subscriptions' ? tx.category === 'Subscription' : true;
      return matchQ && matchF;
    });
  }, [query, filter, transactionsList]);

  // Group
  const groups = useMemo(() => {
    const g: { label: string; items: typeof transactionsList }[] = [];
    const seen: Record<string, number> = {};
    filtered.forEach(tx => {
      const label = getGroup(tx.date);
      if (seen[label] === undefined) { seen[label] = g.length; g.push({ label, items: [] }); }
      g[seen[label]].items.push(tx);
    });
    return g;
  }, [filtered]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#1e3a5f']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          paddingTop: Platform.OS === 'web' ? 16 : insets.top + 10,
          paddingBottom: 16,
          paddingHorizontal: 16,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        {/* Back + Title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 }}>All Transactions</Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' }}>
            {filtered.length} total
          </Text>
        </View>

        {/* Search bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 14, paddingHorizontal: 14, height: 44,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
          marginBottom: 14,
        }}>
          <Ionicons name="search-outline" size={17} color="rgba(255,255,255,0.35)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search transactions…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={{ flex: 1, color: '#fff', fontSize: 14, fontWeight: '500', marginLeft: 10, outlineStyle: 'none' } as any}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={11} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          {FILTERS.map(f => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: active ? '#73f218' : 'rgba(255,255,255,0.07)',
                  borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{ color: active ? '#0f172a' : 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' }}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* ── List ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {groups.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="receipt-outline" size={28} color="#d1d5db" />
            </View>
            <Text style={{ color: '#374151', fontSize: 16, fontWeight: '700', marginBottom: 6 }}>No transactions found</Text>
            <Text style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>Try adjusting your search or filter</Text>
          </View>
        ) : (
          groups.map(group => (
            <View key={group.label}>
              {/* Group header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4 }}>
                <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 8 }}>
                  {group.label}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
              </View>
              {group.items.map((tx, i) => (
                <TxRow key={i} tx={tx} currencySymbol={currency.symbol} onPress={() => setSelected(tx)} />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Transaction Detail Modal ── */}
      <Modal transparent visible={!!selected} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.75)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => setSelected(null)} />
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24,
            padding: isSmall ? 20 : 24, borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.2)',
            ...({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any),
            shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
            alignItems: 'center',
          }}>
            {/* Close */}
            <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -10, zIndex: 10 }}>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
            {/* Icon */}
            <View style={{
              width: isSmall ? 56 : 64, height: isSmall ? 56 : 64,
              borderRadius: isSmall ? 28 : 32,
              backgroundColor: selected?.isIncome ? 'rgba(115,242,24,0.15)' : 'rgba(239,68,68,0.15)',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: selected?.isIncome ? 'rgba(115,242,24,0.3)' : 'rgba(239,68,68,0.3)',
              marginBottom: 16,
            }}>
              <Ionicons name={selected?.icon} size={isSmall ? 26 : 32} color={selected?.isIncome ? '#73f218' : '#ef4444'} />
            </View>
            <Text style={{ color: '#fff', fontSize: isSmall ? 18 : 20, fontWeight: '800', marginBottom: 4 }}>{selected?.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16 }}>{selected?.date}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
              style={{ fontSize: isSmall ? 28 : 32, fontWeight: '900', color: selected?.isIncome ? '#73f218' : '#fff', marginBottom: 22, letterSpacing: -1 }}>
              {selected?.isIncome ? '+' : '-'}{currency.symbol}{selected?.amount}
            </Text>
            {/* Details */}
            <View style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: isSmall ? 14 : 16, gap: isSmall ? 10 : 12 }}>
              {[
                { label: 'Status',   value: 'Completed',           valueColor: '#73f218' },
                { label: 'Category', value: selected?.category,    valueColor: '#fff'    },
                { label: 'Type',     value: selected?.isIncome ? 'Income' : 'Expense', valueColor: '#fff' },
              ].map(row => (
                <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: isSmall ? 12 : 13, fontWeight: '600' }}>{row.label}</Text>
                  <Text style={{ color: row.valueColor, fontSize: isSmall ? 12 : 13, fontWeight: '700' }}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
