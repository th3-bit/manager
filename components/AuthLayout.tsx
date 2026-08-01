import React from 'react';
import { View, Text, Image, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AuthLayout({ 
  children, 
  title = "Master Your Finances Effortlessly.", 
  subtitle = "Log in to access your dashboard, track expenses, and manage your financial future with intelligent insights." 
}: AuthLayoutProps) {
  return (
    <View 
      className="flex-1 bg-white" 
      style={(Platform.OS === 'web' ? { minHeight: '100vh' } : {}) as any}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 flex-col md:flex-row w-full"
        style={(Platform.OS === 'web' ? { minHeight: '100vh' } : {}) as any}
        enabled={Platform.OS !== 'web'}
      >
        {/* Left Side (Form) */}
        <View className="flex-1 md:w-1/2 bg-white">
          <ScrollView 
            contentContainerClassName="flex-grow justify-center px-6 py-12 md:px-12 items-center"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* App Logo */}
            <View className="w-full max-w-md items-center mb-4 mt-2">
              <Image 
                source={require('../assets/icon.png')} 
                style={{ width: 80, height: 80 }}
                className="rounded-2xl"
                resizeMode="contain"
              />
            </View>

            <View className="w-full max-w-md">
              {children}
            </View>
          </ScrollView>
        </View>

        {/* Right Side (Marketing Panel - Hidden on Mobile) */}
        <View className="hidden md:flex md:w-1/2 bg-white p-4 lg:p-6">
          <View className="flex-1 bg-brand rounded-[40px] items-center justify-center p-8 lg:p-14 relative overflow-hidden w-full h-full shadow-sm">
            {/* Subtle background pattern/overlay for premium feel */}
            <View className="absolute inset-0 bg-black/5" />
            <View className="absolute -right-20 -top-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <View className="absolute -left-20 -bottom-20 w-80 h-80 bg-black/10 rounded-full blur-3xl" />

            <View className="w-full max-w-2xl z-10">
              <Text className="text-white text-4xl lg:text-5xl font-extrabold mb-6 leading-tight shadow-sm">
                {title}
              </Text>
              <Text className="text-green-50 text-lg lg:text-xl mb-12 leading-relaxed opacity-95 font-medium">
                {subtitle}
              </Text>
              
              {/* Mockup Image Container */}
              <View className="w-full aspect-video rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/20 bg-white/10 p-2 transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                 <Image 
                   source={require('../assets/auth_dashboard_mockup.png')} 
                   className="w-full h-full rounded-2xl bg-white"
                   resizeMode="cover"
                 />
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
