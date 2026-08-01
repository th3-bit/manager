import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
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
    >
      <View className="flex-1 bg-black/60 justify-center items-center px-6">
        <View className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl items-center border border-gray-100">
          {/* Animated Icon Circle */}
          <View className={`w-16 h-16 ${iconBgColor} rounded-full items-center justify-center mb-4`}>
            <Ionicons name={iconName} size={36} color={iconColor} />
          </View>

          {/* Modal Header */}
          <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
            {title}
          </Text>

          {/* Modal Description */}
          <Text className="text-sm text-gray-600 text-center leading-relaxed mb-6">
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
              className={`flex-1 ${buttonBgColor} py-3.5 rounded-2xl items-center shadow-sm`}
            >
              <Text className="text-white font-bold text-base">{actionText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
