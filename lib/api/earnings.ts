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
  payment_status?: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  platform_fee_amount?: number;
  payment_failed_reason?: string;
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
      payment_status,
      platform_fee_amount,
      payment_failed_reason,
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
    payment_status: item.payment_status,
    platform_fee_amount: item.platform_fee_amount ? parseFloat(item.platform_fee_amount.toString()) : undefined,
    payment_failed_reason: item.payment_failed_reason,
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

  console.log('Weekly Earnings - Week range:', {
    start: start.toISOString(),
    end: end.toISOString(),
    startLocal: start.toLocaleString(),
    endLocal: end.toLocaleString(),
    currentTime: new Date().toISOString(),
    currentTimeLocal: new Date().toLocaleString()
  });

  // Get current week earnings
  const { data: currentWeek, error: currentError } = await supabase
    .from('earnings')
    .select('amount, created_at')
    .eq('teen_id', user.id)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  console.log('Weekly Earnings - Found earnings:', currentWeek?.length || 0, 'records');

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
    // Use UTC for day boundaries to match Supabase storage
    const dayStart = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    ));
    const dayEnd = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23, 59, 59, 999
    ));

    const dayEarnings = (currentWeek || []).filter(e => {
      const earningDate = new Date(e.created_at);
      return earningDate >= dayStart && earningDate <= dayEnd;
    });

    const dayAmount = dayEarnings.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
    // Convert UTC date to local for display
    const localDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
    const dayName = localDate.toLocaleDateString('en-US', { weekday: 'short' });

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

// Neighbor Spending Interfaces
export interface NeighborSpendingSummary {
  total_spent: number;
  pending_spent: number;
  paid_spent: number;
  completed_gigs: number;
}

export interface NeighborSpendingRecord {
  id: string;
  gig_id: string;
  task_title: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  paid_at: string | null;
  teen_name?: string;
}

// Get spending summary for a neighbor
export async function getNeighborSpendingSummary(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<NeighborSpendingSummary> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  let query = supabase
    .from('earnings')
    .select(`
      amount,
      status,
      created_at,
      gigs!earnings_gig_id_fkey(poster_id)
    `);

  // Filter by poster_id through the join
  // We need to filter client-side since Supabase doesn't support filtering on joined tables easily
  const { data, error } = await query;

  if (error) throw error;

  // Filter by poster_id and date range client-side
  const filteredData = (data || []).filter((earning: any) => {
    if (earning.gigs?.poster_id !== user.id) return false;
    
    if (filters?.startDate) {
      const earningDate = new Date(earning.created_at);
      if (earningDate < new Date(filters.startDate)) return false;
    }
    
    if (filters?.endDate) {
      const earningDate = new Date(earning.created_at);
      if (earningDate > new Date(filters.endDate)) return false;
    }
    
    return true;
  });

  const summary: NeighborSpendingSummary = {
    total_spent: 0,
    pending_spent: 0,
    paid_spent: 0,
    completed_gigs: filteredData.length,
  };

  filteredData.forEach((earning: any) => {
    summary.total_spent += parseFloat(earning.amount.toString());
    if (earning.status === 'pending') {
      summary.pending_spent += parseFloat(earning.amount.toString());
    } else if (earning.status === 'paid') {
      summary.paid_spent += parseFloat(earning.amount.toString());
    }
  });

  return summary;
}

// Get spending history for a neighbor
export async function getNeighborSpendingHistory(filters?: {
  status?: 'pending' | 'paid' | 'cancelled';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<NeighborSpendingRecord[]> {
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
      payment_status,
      platform_fee_amount,
      payment_failed_reason,
      gigs!earnings_gig_id_fkey(id, title, poster_id),
      teen:users!earnings_teen_id_fkey(full_name)
    `);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  query = query.order('created_at', { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter by poster_id client-side and apply remaining filters
  const filteredData = (data || [])
    .filter((item: any) => item.gigs?.poster_id === user.id)
    .map((item: any) => ({
      id: item.id,
      gig_id: item.gig_id,
      task_title: item.gigs?.title || 'Unknown Gig',
      amount: parseFloat(item.amount.toString()),
      status: item.status,
      created_at: item.created_at,
      paid_at: item.paid_at,
      teen_name: item.teen?.full_name,
      payment_status: item.payment_status,
      platform_fee_amount: item.platform_fee_amount ? parseFloat(item.platform_fee_amount.toString()) : undefined,
      payment_failed_reason: item.payment_failed_reason,
    }));

  return filteredData;
}

