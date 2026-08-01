import { supabase } from './supabase';

export interface UserProfile {
  id?: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  backupEmail?: string;
  gender?: string;
  dob?: string;
  country?: string;
  city: string;
  language?: string;
  timeZone?: string;
  occupation: string;
  joinDate?: string;
  accountId?: string;
  isPremium?: boolean;
  avatarUrl: string;
  currencyCode?: string;
}

/**
 * Generates an initial profile object based on logged in user's email/metadata
 */
export function createEmptyProfile(userEmail?: string): UserProfile {
  const emailStr = userEmail || 'user@example.com';
  const namePart = emailStr.split('@')[0] || 'User';
  const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);

  return {
    firstName: capitalized,
    lastName: '',
    username: `@${namePart}`,
    email: emailStr,
    phone: '',
    backupEmail: '',
    gender: '',
    dob: '',
    country: '',
    city: '',
    language: 'English (US)',
    timeZone: 'UTC',
    occupation: '',
    joinDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    accountId: `ACC-${Math.floor(100000 + Math.random() * 900000)}`,
    isPremium: false,
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(capitalized)}&background=73f218&color=0f172a`,
    currencyCode: 'USD',
  };
}

export const defaultProfile = createEmptyProfile();

/**
 * Fetches user profile from Supabase profiles table, or constructs one from current auth session.
 */
export async function fetchUserProfile(userId?: string): Promise<UserProfile> {
  try {
    const userObj = (await supabase.auth.getUser()).data.user;
    const targetId = userId || userObj?.id;
    const fallback = createEmptyProfile(userObj?.email);

    if (!targetId) return fallback;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();

    if (error || !data) {
      return fallback;
    }

    return {
      id: data.id,
      firstName: data.first_name || fallback.firstName,
      lastName: data.last_name || fallback.lastName,
      username: data.username || fallback.username,
      email: data.email || fallback.email,
      phone: data.phone || fallback.phone,
      backupEmail: data.backup_email || fallback.backupEmail,
      gender: data.gender || fallback.gender,
      dob: data.dob || fallback.dob,
      country: data.country || fallback.country,
      city: data.city || fallback.city,
      language: data.language || fallback.language,
      timeZone: data.time_zone || fallback.timeZone,
      occupation: data.occupation || fallback.occupation,
      joinDate: data.join_date || fallback.joinDate,
      accountId: data.account_id || fallback.accountId,
      isPremium: data.is_premium ?? fallback.isPremium,
      avatarUrl: data.avatar_url || fallback.avatarUrl,
      currencyCode: data.currency_code || fallback.currencyCode,
    };
  } catch (e) {
    console.warn('Supabase fetchUserProfile fallback:', e);
    return createEmptyProfile();
  }
}

/**
 * Updates or inserts user profile details into Supabase.
 */
export async function updateUserProfile(updates: Partial<UserProfile>, userId?: string): Promise<boolean> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    const targetId = userId || user?.id;
    if (!targetId) return false;

    const payload: any = {
      id: targetId,
      updated_at: new Date().toISOString(),
    };

    if (updates.firstName !== undefined) payload.first_name = updates.firstName;
    if (updates.lastName !== undefined) payload.last_name = updates.lastName;
    if (updates.username !== undefined) payload.username = updates.username;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.city !== undefined) payload.city = updates.city;
    if (updates.country !== undefined) payload.country = updates.country;
    if (updates.occupation !== undefined) payload.occupation = updates.occupation;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
    if (updates.currencyCode !== undefined) payload.currency_code = updates.currencyCode;
    if (updates.backupEmail !== undefined) payload.backup_email = updates.backupEmail;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.dob !== undefined) payload.dob = updates.dob;
    if (updates.language !== undefined) payload.language = updates.language;
    if (updates.timeZone !== undefined) payload.time_zone = updates.timeZone;

    const { error } = await supabase.from('profiles').upsert(payload);
    if (error) {
      console.warn('Error updating profile in Supabase:', error.message);
      return false;
    }

    return true;
  } catch (e) {
    console.warn('Error in updateUserProfile:', e);
    return false;
  }
}
