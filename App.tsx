import './global.css';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { ActivityIndicator, View, TouchableOpacity, Text, Dimensions, StyleSheet } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

// Screens
import { LoginScreen } from './screens/auth/LoginScreen';
import { SignUpScreen } from './screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from './screens/auth/ForgotPasswordScreen';
import { UpdatePasswordScreen } from './screens/auth/UpdatePasswordScreen';
import { DashboardScreen } from './screens/main/DashboardScreen';
import { WalletScreen } from './screens/main/WalletScreen';
import { ActivityScreen } from './screens/main/ActivityScreen';
import { ProfileScreen } from './screens/main/ProfileScreen';
import { BudgetDetailScreen } from './screens/main/BudgetDetailScreen';
import { SavingsGoalDetailScreen } from './screens/main/SavingsGoalDetailScreen';
import { UpcomingPaymentDetailScreen } from './screens/main/UpcomingPaymentDetailScreen';
import { AllTransactionsScreen } from './screens/main/AllTransactionsScreen';
import { AllSavingsGoalsScreen } from './screens/main/AllSavingsGoalsScreen';
import { AllUpcomingPaymentsScreen } from './screens/main/AllUpcomingPaymentsScreen';
import { BudgetCategoryDetailScreen } from './screens/main/BudgetCategoryDetailScreen';
import { IncomeDetailScreen } from './screens/main/IncomeDetailScreen';
import { RecurringDetailScreen } from './screens/main/RecurringDetailScreen';
import { AnalyticReportScreen } from './screens/main/AnalyticReportScreen';
import { BudgetScreen } from './screens/main/BudgetScreen';
import { Ionicons } from '@expo/vector-icons';
import { CurrencyProvider } from './context/CurrencyContext';
import { GoalProvider } from './context/GoalContext';
import { TransactionProvider } from './context/TransactionContext';
import { AccountProvider } from './context/AccountContext';
import { BillProvider } from './context/BillContext';


const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabBarIcon = ({ isFocused, options, label }: any) => {
  const translateY = useSharedValue(isFocused ? -22 : 0);

  React.useEffect(() => {
    translateY.value = withSpring(isFocused ? -22 : 0, {
      damping: 15,
      stiffness: 120,
    });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }));

  return (
    <Animated.View style={[animatedStyle, { alignItems: 'center', justifyContent: 'center' }]}>
      {options.tabBarIcon ? options.tabBarIcon({ focused: isFocused }) : null}
      {!isFocused && (
        <Text style={{
          color: '#9ca3af',
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        }}>
          {label}
        </Text>
      )}
    </Animated.View>
  );
};

const AnimatedTabBar = ({ state, descriptors, navigation }: any) => {
  const { width } = Dimensions.get('window');
  // We filter out any routes that might be hidden, but we assume all routes in state.routes are visible.
  const TAB_WIDTH = width / state.routes.length;
  
  const targetX = useSharedValue((state.index * TAB_WIDTH) + (TAB_WIDTH / 2));

  React.useEffect(() => {
    targetX.value = withSpring((state.index * TAB_WIDTH) + (TAB_WIDTH / 2), {
      damping: 15,
      stiffness: 120,
    });
  }, [state.index]);

  const animatedCircleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: targetX.value }]
    };
  });

  const animatedSvgStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: targetX.value - (width / 2) }]
    };
  });

  return (
    <View style={styles.tabBarContainer}>
      {/* Sliding Cutout SVG Background */}
      <Animated.View style={[styles.svgContainer, animatedSvgStyle, { left: -width, width: width * 3 }]}>
        <Svg width={width * 3} height={60} viewBox={`0 0 ${width * 3} 60`}>
           <Path 
              d={`M 0 0 L ${width*1.5 - 42} 0 C ${width*1.5 - 28} 0 ${width*1.5 - 28} 38 ${width*1.5} 38 C ${width*1.5 + 28} 38 ${width*1.5 + 28} 0 ${width*1.5 + 42} 0 L ${width*3} 0 L ${width*3} 60 L 0 60 Z`}
              fill="#ffffff"
              stroke="#f3f4f6"
              strokeWidth="1.5"
           />
        </Svg>
      </Animated.View>

      {/* Sliding Purple Circle */}
      <Animated.View style={[styles.purpleCircle, animatedCircleStyle]} />

      {/* Static Tabs Row */}
      <View style={styles.tabsRow}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={1}
              style={{ width: TAB_WIDTH, height: 60, alignItems: 'center', justifyContent: 'center' }}
            >
              <TabBarIcon isFocused={isFocused} options={options} label={route.name} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator 
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ 
        headerShown: false, 
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={DashboardScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={focused ? '#ffffff' : '#9ca3af'} />
          )
        }}
      />
      <Tab.Screen 
        name="Wallet" 
        component={WalletScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={24} color={focused ? '#ffffff' : '#9ca3af'} />
          )
        }}
      />
      <Tab.Screen 
        name="Budget" 
        component={BudgetScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={24} color={focused ? '#ffffff' : '#9ca3af'} />
          )
        }}
      />
      <Tab.Screen 
        name="Activity" 
        component={ActivityScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'analytics' : 'analytics-outline'} size={24} color={focused ? '#ffffff' : '#9ca3af'} />
          )
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={focused ? '#ffffff' : '#9ca3af'} />
          )
        }}
      />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="BudgetDetail"
        component={BudgetDetailScreen}
        options={{
          presentation: 'containedModal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BudgetCategoryDetail"
        component={BudgetCategoryDetailScreen}
        options={{
          presentation: 'containedModal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="IncomeDetail"
        component={IncomeDetailScreen}
        options={{
          presentation: 'containedModal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="RecurringDetail"
        component={RecurringDetailScreen}
        options={{
          presentation: 'containedModal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SavingsGoalDetail"
        component={SavingsGoalDetailScreen}
        options={{
          presentation: 'containedModal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="UpcomingPaymentDetail"
        component={UpcomingPaymentDetailScreen}
        options={{
          presentation: 'containedModal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AllTransactions"
        component={AllTransactionsScreen}
        options={{ animation: 'slide_from_right', headerShown: false }}
      />
      <Stack.Screen
        name="AllSavingsGoals"
        component={AllSavingsGoalsScreen}
        options={{ animation: 'slide_from_right', headerShown: false }}
      />
      <Stack.Screen
        name="AllUpcomingPayments"
        component={AllUpcomingPaymentsScreen}
        options={{ animation: 'slide_from_right', headerShown: false }}
      />
      <Stack.Screen
        name="AnalyticReport"
        component={AnalyticReportScreen}
        options={{ animation: 'slide_from_right', headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);

  let [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    // Web fallback: Check if URL hash contains recovery token on load
    if (typeof window !== 'undefined' && window.location?.hash?.includes('type=recovery')) {
      setIsRecovering(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      // Handle Deep Linking recovery events
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovering(true);
      } else if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        // Once they update the password (or sign out), exit recovery mode
        setIsRecovering(false);
      }
    });
  }, []);

  if (loading || !fontsLoaded) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#73f218" />
      </View>
    );
  }

  // Special Route if the user clicked a password reset link in their email
  if (isRecovering) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="UpdatePassword" component={UpdatePasswordScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <CurrencyProvider>
      <GoalProvider>
        <TransactionProvider>
          <AccountProvider>
            <BillProvider>
              <NavigationContainer>
                {session && session.user ? <MainStack /> : <AuthStack />}
              </NavigationContainer>
            </BillProvider>
          </AccountProvider>
        </TransactionProvider>
      </GoalProvider>
    </CurrencyProvider>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    height: 60,
  },
  purpleCircle: {
    position: 'absolute',
    top: -16,       // Sits above the bar by 16px
    left: -24,      // Half of circle width (48/2)
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#73f218',
    shadowColor: '#73f218',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 5,
  },
  tabsRow: {
    flexDirection: 'row',
    height: 60,
    zIndex: 10,
  }
});
