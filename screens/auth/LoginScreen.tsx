import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { AuthLayout } from '../../components/AuthLayout';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  }

  return (
    <AuthLayout title="Welcome Back." subtitle="Enter your email and password to access your dashboard and manage your finances.">
      <View className="items-center mb-10 mt-4">
          <Text className="text-4xl font-bold text-brand mb-2">Welcome Back</Text>
        <Text className="text-gray-500 text-base">Sign in to manage your finances</Text>
      </View>

      <View className="bg-white p-6 rounded-2xl shadow-sm">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Email Address</Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-800"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-semibold text-gray-700">Password</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text className="text-brand text-xs font-bold">Forgot Password?</Text>
          </TouchableOpacity>
        </View>
        <View className="relative justify-center mb-6">
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 pr-12"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity 
            className="absolute right-4" 
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          className="bg-brand rounded-xl py-4 items-center mb-4"
          onPress={signInWithEmail}
          disabled={loading}
        >
          <Text className="text-white font-bold text-lg">{loading ? 'Signing In...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <View className="flex-row items-center my-4">
          <View className="flex-1 h-[1px] bg-gray-200" />
          <Text className="text-gray-400 mx-4 uppercase text-xs font-bold">or continue with</Text>
          <View className="flex-1 h-[1px] bg-gray-200" />
        </View>

        <View className="flex-row justify-between gap-4 mt-2">
          <TouchableOpacity 
            className="flex-1 bg-white border border-gray-200 rounded-xl py-3 items-center"
            onPress={() => Alert.alert('Coming Soon', 'Google Authentication will be linked later.')}
          >
            <Text className="text-gray-700 font-bold">Google</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-1 bg-black rounded-xl py-3 items-center"
            onPress={() => Alert.alert('Coming Soon', 'Apple Authentication will be linked later.')}
          >
            <Text className="text-white font-bold">Apple</Text>
          </TouchableOpacity>
        </View>
      </View>

        <View className="flex-row justify-center mt-8 pb-8">
          <Text className="text-gray-600">Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text className="text-brand font-bold">Sign Up</Text>
          </TouchableOpacity>
        </View>
    </AuthLayout>
  );
}
