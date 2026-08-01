import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, SafeAreaView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { TermsModal } from '../../components/TermsModal';
import { AuthLayout } from '../../components/AuthLayout';

export function SignUpScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Focus state for password box
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Password Validation Logic
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordStrong = hasLength && hasUpper && hasNumber && hasSymbol;
  
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  function handleAcceptTerms() {
    setAgreed(true);
    setShowTerms(false);
  }

  async function signUpWithEmail() {
    setErrorMessage('');
    setSuccessMessage('');
    
    if (!fullName || !email || !password) {
      setErrorMessage('Please fill out all fields.');
      return;
    }
    if (!isPasswordStrong) {
      setErrorMessage('Please ensure your password meets all requirements.');
      return;
    }
    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match. Please try again.');
      return;
    }
    if (!agreed) {
      setErrorMessage('You must agree to the Terms & Conditions to sign up.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage('Success! We sent a confirmation link to your email address. Please click it to activate your account.');
    }
    setLoading(false);
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
    <AuthLayout title="Start Your Journey." subtitle="Create an account today and take full control of your financial future.">
      <View className="items-center mb-8 mt-4">
            <Text className="text-4xl font-bold text-brand mb-2">Create Account</Text>
          <Text className="text-gray-500 text-base">Start tracking your financial journey</Text>
        </View>

        <View className="bg-white p-6 rounded-2xl shadow-sm mb-8">
          {errorMessage ? (
            <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6 flex-row items-center">
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text className="text-red-600 flex-1 ml-2 font-medium">{errorMessage}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View className="bg-brand-light border border-brand p-4 rounded-xl mb-6 flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#73F218" />
              <Text className="text-green-800 flex-1 ml-2 font-medium leading-relaxed">{successMessage}</Text>
            </View>
          ) : null}

          <Text className="text-sm font-semibold text-gray-700 mb-2">Full Name</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-800"
            placeholder="John Doe"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text className="text-sm font-semibold text-gray-700 mb-2">Email Address</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-800"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text className="text-sm font-semibold text-gray-700 mb-2">Password</Text>
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

          {/* Password Strength Indicator - Only shows when focused */}
          {isPasswordFocused && (
            <View className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4 mt-2">
              <Text className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Password Requirements</Text>
              <RequirementItem met={hasLength} text="At least 8 characters" />
              <RequirementItem met={hasUpper} text="At least 1 capital letter" />
              <RequirementItem met={hasNumber} text="At least 1 number" />
              <RequirementItem met={hasSymbol} text="At least 1 special symbol (!@#$%)" />
            </View>
          )}

          <Text className="text-sm font-semibold text-gray-700 mb-2 mt-2">Confirm Password</Text>
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
            <View className="mb-4 ml-1">
              <RequirementItem met={passwordsMatch} text="Passwords match" />
            </View>
          )}

          <View className="flex-row items-center mb-6 mt-4 pr-4">
            <TouchableOpacity 
              className={`w-6 h-6 border rounded-md items-center justify-center mr-3 ${agreed ? 'bg-brand border-brand' : 'bg-gray-50 border-gray-300'}`}
              onPress={() => setAgreed(!agreed)}
            >
              {agreed && <Text className="text-white text-xs font-bold">✓</Text>}
            </TouchableOpacity>
            <View className="flex-row flex-wrap flex-1">
              <Text className="text-gray-600 text-sm">I agree to the </Text>
              <TouchableOpacity onPress={() => setShowTerms(true)}>
                <Text className="text-brand text-sm font-bold">Terms of Service & Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            className={`rounded-xl py-4 items-center ${isPasswordStrong && passwordsMatch && agreed ? 'bg-brand' : 'bg-brand/50'}`}
            onPress={signUpWithEmail}
            disabled={loading}
          >
            <Text className="font-bold text-lg text-white">
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center pb-10">
          <Text className="text-gray-600">Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-brand font-bold">Sign In</Text>
          </TouchableOpacity>
        </View>

      {/* Terms & Conditions Modal */}
      <TermsModal 
        visible={showTerms} 
        onClose={() => setShowTerms(false)} 
        onAccept={handleAcceptTerms} 
      />
    </AuthLayout>
  );
}
