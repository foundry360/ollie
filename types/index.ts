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

