import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Dimensions, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBills } from '../../context/BillContext';
import { useCurrency } from '../../context/CurrencyContext';

const { height } = Dimensions.get('window');

export function UpcomingPaymentDetailScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { currency, formatAmount } = useCurrency();
  const { deleteBill } = useBills();
  const payment = route?.params?.payment ?? {
    name: 'Adobe Creative',
    amount: 30,
    daysLeft: 2,
    icon: 'color-palette-outline',
    color: '#73f218'
  };

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  const availablePlans = [
    { name: 'Basic', amount: 10 },
    { name: 'Standard', amount: payment.amount },
    { name: 'Premium', amount: 50 },
  ];
  const [currentAmount, setCurrentAmount] = useState(payment.amount);
  const [currentPlanName, setCurrentPlanName] = useState('Standard');
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(1);
  const [customAmountText, setCustomAmountText] = useState('');

  const history = [
    { date: 'Jun 11, 2026', amount: 30, status: 'Paid' },
    { date: 'May 11, 2026', amount: 30, status: 'Paid' },
    { date: 'Apr 11, 2026', amount: 30, status: 'Paid' },
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
        colors={['#1e293b', '#0f172a', '#020617']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          height: height * 0.85,
          overflow: 'hidden',
        }}
      >
        {/* Glow orb */}
        <View style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: payment.color, opacity: 0.08 }} />

        {/* Drag Handle */}
        <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </View>

        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: payment.color + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={payment.icon as any} size={28} color={payment.color} />
            </View>
            <View>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>{payment.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }}>Subscription</Text>
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

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 + insets.bottom }}>

          {/* ── Overview Card ── */}
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 24, marginBottom: 20,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center'
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Next Payment In</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 20 }}>
              <Text style={{ color: payment.color, fontSize: 48, fontWeight: '900', letterSpacing: -1, lineHeight: 50 }}>{payment.daysLeft}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20, fontWeight: '700', marginBottom: 6 }}>days</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{formatAmount(currentAmount)} <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>/ mo</Text></Text>
          </View>

          {/* ── Details List ── */}
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 18, marginBottom: 24,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 16 }}>Payment Details</Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Billing Cycle</Text>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Monthly</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Payment Method</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="card-outline" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Visa •••• 5466</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Auto-renew</Text>
              <View style={{ backgroundColor: '#65d31520', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                <Text style={{ color: '#65d315', fontSize: 12, fontWeight: '800' }}>Active</Text>
              </View>
            </View>
          </View>

          {/* ── Actions ── */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => setShowChangePlanModal(true)}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center'
              }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Change Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => setShowCancelModal(true)}
              disabled={isCancelled}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 16,
                backgroundColor: isCancelled ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.1)', 
                borderWidth: 1, 
                borderColor: isCancelled ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.2)',
                alignItems: 'center'
              }}>
              <Text style={{ color: isCancelled ? 'rgba(255,255,255,0.4)' : '#ef4444', fontWeight: '700', fontSize: 15 }}>
                {isCancelled ? 'Cancelled' : 'Cancel Sub'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── History ── */}
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 18,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 14 }}>Recent Payments</Text>
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
                    backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="checkmark-done" size={16} color="rgba(255,255,255,0.8)" />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{h.date}</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{formatAmount(h.amount)}</Text>
              </View>
            ))}
          </View>

        </ScrollView>
      </LinearGradient>

      {/* ── Cancel Subscription Modal ── */}
      <Modal transparent visible={showCancelModal} animationType="fade">
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          activeOpacity={1}
          onPress={() => setShowCancelModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{
            width: '100%', backgroundColor: '#1e293b', borderRadius: 24, padding: 24,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
          }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
              <Ionicons name="warning-outline" size={28} color="#ef4444" />
            </View>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>Cancel Subscription?</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Are you sure you want to cancel your <Text style={{ color: '#fff', fontWeight: '800' }}>{payment.name}</Text> subscription? You will lose access at the end of the current billing cycle.
            </Text>

            <View style={{ gap: 12 }}>
              <TouchableOpacity
                style={{ paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center' }}
                onPress={() => {
                  setIsCancelled(true);
                  setShowCancelModal(false);
                  if (payment.id) deleteBill(payment.id);
                  navigation.goBack();
                }}
              >
                <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 15 }}>Yes, Cancel Subscription</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Keep Subscription</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Change Plan Modal ── */}
      <Modal transparent visible={showChangePlanModal} animationType="fade">
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          activeOpacity={1}
          onPress={() => setShowChangePlanModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{
            width: '100%', backgroundColor: '#1e293b', borderRadius: 24, padding: 24,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Change Plan</Text>
              <TouchableOpacity onPress={() => setShowChangePlanModal(false)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={{ gap: 12, marginBottom: 24 }}>
              {availablePlans.map((plan, idx) => {
                const isSelected = selectedPlanIndex === idx;
                const isCurrent = currentPlanName === plan.name;
                return (
                  <TouchableOpacity key={idx} 
                    onPress={() => setSelectedPlanIndex(idx)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      padding: 16, borderRadius: 16,
                      backgroundColor: isSelected ? payment.color + '20' : 'rgba(255,255,255,0.05)',
                      borderWidth: 1, borderColor: isSelected ? payment.color : 'rgba(255,255,255,0.1)'
                    }}>
                    <View>
                      <Text style={{ color: isSelected ? payment.color : '#fff', fontWeight: '700', fontSize: 16 }}>{plan.name}</Text>
                      {isCurrent && <Text style={{ color: payment.color, fontSize: 11, marginTop: 4 }}>Current Plan</Text>}
                    </View>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{formatAmount(plan.amount)}/mo</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Custom Plan Option */}
              <TouchableOpacity
                onPress={() => setSelectedPlanIndex(3)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  padding: 16, borderRadius: 16,
                  backgroundColor: selectedPlanIndex === 3 ? payment.color + '20' : 'rgba(255,255,255,0.05)',
                  borderWidth: 1, borderColor: selectedPlanIndex === 3 ? payment.color : 'rgba(255,255,255,0.1)'
                }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: selectedPlanIndex === 3 ? payment.color : '#fff', fontWeight: '700', fontSize: 16 }}>Custom</Text>
                  {currentPlanName === 'Custom' && <Text style={{ color: payment.color, fontSize: 11, marginTop: 4 }}>Current Plan</Text>}
                </View>
                {selectedPlanIndex === 3 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginRight: 4 }}>{currency.symbol}</Text>
                    <TextInput
                      style={{
                        color: '#fff', fontWeight: '800', fontSize: 16,
                        borderBottomWidth: 1, borderBottomColor: payment.color,
                        minWidth: 40, textAlign: 'center', padding: 0
                      }}
                      keyboardType="numeric"
                      value={customAmountText}
                      onChangeText={setCustomAmountText}
                      placeholder="0"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      autoFocus
                    />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>/mo</Text>
                  </View>
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Enter amount</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={{ paddingVertical: 14, borderRadius: 16, backgroundColor: payment.color, alignItems: 'center' }}
              onPress={() => {
                if (selectedPlanIndex === 3) {
                  const val = parseInt(customAmountText, 10);
                  if (!isNaN(val) && val >= 0) {
                    setCurrentAmount(val);
                    setCurrentPlanName('Custom');
                  }
                } else {
                  setCurrentAmount(availablePlans[selectedPlanIndex].amount);
                  setCurrentPlanName(availablePlans[selectedPlanIndex].name);
                }
                setShowChangePlanModal(false);
              }}
            >
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Update Plan</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}
