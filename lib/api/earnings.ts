import { supabase } from '@/lib/supabase';
import { getWeekRange, getPreviousWeekRange, getWeekDates } from '@/lib/utils';

export interface EarningsSummary {
  total_earnings: number;
  pending_earnings: number;
  paid_earnings: number;
  completed_tasks: number;
}

export interface EarningsRecord {
  id: string;
  gig_id: string;
  task_title: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  paid_at: string | null;
}

// Get earnings summary for a teen
export async function getEarningsSummary(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<EarningsSummary> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  let query = supabase
    .from('earnings')
    .select('amount, status')
    .eq('teen_id', user.id);

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;

  const summary: EarningsSummary = {
    total_earnings: 0,
    pending_earnings: 0,
    paid_earnings: 0,
    completed_tasks: data?.length || 0,
  };

  data?.forEach((earning) => {
    summary.total_earnings += parseFloat(earning.amount.toString());
    if (earning.status === 'pending') {
      summary.pending_earnings += parseFloat(earning.amount.toString());
    } else if (earning.status === 'paid') {
      summary.paid_earnings += parseFloat(earning.amount.toString());
    }
  });

  return summary;
}

// Get earnings history
export async function getEarningsHistory(filters?: {
  status?: 'pending' | 'paid' | 'cancelled';
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  limit?: number;
  offset?: number;
}): Promise<EarningsRecord[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  let query = supabase
    .from('earnings')
    .select(`
      id,
      gig_id,
      amount,
      status,
      created_at,
      paid_at,
      gigs(id, title)
    `)
    .eq('teen_id', user.id)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    gig_id: item.gig_id,
    task_title: item.gigs?.title || 'Unknown Task',
    amount: parseFloat(item.amount.toString()),
    status: item.status,
    created_at: item.created_at,
    paid_at: item.paid_at,
  }));
}

// Get weekly earnings with day-by-day breakdown
export interface WeeklyEarningsData {
  total: number;
  taskCount: number;
  dailyBreakdown: Array<{ date: Date; amount: number; dayName: string }>;
  previousWeekTotal: number;
  percentageChange: number;
}

export async function getWeeklyEarnings(): Promise<WeeklyEarningsData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { start, end } = getWeekRange();
  const { start: prevStart, end: prevEnd } = getPreviousWeekRange();

  // Get current week earnings
  const { data: currentWeek, error: currentError } = await supabase
    .from('earnings')
    .select('amount, created_at')
    .eq('teen_id', user.id)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (currentError) throw currentError;

  // Get previous week earnings for comparison
  const { data: previousWeek, error: prevError } = await supabase
    .from('earnings')
    .select('amount')
    .eq('teen_id', user.id)
    .gte('created_at', prevStart.toISOString())
    .lte('created_at', prevEnd.toISOString());

  if (prevError) throw prevError;

  // Calculate daily breakdown
  const weekDates = getWeekDates();
  const dailyBreakdown = weekDates.map(date => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayEarnings = (currentWeek || []).filter(e => {
      const earningDate = new Date(e.created_at);
      return earningDate >= dayStart && earningDate <= dayEnd;
    });

    const dayAmount = dayEarnings.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

    return {
      date,
      amount: dayAmount,
      dayName,
    };
  });

  const total = (currentWeek || []).reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
  const taskCount = currentWeek?.length || 0;
  const previousWeekTotal = (previousWeek || []).reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
  
  const percentageChange = previousWeekTotal > 0
    ? ((total - previousWeekTotal) / previousWeekTotal) * 100
    : total > 0 ? 100 : 0;

  return {
    total,
    taskCount,
    dailyBreakdown,
    previousWeekTotal,
    percentageChange: Math.round(percentageChange * 10) / 10, // Round to 1 decimal
  };
}

