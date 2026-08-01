import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AuthAlertModalProps {
  visible: boolean;
  type?: 'error' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
  actionText?: string;
  onAction?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallPhone = SCREEN_WIDTH < 375 || SCREEN_HEIGHT < 667;

export function AuthAlertModal({
  visible,
  type = 'error',
  title,
  message,
  onClose,
  actionText = 'Got it',
  onAction,
}: AuthAlertModalProps) {
  if (!visible) return null;

  const isSuccess = type === 'success';
  const isWarning = type === 'warning';
  const isInfo = type === 'info';

  const iconName = isSuccess
    ? 'checkmark-circle-outline'
    : isWarning
    ? 'warning-outline'
    : isInfo
    ? 'information-circle-outline'
    : 'alert-circle-outline';

  const iconBgColor = isSuccess
    ? 'bg-emerald-100'
    : isWarning
    ? 'bg-amber-100'
    : isInfo
    ? 'bg-sky-100'
    : 'bg-red-100';

  const iconColor = isSuccess
    ? '#10b981'
    : isWarning
    ? '#f59e0b'
    : isInfo
    ? '#0284c7'
    : '#ef4444';

  const buttonBgColor = isSuccess
    ? 'bg-emerald-600'
    : isWarning
    ? 'bg-amber-600'
    : isInfo
    ? 'bg-sky-600'
    : 'bg-red-500';

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-black/60 justify-center items-center px-4 py-6"
      >
        <View className="w-full max-w-sm bg-white rounded-3xl p-5 md:p-6 shadow-2xl items-center border border-gray-100 max-h-[85vh]">
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 4 }}
            className="w-full flex-grow-0"
          >
            {/* Animated Icon Circle */}
            <View className={`${isSmallPhone ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4'} ${iconBgColor} rounded-full items-center justify-center`}>
              <Ionicons name={iconName} size={isSmallPhone ? 28 : 36} color={iconColor} />
            </View>

            {/* Modal Header */}
            <Text className={`${isSmallPhone ? 'text-lg mb-1.5' : 'text-xl mb-2'} font-bold text-gray-900 text-center`}>
              {title}
            </Text>

            {/* Modal Description */}
            <Text className={`${isSmallPhone ? 'text-xs mb-4' : 'text-sm mb-6'} text-gray-600 text-center leading-relaxed px-1`}>
              {message}
            </Text>

            {/* Actions */}
            <View className="w-full flex-row gap-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (onAction) onAction();
                  onClose();
                }}
                className={`flex-1 ${buttonBgColor} ${isSmallPhone ? 'py-3' : 'py-3.5'} rounded-2xl items-center shadow-sm`}
              >
                <Text className="text-white font-bold text-base">{actionText}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
