import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { AuthLayout } from '../../components/AuthLayout';

export function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password Validation Logic
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordStrong = hasLength && hasUpper && hasNumber && hasSymbol;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  async function handleUpdatePassword() {
    if (!isPasswordStrong) {
      Alert.alert('Error', 'Please ensure your password meets all requirements.');
      return;
    }
    if (!passwordsMatch) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    // This updates the user's password using the active recovery session
    const { error } = await supabase.auth.updateUser({ password: password });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Your password has been updated successfully!');
      // State transition handled in App.tsx by listening to USER_UPDATED
    }
  }

  const RequirementItem = ({ met, text }: { met: boolean, text: string }) => (
    <View className="flex-row items-center mb-1">
      <View className={`w-4 h-4 rounded-full items-center justify-center mr-2 ${met ? 'bg-brand' : 'bg-gray-200'}`}>
        {met && <Text className="text-white text-[10px] font-bold">✓</Text>}
      </View>
      <Text className={`text-xs ${met ? 'text-gray-800 font-bold' : 'text-gray-400 font-medium'}`}>{text}</Text>
    </View>
  );

  return (
    <AuthLayout title="Secure Your Account." subtitle="Create a strong, new password to keep your financial data safe.">
      <View className="w-full max-w-md">
          <View className="items-center mb-8 mt-4">
            <View className="w-20 h-20 bg-brand-light rounded-full items-center justify-center mb-6 shadow-sm">
              <Ionicons name="lock-closed-outline" size={40} color="#73F218" />
            </View>
            <Text className="text-4xl font-bold text-gray-900 mb-2">New Password</Text>
            <Text className="text-gray-500 text-base text-center px-4 leading-relaxed">
              Create a new secure password for your account. Make sure it meets all the requirements below.
            </Text>
          </View>

          <View className="bg-white p-6 rounded-2xl shadow-sm mb-8">
            <Text className="text-sm font-semibold text-gray-700 mb-2">New Password</Text>
            <View className="relative justify-center mb-2">
              <TextInput
                className={`bg-gray-50 border rounded-xl px-4 py-3 text-gray-800 pr-12 ${isPasswordFocused ? 'border-brand' : 'border-gray-200'}`}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
              />
              <TouchableOpacity 
                className="absolute right-4" 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {isPasswordFocused && (
              <View className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4 mt-2">
                <Text className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Password Requirements</Text>
                <RequirementItem met={hasLength} text="At least 8 characters" />
                <RequirementItem met={hasUpper} text="At least 1 capital letter" />
                <RequirementItem met={hasNumber} text="At least 1 number" />
                <RequirementItem met={hasSymbol} text="At least 1 special symbol (!@#$%)" />
              </View>
            )}

            <Text className="text-sm font-semibold text-gray-700 mb-2 mt-4">Confirm New Password</Text>
            <View className="relative justify-center mb-2">
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 pr-12"
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity 
                className="absolute right-4" 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            {/* Visual indicator for password match */}
            {confirmPassword.length > 0 && (
              <View className="mb-6 ml-1">
                <RequirementItem met={passwordsMatch} text="Passwords match" />
              </View>
            )}

            <TouchableOpacity 
              className={`rounded-xl py-4 items-center mt-2 ${isPasswordStrong && passwordsMatch ? 'bg-brand' : 'bg-brand/50'}`}
              onPress={handleUpdatePassword}
              disabled={loading}
            >
              <Text className="font-bold text-lg text-white">
                {loading ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
    </AuthLayout>
  );
}
