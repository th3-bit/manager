import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, TextInput, Modal, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../../context/CurrencyContext';
import { useGoals } from '../../context/GoalContext';

import Svg, { Circle } from 'react-native-svg';

const { height } = Dimensions.get('window');

// ── Circular Progress Ring ─────────────────────────────────────────────────────
const CircularProgress = ({ pct, size = 150, stroke = 11, color = '#73f218' }: any) => {
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
          stroke="rgba(255,255,255,0.08)"
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
        <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1 }}>{pct}%</Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' }}>saved</Text>
      </View>
    </View>
  );
};

// ── Milestone Row ─────────────────────────────────────────────────────────────
const MilestoneRow = ({ label, amount, target, reached, color, currencySymbol = '$' }: any) => (
  <View style={{
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  }}>
    <View style={{
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: reached ? color + '25' : 'rgba(255,255,255,0.06)',
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    }}>
      <Ionicons
        name={reached ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={reached ? color : 'rgba(255,255,255,0.3)'}
      />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: reached ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: '700', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>{currencySymbol}{amount.toLocaleString()} of {currencySymbol}{target.toLocaleString()}</Text>
    </View>
    {reached && (
      <View style={{ backgroundColor: color + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ color, fontSize: 10, fontWeight: '800' }}>Reached ✓</Text>
      </View>
    )}
  </View>
);

// ── Main Screen ────────────────────────────────────────────────────────────────
export function SavingsGoalDetailScreen({ navigation, route }: any) {
  const { currency, formatAmount } = useCurrency();
  const { savingsGoals, updateGoalProgress } = useGoals();
  const goalFromParams = route?.params?.goal;

  const liveGoal = savingsGoals.find(g => g.id === goalFromParams?.id || g.label === goalFromParams?.label);
  const goal = liveGoal ? {
    id: liveGoal.id,
    label: liveGoal.label,
    icon: liveGoal.icon,
    saved: liveGoal.saved,
    target: liveGoal.target,
    color: liveGoal.color || '#73f218',
  } : (goalFromParams ?? {
    id: 'g-1', label: 'Vacation', icon: '✈️', saved: 1200, target: 3000, color: '#73f218',
  });

  const [amountToAdd, setAmountToAdd] = useState('50');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const pct = Math.min(Math.round((goal.saved / goal.target) * 100), 100);
  const remaining = goal.target - goal.saved;
  const monthsLeft = Math.ceil(remaining / 300);

  // Build milestones at 25%, 50%, 75%, 100%
  const milestones = [25, 50, 75, 100].map((m) => ({
    label: `${m}% milestone`,
    amount: Math.round((m / 100) * goal.target),
    target: goal.target,
    reached: pct >= m,
  }));

  // Contribution history (mock)
  const history = [
    { month: 'June 2026',  amount: 300 },
    { month: 'May 2026',   amount: 300 },
    { month: 'April 2026', amount: 250 },
    { month: 'March 2026', amount: 350 },
  ];

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <StatusBar barStyle="light-content" />

      {/* Tap overlay to dismiss */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        activeOpacity={1}
        onPress={() => navigation.goBack()}
      />

      {/* ── The Sheet ── */}
      <LinearGradient
        colors={['#162035', '#0f172a', '#0d1a0d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          height: height * 0.94,
          overflow: 'hidden',
        }}
      >
        {/* Glow orbs */}
        <View style={{ position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: goal.color, opacity: 0.08 }} />
        <View style={{ position: 'absolute', bottom: -40, left: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: '#3b82f6', opacity: 0.06 }} />

        {/* Drag Handle */}
        <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </View>

        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 28 }}>{goal.icon}</Text>
            <View>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>{goal.label}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>Savings Goal</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 50 }}>

          {/* ── Overview Card ── */}
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 24, marginBottom: 20,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <CircularProgress pct={pct} color={goal.color} />
              <View style={{ flex: 1, paddingLeft: 22 }}>
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Saved</Text>
                  <Text style={{ color: goal.color, fontSize: 20, fontWeight: '900', marginTop: 3 }}>{formatAmount(goal.saved)}</Text>
                </View>
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Remaining</Text>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 3 }}>{formatAmount(remaining)}</Text>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Target</Text>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 3 }}>{formatAmount(goal.target)}</Text>
                </View>
              </View>
            </View>

            {/* Progress bar */}
            <View style={{ marginTop: 20 }}>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ height: 7, borderRadius: 4, backgroundColor: goal.color, width: `${pct}%` as any }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{currency.symbol}0</Text>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{formatAmount(goal.target)}</Text>
              </View>
            </View>
          </View>

          {/* ── Quick Stats ── */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Monthly',   value: `${currency.symbol}300`, icon: 'calendar-outline', color: '#6366f1' },
              { label: 'Est. Done', value: `${monthsLeft}mo`, icon: 'time-outline', color: '#f59e0b' },
              { label: 'Status',    value: pct >= 100 ? 'Done ✓' : pct >= 50 ? 'On Track' : 'Early', icon: 'trending-up-outline', color: pct >= 50 ? goal.color : '#f59e0b' },
            ].map((s, i) => (
              <View key={i} style={{
                flex: 1, backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 18, padding: 14, alignItems: 'center',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
              }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: s.color + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
                }}>
                  <Ionicons name={s.icon as any} size={15} color={s.color} />
                </View>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{s.value}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2, fontWeight: '600' }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Add Funds ── */}
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 18, marginBottom: 24,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 14 }}>Add Funds</Text>
            
            {/* Custom Amount Input */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: '800' }}>{currency.symbol}</Text>
              <TextInput 
                style={{ flex: 1, color: '#fff', fontSize: 20, fontWeight: '800', paddingVertical: 16, marginLeft: 8 }}
                keyboardType="numeric"
                value={amountToAdd}
                onChangeText={(val) => setAmountToAdd(val.replace(/[^0-9]/g, ''))}
                placeholder="Custom Amount"
                placeholderTextColor="rgba(255,255,255,0.2)"
                selectionColor={goal.color}
              />
            </View>

            {/* Quick Presets */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {[50, 100, 200, 300].map((amt) => (
                <TouchableOpacity 
                  key={amt} 
                  activeOpacity={0.75} 
                  onPress={() => setAmountToAdd(amt.toString())}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: amountToAdd === amt.toString() ? goal.color + '33' : 'rgba(255,255,255,0.07)',
                    borderWidth: 1, borderColor: amountToAdd === amt.toString() ? goal.color : 'rgba(255,255,255,0.1)',
                    alignItems: 'center',
                  }}>
                  <Text style={{ color: amountToAdd === amt.toString() ? goal.color : '#fff', fontWeight: '800', fontSize: 14 }}>{currency.symbol}{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              activeOpacity={0.85} 
              style={{ borderRadius: 16, overflow: 'hidden' }}
              onPress={() => setShowConfirmModal(true)}
              disabled={!amountToAdd || parseInt(amountToAdd) <= 0}
            >
              <LinearGradient
                colors={(!amountToAdd || parseInt(amountToAdd) <= 0) ? ['#334155', '#1e293b'] : [goal.color, goal.color + 'cc']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 16 }}
              >
                <Text style={{ color: (!amountToAdd || parseInt(amountToAdd) <= 0) ? 'rgba(255,255,255,0.3)' : '#0f172a', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 }}>
                  + Add {currency.symbol}{amountToAdd || '0'} to Savings
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* ── Milestones ── */}
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 18, marginBottom: 24,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 8 }}>Milestones</Text>
            {milestones.map((m, i) => (
              <MilestoneRow key={i} {...m} color={goal.color} currencySymbol={currency.symbol} />
            ))}
          </View>

          {/* ── Contribution History ── */}
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 18,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Contributions</Text>
              <Text style={{ color: goal.color, fontWeight: '800', fontSize: 12 }}>History</Text>
            </View>
            {history.map((h, i) => (
              <View key={i} style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: i < history.length - 1 ? 1 : 0,
                borderBottomColor: 'rgba(255,255,255,0.05)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: goal.color + '20', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="arrow-down-outline" size={16} color={goal.color} />
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' }}>{h.month}</Text>
                </View>
                <Text style={{ color: goal.color, fontSize: 14, fontWeight: '800' }}>+{currency.symbol}{h.amount}</Text>
              </View>
            ))}
          </View>

        </ScrollView>
      </LinearGradient>

      {/* ── Confirmation Modal ── */}
      <Modal transparent visible={showConfirmModal} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{
            width: '100%',
            backgroundColor: '#1e293b',
            borderRadius: 24,
            padding: 24,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
          }}>
            {!isSuccess ? (
              <>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: goal.color + '20', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
                  <Ionicons name="wallet-outline" size={28} color={goal.color} />
                </View>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>Confirm Transfer</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
                  You are about to add <Text style={{ color: '#fff', fontWeight: '800' }}>{currency.symbol}{amountToAdd || '0'}</Text> to your "{goal.label}" savings goal.
                </Text>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}
                    onPress={() => setShowConfirmModal(false)}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}
                    onPress={() => {
                      const val = parseFloat(amountToAdd);
                      if (!isNaN(val) && val > 0 && goal.id) {
                        updateGoalProgress(goal.id, val);
                      }
                      setIsSuccess(true);
                      setTimeout(() => {
                        setIsSuccess(false);
                        setShowConfirmModal(false);
                      }, 1600);
                    }}
                  >
                    <LinearGradient
                      colors={[goal.color, goal.color + 'cc']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ paddingVertical: 14, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Confirm</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#65d315' + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="checkmark-circle" size={40} color="#65d315" />
                </View>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>Success!</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' }}>
                  {currency.symbol}{amountToAdd || '0'} has been added to your savings.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
