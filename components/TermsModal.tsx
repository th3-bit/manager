import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export function TermsModal({ visible, onClose, onAccept }: TermsModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-gray-200 items-center">
        <View className="w-full max-w-2xl flex-1 bg-gray-50 shadow-xl overflow-hidden">
        
          {/* Header */}
          <View className="flex-row justify-between items-center p-5 bg-white border-b border-gray-100 shadow-sm z-10">
          <View className="flex-row items-center">
            <Ionicons name="shield-checkmark" size={24} color="#73F218" className="mr-2" />
            <Text className="text-xl font-bold text-gray-900 ml-2">Terms & Privacy</Text>
          </View>
          <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
            <Ionicons name="close" size={20} color="#4b5563" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Last Updated: July 2026</Text>
          
          <Text className="text-lg font-extrabold text-gray-800 mb-2">1. Acceptance of Terms</Text>
          <Text className="text-gray-600 mb-8 leading-loose text-base">
            By accessing and using this Financial Manager application, you accept and agree to be bound by the terms and provision of this agreement. This is a demo application, but by agreeing you acknowledge that we do not take responsibility for actual financial loss resulting from the use of our software.
          </Text>
          
          <Text className="text-lg font-extrabold text-gray-800 mb-2">2. Privacy Policy & Security</Text>
          <Text className="text-gray-600 mb-8 leading-loose text-base">
            Your privacy is our absolute priority. We secure your personal information using industry-standard <Text className="font-bold text-gray-800">Supabase encryption</Text>. 
            {'\n\n'}
            • We do not sell your personal data to third parties.
            {'\n'}
            • All financial data inputted is private to your local account.
            {'\n'}
            • We employ dynamic password checking to ensure compliance with our security standards.
          </Text>

          <Text className="text-lg font-extrabold text-gray-800 mb-2">3. User Responsibilities</Text>
          <Text className="text-gray-600 mb-8 leading-loose text-base">
            You are responsible for maintaining the confidentiality of your account and password. You must also ensure that the password you create is strong and not shared with anyone.
          </Text>
          
          {/* Bottom Padding for scroll */}
          <View className="h-10" />
        </ScrollView>

        {/* Sticky Footer */}
        <View className="p-6 bg-white border-t border-gray-100 shadow-lg">
          <TouchableOpacity 
            className="bg-brand rounded-xl py-4 items-center shadow-sm"
            onPress={onAccept}
          >
            <Text className="text-white font-bold text-lg">I Accept & Continue</Text>
          </TouchableOpacity>
        </View>

        </View>
      </SafeAreaView>
    </Modal>
  );
}
