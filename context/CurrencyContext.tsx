import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { updateUserProfile } from '../lib/profileService';

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  flagUrl: string;
}

export interface CountryOption {
  code: string;
  name: string;
  flagUrl: string;
  currencyCode: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'RW', name: 'Rwanda', flagUrl: 'https://flagcdn.com/w40/rw.png', currencyCode: 'RWF' },
  { code: 'US', name: 'United States', flagUrl: 'https://flagcdn.com/w40/us.png', currencyCode: 'USD' },
  { code: 'GB', name: 'United Kingdom', flagUrl: 'https://flagcdn.com/w40/gb.png', currencyCode: 'GBP' },
  { code: 'DE', name: 'Germany', flagUrl: 'https://flagcdn.com/w40/de.png', currencyCode: 'EUR' },
  { code: 'FR', name: 'France', flagUrl: 'https://flagcdn.com/w40/fr.png', currencyCode: 'EUR' },
  { code: 'KE', name: 'Kenya', flagUrl: 'https://flagcdn.com/w40/ke.png', currencyCode: 'KES' },
  { code: 'UG', name: 'Uganda', flagUrl: 'https://flagcdn.com/w40/ug.png', currencyCode: 'UGX' },
  { code: 'TZ', name: 'Tanzania', flagUrl: 'https://flagcdn.com/w40/tz.png', currencyCode: 'TZS' },
  { code: 'CA', name: 'Canada', flagUrl: 'https://flagcdn.com/w40/ca.png', currencyCode: 'CAD' },
  { code: 'NG', name: 'Nigeria', flagUrl: 'https://flagcdn.com/w40/ng.png', currencyCode: 'NGN' },
  { code: 'ZA', name: 'South Africa', flagUrl: 'https://flagcdn.com/w40/za.png', currencyCode: 'ZAR' },
  { code: 'IN', name: 'India', flagUrl: 'https://flagcdn.com/w40/in.png', currencyCode: 'INR' },
];

export const CURRENCIES: CurrencyOption[] = [
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'RWF ', flagUrl: 'https://flagcdn.com/w40/rw.png' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flagUrl: 'https://flagcdn.com/w40/us.png' },
  { code: 'EUR', name: 'Euro', symbol: '€', flagUrl: 'https://flagcdn.com/w40/eu.png' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flagUrl: 'https://flagcdn.com/w40/gb.png' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh ', flagUrl: 'https://flagcdn.com/w40/ke.png' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh ', flagUrl: 'https://flagcdn.com/w40/ug.png' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh ', flagUrl: 'https://flagcdn.com/w40/tz.png' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flagUrl: 'https://flagcdn.com/w40/ca.png' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flagUrl: 'https://flagcdn.com/w40/ng.png' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R ', flagUrl: 'https://flagcdn.com/w40/za.png' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flagUrl: 'https://flagcdn.com/w40/in.png' },
];

export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  RWF: 1380.0,
  KES: 130.0,
  UGX: 3700.0,
  TZS: 2600.0,
  CAD: 1.36,
  NGN: 1500.0,
  ZAR: 18.5,
  INR: 83.5,
};

export const convertAmount = (
  amount: number,
  fromCode: string = 'USD',
  toCode: string = 'USD'
): number => {
  if (!amount || isNaN(amount)) return 0;
  const cleanFrom = (fromCode || '').includes('FRw') || (fromCode || '').includes('RWF') ? 'RWF'
                  : (fromCode || '').includes('KSh') || (fromCode || '').includes('KES') ? 'KES'
                  : (fromCode || '').includes('€') || (fromCode || '').includes('EUR') ? 'EUR'
                  : (fromCode || '').includes('£') || (fromCode || '').includes('GBP') ? 'GBP'
                  : (fromCode || '').includes('C$') || (fromCode || '').includes('CAD') ? 'CAD'
                  : 'USD';

  const cleanTo = (toCode || '').includes('FRw') || (toCode || '').includes('RWF') ? 'RWF'
                : (toCode || '').includes('KSh') || (toCode || '').includes('KES') ? 'KES'
                : (toCode || '').includes('€') || (toCode || '').includes('EUR') ? 'EUR'
                : (toCode || '').includes('£') || (toCode || '').includes('GBP') ? 'GBP'
                : (toCode || '').includes('C$') || (toCode || '').includes('CAD') ? 'CAD'
                : 'USD';

  const rateFrom = EXCHANGE_RATES[cleanFrom] || 1.0;
  const rateTo = EXCHANGE_RATES[cleanTo] || 1.0;

  const amountInUSD = amount / rateFrom;
  return amountInUSD * rateTo;
};

interface CurrencyContextType {
  currency: CurrencyOption;
  country: CountryOption;
  setCurrency: (curr: CurrencyOption) => Promise<void>;
  setCountryByName: (countryName: string) => Promise<void>;
  formatAmount: (amount: number, showSymbol?: boolean, fromCode?: string) => string;
  convertAmount: (amount: number, fromCode?: string, toCode?: string) => number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: CURRENCIES[0],
  country: COUNTRIES[0],
  setCurrency: async () => {},
  setCountryByName: async () => {},
  formatAmount: (amount: number) => `$${(amount || 0).toFixed(2)}`,
  convertAmount: (amount: number) => amount,
});

const CURRENCY_STORAGE_KEY = '@app_user_currency';
const COUNTRY_STORAGE_KEY = '@app_user_country';

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyOption>(CURRENCIES[0]);
  const [country, setCountryState] = useState<CountryOption>(COUNTRIES[0]);

  useEffect(() => {
    async function loadSavedData() {
      try {
        const savedCountry = await AsyncStorage.getItem(COUNTRY_STORAGE_KEY);
        if (savedCountry) {
          const parsed = JSON.parse(savedCountry);
          if (parsed && parsed.name) {
            const foundCountry = COUNTRIES.find(c => c.name.toLowerCase() === parsed.name.toLowerCase() || c.code === parsed.code) || parsed;
            setCountryState(foundCountry);
          }
        }

        const savedCurr = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
        if (savedCurr) {
          const parsed = JSON.parse(savedCurr);
          if (parsed && parsed.code) {
            const found = CURRENCIES.find(c => c.code === parsed.code) || parsed;
            setCurrencyState(found);
            return;
          }
        }

        // Check Supabase user profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('profiles').select('country, currency_code').eq('id', user.id).single();
          if (data) {
            if (data.country) {
              const matchedC = COUNTRIES.find(c => c.name.toLowerCase() === data.country.toLowerCase() || c.code.toLowerCase() === data.country.toLowerCase());
              if (matchedC) setCountryState(matchedC);
            }
            if (data.currency_code) {
              const found = CURRENCIES.find(c => c.code === data.currency_code);
              if (found) {
                setCurrencyState(found);
                await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(found));
              }
            }
          }
        }
      } catch (e) {
        console.warn('Error loading saved country/currency:', e);
      }
    }
    loadSavedData();
  }, []);

  const setCurrency = async (newCurr: CurrencyOption) => {
    setCurrencyState(newCurr);
    try {
      await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(newCurr));
      await updateUserProfile({ currencyCode: newCurr.code });
    } catch (e) {
      console.warn('Error saving currency:', e);
    }
  };

  const setCountryByName = async (countryName: string) => {
    const matched = COUNTRIES.find(c => c.name.toLowerCase() === countryName.toLowerCase() || c.code.toLowerCase() === countryName.toLowerCase()) || {
      code: 'CUSTOM',
      name: countryName,
      flagUrl: 'https://flagcdn.com/w40/un.png',
      currencyCode: 'USD',
    };

    setCountryState(matched);
    try {
      await AsyncStorage.setItem(COUNTRY_STORAGE_KEY, JSON.stringify(matched));

      // Auto-set mapped currency!
      const mappedCurrency = CURRENCIES.find(c => c.code === matched.currencyCode);
      if (mappedCurrency) {
        await setCurrency(mappedCurrency);
      }
      await updateUserProfile({ country: matched.name, currencyCode: mappedCurrency?.code || 'USD' });
    } catch (e) {
      console.warn('Error setting country by name:', e);
    }
  };

  const formatAmount = (amount: number, showSymbol: boolean = true, fromCode: string = 'USD'): string => {
    const num = Number(amount) || 0;
    const converted = convertAmount(num, fromCode, currency.code);
    const formattedNum = converted.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (!showSymbol) return formattedNum;
    return `${currency.symbol}${formattedNum}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, country, setCurrency, setCountryByName, formatAmount, convertAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
