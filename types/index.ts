export enum UserRole {
  TEEN = 'teen',
  POSTER = 'poster',
  PARENT = 'parent',
  ADMIN = 'admin'
}

export enum TaskStatus {
  OPEN = 'open',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  bio?: string;
  profile_photo_url?: string;
  parent_id?: string;
  parent_email?: string;
  skills?: string[];
  availability?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  verified: boolean;
  application_status?: 'pending' | 'approved' | 'rejected' | 'active';
  expo_push_token?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  pay: number;
  status: TaskStatus;
  poster_id: string;
  teen_id?: string;
  location: { latitude: number; longitude: number };
  address: string;
  required_skills?: string[];
  estimated_hours?: number;
  photos?: string[];
  scheduled_date?: string; // ISO date string (YYYY-MM-DD)
  scheduled_start_time?: string; // 24-hour format (HH:MM)
  scheduled_end_time?: string; // 24-hour format (HH:MM)
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  gig_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

// StripeAccount interface removed - no longer using Stripe Connect Express accounts
// Keeping for reference during migration period
// export interface StripeAccount {
//   id: string;
//   user_id: string;
//   stripe_account_id: string;
//   onboarding_status: 'pending' | 'in_progress' | 'complete' | 'failed';
//   charges_enabled: boolean;
//   payouts_enabled: boolean;
//   email?: string;
//   created_at: string;
//   updated_at: string;
// }

export interface PaymentMethod {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  stripe_customer_id?: string;
  type: 'card' | 'bank_account' | 'us_bank_account';
  is_default: boolean;
  card_brand?: string;
  card_last4?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  bank_name?: string;
  bank_last4?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret?: string;
}

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

