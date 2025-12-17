import { clsx } from 'clsx';

export function cn(...inputs: any[]) {
  return clsx(inputs);
}

// Calculate distance between two coordinates using Haversine formula (returns miles)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Get time-based greeting
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Format time ago (e.g., "2 hours ago", "30 minutes ago")
export function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
}

// Get array of dates for current week (Monday to Sunday)
export function getWeekDates(): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(today.setDate(diff));
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  
  return dates;
}

// Calculate progress percentage for active task
export function calculateProgressPercentage(
  startTime: string,
  estimatedHours?: number
): number {
  if (!estimatedHours) return 0;
  
  const start = new Date(startTime);
  const now = new Date();
  const elapsedHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
  const progress = Math.min((elapsedHours / estimatedHours) * 100, 100);
  return Math.max(0, Math.round(progress));
}

// Format date as "Mon", "Tue", etc.
export function getDayAbbreviation(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// Get start and end of current week (Monday to Sunday)
export function getWeekRange(): { start: Date; end: Date } {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
}

// Get start and end of previous week
export function getPreviousWeekRange(): { start: Date; end: Date } {
  const { start, end } = getWeekRange();
  const prevStart = new Date(start);
  prevStart.setDate(start.getDate() - 7);
  const prevEnd = new Date(end);
  prevEnd.setDate(end.getDate() - 7);
  return { start: prevStart, end: prevEnd };
}

