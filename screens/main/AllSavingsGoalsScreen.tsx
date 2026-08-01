import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StatusBar, Platform, Dimensions, Modal,
  TextInput, KeyboardAvoidingView, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCurrency } from '../../context/CurrencyContext';
import { useGoals } from '../../context/GoalContext';

const { width: SW, height: SH } = Dimensions.get('window');
const isSmall = SW < 375;

// ─── Data ─────────────────────────────────────────────────────────────────────

type Goal = {
  label: string; icon: string; saved: number;
  target: number; color: string; deadline: string; monthlyContrib: number;
};

const INITIAL_GOALS: Goal[] = [
  { label: 'Vacation',       icon: '✈️',  saved: 1200, target: 3000,  color: '#73f218', deadline: 'Aug 2025',  monthlyContrib: 300 },
  { label: 'New Laptop',     icon: '💻',  saved: 450,  target: 1500,  color: '#6366f1', deadline: 'Oct 2025',  monthlyContrib: 150 },
  { label: 'Emergency Fund', icon: '🛡️', saved: 2800, target: 5000,  color: '#f59e0b', deadline: 'Dec 2025',  monthlyContrib: 350 },
  { label: 'Car',            icon: '🚗',  saved: 300,  target: 8000,  color: '#ec4899', deadline: 'Jun 2027',  monthlyContrib: 200 },
  { label: 'House Deposit',  icon: '🏡',  saved: 4500, target: 20000, color: '#0ea5e9', deadline: 'Jan 2028',  monthlyContrib: 500 },
];

const SORTS = ['Progress', 'Amount', 'Name'];

const EMOJI_OPTIONS = ['✈️','💻','🛡️','🚗','🏡','📚','🏋️','🎸','💍','🌍','🎓','🏖️','🐾','🎮','🏥'];
const COLOR_OPTIONS = ['#73f218','#6366f1','#f59e0b','#ec4899','#0ea5e9','#ef4444','#10b981','#f97316','#8b5cf6','#14b8a6'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pctOf = (saved: number, target: number) =>
  target > 0 ? Math.min(Math.round((saved / target) * 100), 100) : 0;

const monthsToFinish = (saved: number, target: number, contrib: number) =>
  contrib > 0 ? Math.ceil((target - saved) / contrib) : null;

// ─── Goal Card ────────────────────────────────────────────────────────────────

const GoalCard = ({ goal, onPress }: { goal: Goal; onPress: () => void }) => {
  const { currency } = useCurrency();
  const pct       = pctOf(goal.saved, goal.target);
  const left      = monthsToFinish(goal.saved, goal.target, goal.monthlyContrib);
  const remaining = goal.target - goal.saved;

  return (
    <TouchableOpacity
      onPress={onPress} activeOpacity={0.82}
      style={{
        backgroundColor: '#fff', borderRadius: 20, marginBottom: 12, overflow: 'hidden',
        borderWidth: 1, borderColor: '#f3f4f6',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
      }}
    >
      <View style={{ height: 4, backgroundColor: goal.color, width: `${pct}%` as any }} />
      <View style={{ padding: isSmall ? 14 : 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={{
            width: isSmall ? 42 : 48, height: isSmall ? 42 : 48,
            borderRadius: isSmall ? 21 : 24, backgroundColor: goal.color + '18',
            alignItems: 'center', justifyContent: 'center', marginRight: 12,
          }}>
            <Text style={{ fontSize: isSmall ? 20 : 24 }}>{goal.icon}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: '#111827', fontWeight: '800', fontSize: isSmall ? 14 : 16 }}>{goal.label}</Text>
            <Text style={{ color: '#9ca3af', fontSize: isSmall ? 11 : 12, marginTop: 2, fontWeight: '500' }}>Due {goal.deadline}</Text>
          </View>
          <View style={{ backgroundColor: goal.color + '18', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: goal.color, fontSize: 13, fontWeight: '900' }}>{pct}%</Text>
          </View>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: '#f3f4f6', marginBottom: 10 }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: goal.color, width: `${pct}%` as any }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Saved</Text>
            <Text style={{ color: '#111827', fontSize: isSmall ? 14 : 15, fontWeight: '800', marginTop: 2 }}>{currency.symbol}{goal.saved.toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Remaining</Text>
            <Text style={{ color: '#ef4444', fontSize: isSmall ? 14 : 15, fontWeight: '800', marginTop: 2 }}>{currency.symbol}{remaining.toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Target</Text>
            <Text style={{ color: '#111827', fontSize: isSmall ? 14 : 15, fontWeight: '800', marginTop: 2 }}>{currency.symbol}{goal.target.toLocaleString()}</Text>
          </View>
        </View>
        {left !== null && (
          <View style={{
            marginTop: 12, flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
          }}>
            <Ionicons name="time-outline" size={13} color="#9ca3af" />
            <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', marginLeft: 6 }}>
              Est. <Text style={{ color: '#374151', fontWeight: '700' }}>{left} months</Text> to complete
              {' '}<Text style={{ color: '#9ca3af' }}>· {currency.symbol}{goal.monthlyContrib}/mo</Text>
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ─── Mini Preview Card (inside the Add modal) ─────────────────────────────────

const PreviewCard = ({ label, icon, color, target, monthly, deadline }: any) => {
  const months = monthly > 0 && target > 0 ? Math.ceil(target / monthly) : null;
  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden', marginTop: 4,
    }}>
      <View style={{ height: 3, backgroundColor: color || '#73f218', width: '0%' }} />
      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: (color || '#73f218') + '25',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 22 }}>{icon || '🎯'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
            {label || 'My Goal'}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>
            {target ? `Target $${Number(target).toLocaleString()}` : 'Set a target amount'}
            {months ? `  ·  ~${months} months` : ''}
            {deadline ? `  ·  Due ${deadline}` : ''}
          </Text>
        </View>
        <View style={{ backgroundColor: (color || '#73f218') + '22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: color || '#73f218', fontSize: 12, fontWeight: '900' }}>0%</Text>
        </View>
      </View>
    </View>
  );
};

// ─── Add New Goal Modal ────────────────────────────────────────────────────────

const AddGoalModal = ({ visible, onClose, onAdd }: any) => {
  const { currency } = useCurrency();
  const insets = useSafeAreaInsets();
  const [label,    setLabel]    = useState('');
  const [target,   setTarget]   = useState('');
  const [monthly,  setMonthly]  = useState('');
  const [deadline, setDeadline] = useState('');
  const [icon,     setIcon]     = useState('🎯');
  const [color,    setColor]    = useState('#73f218');
  const [error,    setError]    = useState('');

  // Date picker states
  const todayDate = new Date();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDay, setTempDay] = useState(todayDate.getDate());
  const [tempMonth, setTempMonth] = useState(todayDate.getMonth()); // 0-11
  const [tempYear, setTempYear] = useState(todayDate.getFullYear());

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const reset = () => {
    const fresh = new Date();
    setLabel(''); setTarget(''); setMonthly('');
    setDeadline(''); setIcon('🎯'); setColor('#73f218'); setError('');
    setTempDay(fresh.getDate());
    setTempMonth(fresh.getMonth());
    setTempYear(fresh.getFullYear());
  };

  const handleClose = () => { reset(); onClose(); };

  const handleCreate = () => {
    if (!label.trim())        { setError('Please enter a goal name.');       return; }
    if (!target || isNaN(Number(target)) || Number(target) <= 0)
                               { setError('Please enter a valid target amount.'); return; }
    if (!deadline.trim())      { setError('Please select a deadline.'); return; }
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch(e){}
    onAdd({
      label: label.trim(),
      icon,
      color,
      saved: 0,
      target: Number(target),
      deadline: deadline.trim(),
      monthlyContrib: Number(monthly) || 0,
    });
    handleClose();
  };

  const handleTargetChange = (val: string) => {
    setTarget(val);
    const numTarget = Number(val);
    if (!isNaN(numTarget) && numTarget > 0) {
      const numMonthly = Number(monthly);
      if (!isNaN(numMonthly) && numMonthly > 0) {
        // Recalculate deadline based on monthly contribution
        const monthsNeeded = Math.ceil(numTarget / numMonthly);
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + monthsNeeded);
        setTempDay(futureDate.getDate());
        setTempMonth(futureDate.getMonth());
        setTempYear(futureDate.getFullYear());
        setDeadline(`${futureDate.getDate()} ${months[futureDate.getMonth()]} ${futureDate.getFullYear()}`);
      } else if (deadline) {
        // Recalculate monthly contribution based on current deadline
        const today = new Date();
        const selectedDate = new Date(tempYear, tempMonth, tempDay);
        let diffMonths = (selectedDate.getFullYear() - today.getFullYear()) * 12 + (selectedDate.getMonth() - today.getMonth());
        if (selectedDate.getDate() < today.getDate()) {
          diffMonths -= 0.5;
        }
        const monthsRemaining = Math.max(1, Math.ceil(diffMonths));
        setMonthly(String(Math.round(numTarget / monthsRemaining)));
      }
    }
  };

  const handleMonthlyChange = (val: string) => {
    setMonthly(val);
    const numMonthly = Number(val);
    if (!isNaN(numMonthly) && numMonthly > 0) {
      const numTarget = Number(target);
      if (!isNaN(numTarget) && numTarget > 0) {
        // Recalculate deadline based on target and monthly contribution
        const monthsNeeded = Math.ceil(numTarget / numMonthly);
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + monthsNeeded);
        setTempDay(futureDate.getDate());
        setTempMonth(futureDate.getMonth());
        setTempYear(futureDate.getFullYear());
        setDeadline(`${futureDate.getDate()} ${months[futureDate.getMonth()]} ${futureDate.getFullYear()}`);
      }
    }
  };

  const confirmDate = () => {
    const selectedDate = new Date(tempYear, tempMonth, tempDay);
    setDeadline(`${tempDay} ${months[tempMonth]} ${tempYear}`);
    setShowDatePicker(false);

    // Dynamic auto-calculation: update monthly contribution based on new deadline
    if (target && !isNaN(Number(target)) && Number(target) > 0) {
      const today = new Date();
      let diffMonths = (selectedDate.getFullYear() - today.getFullYear()) * 12 + (selectedDate.getMonth() - today.getMonth());
      if (selectedDate.getDate() < today.getDate()) {
        diffMonths -= 0.5;
      }
      const monthsRemaining = Math.max(1, Math.ceil(diffMonths));
      setMonthly(String(Math.round(Number(target) / monthsRemaining)));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
          {/* Dim overlay */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1} onPress={handleClose}
          />

          {/* Sheet */}
          <View style={{
            width: '100%',
            maxWidth: 500,
            alignSelf: 'center',
            backgroundColor: '#0f172a',
            borderTopLeftRadius: 32, borderTopRightRadius: 32,
            paddingBottom: insets.bottom + 16,
            maxHeight: SH * 0.92,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
          {/* Glow orbs */}
          <View style={{ position: 'absolute', top: -30, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: color, opacity: 0.06, pointerEvents: 'none' } as any} />

          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 6 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <View>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>New Savings Goal</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500', marginTop: 2 }}>Fill in the details below</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {/* ── Emoji picker ── */}
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 }}>CHOOSE AN ICON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 22 }}>
              {EMOJI_OPTIONS.map(e => (
                <TouchableOpacity
                  key={e} onPress={() => { try { Haptics.selectionAsync(); } catch(err){} setIcon(e); }}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: icon === e ? color + '30' : 'rgba(255,255,255,0.06)',
                    borderWidth: icon === e ? 2 : 1,
                    borderColor: icon === e ? color : 'rgba(255,255,255,0.1)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Colour picker ── */}
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 }}>ACCENT COLOUR</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
              {COLOR_OPTIONS.map(c => (
                <TouchableOpacity
                  key={c} onPress={() => { try { Haptics.selectionAsync(); } catch(err){} setColor(c); }}
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: c,
                    borderWidth: color === c ? 3 : 0,
                    borderColor: '#fff',
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: c, shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: color === c ? 0.5 : 0, shadowRadius: 6, elevation: color === c ? 4 : 0,
                  }}
                >
                  {color === c && <Ionicons name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Inputs ── */}
            {[
              { label: 'Goal Name',                             value: label,    set: setLabel,            placeholder: 'e.g. New Car',        keyType: 'default'  },
              { label: `Target Amount (${currency.symbol})`,      value: target,   set: handleTargetChange,  placeholder: 'e.g. 5000',           keyType: 'numeric'  },
              { label: `Monthly Contribution (${currency.symbol})`,value: monthly, set: handleMonthlyChange, placeholder: 'e.g. 200 (optional)', keyType: 'numeric'  },
            ].map(field => (
              <View key={field.label} style={{ marginBottom: 16 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 }}>
                  {field.label.toUpperCase()}
                </Text>
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 14, paddingHorizontal: 14, height: 50,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                }}>
                  <TextInput
                    value={field.value}
                    onChangeText={field.set}
                    placeholder={field.placeholder}
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    keyboardType={field.keyType as any}
                    style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', outlineStyle: 'none' } as any}
                  />
                </View>
              </View>
            ))}

            {/* ── Deadline Date Box ── */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 }}>
                DEADLINE
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowDatePicker(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(115,242,24,0.08)',
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  height: 50,
                  borderWidth: 1,
                  borderColor: 'rgba(115,242,24,0.3)',
                }}
              >
                <Ionicons name="calendar-outline" size={20} color="#73f218" style={{ marginRight: 10 }} />
                <Text style={{
                  flex: 1,
                  color: deadline ? '#73f218' : 'rgba(115,242,24,0.4)',
                  fontSize: 15,
                  fontWeight: '700',
                }}>
                  {deadline || 'Select deadline date'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(115,242,24,0.5)" />
              </TouchableOpacity>
            </View>

            {/* ── Savings Plan Summary (Dynamic Auto-Calculation feedback) ── */}
            {Number(target) > 0 && Number(monthly) > 0 && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: 'rgba(115,242,24,0.08)', borderRadius: 12,
                padding: 12, marginBottom: 16,
                borderWidth: 1, borderColor: 'rgba(115,242,24,0.2)',
              }}>
                <Ionicons name="sparkles-outline" size={16} color="#73f218" />
                <Text style={{ color: '#73f218', fontSize: 13, fontWeight: '600', flex: 1 }}>
                  Savings Plan: Save ${Number(monthly).toLocaleString()}/month for {Math.ceil(Number(target) / Number(monthly))} month{Math.ceil(Number(target) / Number(monthly)) > 1 ? 's' : ''} to reach your ${Number(target).toLocaleString()} goal.
                </Text>
              </View>
            )}

            {/* ── Error ── */}
            {error !== '' && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12,
                padding: 12, marginBottom: 16,
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
              }}>
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
              </View>
            )}

            {/* ── Live Preview ── */}
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 }}>PREVIEW</Text>
            <PreviewCard label={label} icon={icon} color={color} target={target} monthly={monthly} deadline={deadline} />

            {/* ── Create Button ── */}
            <TouchableOpacity
              onPress={handleCreate}
              activeOpacity={0.85}
              style={{
                marginTop: 20, borderRadius: 16, overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={[color, color + 'cc']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 10, paddingVertical: 16,
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#0f172a" />
                <Text style={{ color: '#0f172a', fontSize: 16, fontWeight: '900' }}>Create Goal</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Custom Monthly Calendar Picker Modal ── */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          {/* Backdrop Touch to dismiss */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          />

          <View style={{
            width: '100%',
            maxWidth: 340,
            backgroundColor: '#1e293b',
            borderRadius: 24,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.1)',
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 8,
          }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 16 }}>
              Select Deadline Date
            </Text>

            {/* Month & Year Header Selector */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 16,
              marginBottom: 16,
            }}>
              {/* Prev button (disables if showing current month/year) */}
              <TouchableOpacity
                onPress={() => {
                  const now = new Date();
                  if (tempYear === now.getFullYear() && tempMonth === now.getMonth()) {
                    return; // Disable switching to past
                  }
                  if (tempMonth === 0) {
                    setTempMonth(11);
                    setTempYear(prev => prev - 1);
                  } else {
                    setTempMonth(prev => prev - 1);
                  }
                }}
                style={{ padding: 4, opacity: (tempYear === todayDate.getFullYear() && tempMonth === todayDate.getMonth()) ? 0.3 : 1 }}
                disabled={tempYear === todayDate.getFullYear() && tempMonth === todayDate.getMonth()}
              >
                <Ionicons name="chevron-back" size={20} color="#73f218" />
              </TouchableOpacity>

              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                {months[tempMonth]} {tempYear}
              </Text>

              {/* Next button */}
              <TouchableOpacity
                onPress={() => {
                  if (tempMonth === 11) {
                    setTempMonth(0);
                    setTempYear(prev => prev + 1);
                  } else {
                    setTempMonth(prev => prev + 1);
                  }
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-forward" size={20} color="#73f218" />
              </TouchableOpacity>
            </View>

            {/* Weekdays Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <Text key={day} style={{ color: 'rgba(255,255,255,0.3)', width: 34, textAlign: 'center', fontSize: 12, fontWeight: '700' }}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Calendar Grid */}
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
              marginBottom: 20,
            }}>
              {(() => {
                const daysInMonth = new Date(tempYear, tempMonth + 1, 0).getDate();
                const firstDayIndex = new Date(tempYear, tempMonth, 1).getDay();

                const gridItems = [];
                // Fill empty days for previous month offset
                for (let i = 0; i < firstDayIndex; i++) {
                  gridItems.push(<View key={`empty-${i}`} style={{ width: '14.28%', height: 36 }} />);
                }

                // Fill actual days of the month
                const currentY = todayDate.getFullYear();
                const currentM = todayDate.getMonth();
                const currentD = todayDate.getDate();

                for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
                  // Past date validation
                  const isPast =
                    (tempYear === currentY && tempMonth === currentM && dayNum < currentD) ||
                    (tempYear < currentY) ||
                    (tempYear === currentY && tempMonth < currentM);

                  const isSelected = tempDay === dayNum;

                  gridItems.push(
                    <TouchableOpacity
                      key={`day-${dayNum}`}
                      disabled={isPast}
                      onPress={() => { try { Haptics.selectionAsync(); } catch(err){} setTempDay(dayNum); }}
                      style={{
                        width: '14.28%',
                        height: 36,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 8,
                        backgroundColor: isSelected ? '#73f218' : 'transparent',
                        opacity: isPast ? 0.2 : 1,
                      }}
                    >
                      <Text style={{
                        color: isSelected ? '#0f172a' : '#fff',
                        fontSize: 13,
                        fontWeight: isSelected ? '800' : '500',
                      }}>
                        {dayNum}
                      </Text>
                    </TouchableOpacity>
                  );
                }
                return gridItems;
              })()}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDate}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: '#73f218',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#0f0f1a', fontSize: 14, fontWeight: '800' }}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export function AllSavingsGoalsScreen({ navigation }: any) {
  const { currency, formatAmount } = useCurrency();
  const { savingsGoals, addGoal } = useGoals();
  const insets = useSafeAreaInsets();
  const [sortBy, setSortBy] = useState('Progress');
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = (newGoal: any) => {
    addGoal({
      label: newGoal.label,
      icon: newGoal.icon,
      saved: newGoal.saved || 0,
      target: newGoal.target,
      color: newGoal.color,
      deadline: newGoal.deadline,
    });
  };

  const goals: Goal[] = savingsGoals.map(g => ({
    label: g.label,
    icon: g.icon,
    saved: g.saved,
    target: g.target,
    color: g.color || '#73f218',
    deadline: g.deadline || 'Dec 2026',
    monthlyContrib: g.monthlyContrib || Math.round(g.target / 12),
  }));

  const sorted = useMemo(() => {
    return [...goals].sort((a, b) => {
      if (sortBy === 'Progress') return pctOf(b.saved, b.target) - pctOf(a.saved, a.target);
      if (sortBy === 'Amount')   return b.saved - a.saved;
      if (sortBy === 'Name')     return a.label.localeCompare(b.label);
      return 0;
    });
  }, [goals, sortBy]);

  const totalSaved  = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const overallPct  = pctOf(totalSaved, totalTarget);

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0d1a0d']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          paddingTop: Platform.OS === 'web' ? 16 : insets.top + 10,
          paddingBottom: 20, paddingHorizontal: 16,
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', top: -30, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: '#73f218', opacity: 0.07 }} />
        <View style={{ position: 'absolute', bottom: -40, left: -10, width: 100, height: 100, borderRadius: 50, backgroundColor: '#6366f1', opacity: 0.07 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Savings Goals</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500', marginTop: 1 }}>{goals.length} active goals</Text>
          </View>
        </View>

        {/* Overall summary */}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 16,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 18,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 }}>TOTAL SAVED</Text>
              <Text style={{ color: '#73f218', fontSize: isSmall ? 22 : 26, fontWeight: '900', marginTop: 3, letterSpacing: -0.5 }}>{formatAmount(totalSaved)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 }}>TOTAL TARGET</Text>
              <Text style={{ color: '#fff', fontSize: isSmall ? 22 : 26, fontWeight: '900', marginTop: 3, letterSpacing: -0.5 }}>{formatAmount(totalTarget)}</Text>
            </View>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 8 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#73f218', width: `${overallPct}%` as any }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' }}>{formatAmount(totalTarget - totalSaved)} remaining</Text>
            <Text style={{ color: '#73f218', fontSize: 11, fontWeight: '800' }}>{overallPct}% overall</Text>
          </View>
        </View>

        {/* Sort pills */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '600', alignSelf: 'center', marginRight: 4 }}>Sort:</Text>
          {SORTS.map(s => {
            const active = sortBy === s;
            return (
              <TouchableOpacity key={s} onPress={() => setSortBy(s)} style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: active ? '#73f218' : 'rgba(255,255,255,0.07)',
                borderWidth: 1, borderColor: active ? '#73f218' : 'rgba(255,255,255,0.1)',
              }}>
                <Text style={{ color: active ? '#0f172a' : 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' }}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* ── Goal list ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {sorted.map((goal, i) => (
          <GoalCard
            key={i} goal={goal}
            onPress={() => navigation.navigate('SavingsGoalDetail', { goal })}
          />
        ))}

        {/* Add New Goal button */}
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
          <Text style={{ color: '#73f218', fontSize: 15, fontWeight: '800' }}>Add New Goal</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Add Goal Modal ── */}
      <AddGoalModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
      />
    </View>
  );
}
