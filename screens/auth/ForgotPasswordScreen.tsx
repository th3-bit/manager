import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { AuthLayout } from '../../components/AuthLayout';

import { Platform } from 'react-native';

export function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setLoading(false);
    
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Check Your Email', 'If an account exists for that email, we have sent password reset instructions.');
      navigation.goBack();
    }
  }

  return (
    <AuthLayout title="Recover Account." subtitle="Enter your email to receive a password reset link securely.">
      <View className="w-full max-w-md">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mb-8">
          <Ionicons name="arrow-back" size={24} color="#4b5563" />
        </TouchableOpacity>

        <View className="items-center mb-10">
          <View className="w-20 h-20 bg-brand-light rounded-full items-center justify-center mb-6 shadow-sm">
            <Ionicons name="key-outline" size={40} color="#73F218" />
          </View>
          <Text className="text-4xl font-bold text-gray-900 mb-2">Reset Password</Text>
          <Text className="text-gray-500 text-base text-center px-4 leading-relaxed">
            Enter the email associated with your account and we'll send an email with instructions to securely reset your password.
          </Text>
        </View>

        <View className="bg-white p-6 rounded-2xl shadow-sm">
          <Text className="text-sm font-semibold text-gray-700 mb-2">Email Address</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 text-gray-800"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TouchableOpacity 
            className="bg-brand rounded-xl py-4 items-center shadow-sm"
            onPress={handleReset}
            disabled={loading}
          >
            <Text className="text-white font-bold text-lg">{loading ? 'Sending...' : 'Send Reset Link'}</Text>
          </TouchableOpacity>
        </View>

        {/* Helper Link for Users Without Accounts */}
        <View className="flex-row justify-center mt-8 pb-8">
          <Text className="text-gray-600">Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text className="text-brand font-bold">Sign Up</Text>
          </TouchableOpacity>
        </View>

      </View>
    </AuthLayout>
  );
}
