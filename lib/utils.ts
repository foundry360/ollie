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

// Format address to standard format: address on first line, city state zip on second line
export function formatAddress(address: string): { street: string; cityStateZip: string } {
  if (!address) {
    return { street: '', cityStateZip: '' };
  }

  // First, normalize the address to ensure it has commas
  const normalizedAddress = normalizeAddress(address);

  // Split by comma and trim each part
  const parts = normalizedAddress.split(',').map(p => p.trim()).filter(p => p);
  
  if (parts.length >= 3) {
    // Format: "Street, City, State Zip" or "Street, City, State, Zip"
    const street = parts[0];
    const city = parts[1];
    // Combine remaining parts (state and zip, which might be separate)
    const stateZip = parts.slice(2).join(' ').trim();
    return { street, cityStateZip: `${city}, ${stateZip}` };
  } else if (parts.length === 2) {
    // Format: "Street, City State Zip"
    const street = parts[0];
    const cityStateZip = parts[1];
    return { street, cityStateZip };
  } else if (parts.length === 1) {
    // Single part address - try to split intelligently
    const addressStr = parts[0];
    
    // Try to find a zip code (5 digits) and work backwards
    const zipMatch = addressStr.match(/\b(\d{5}(?:-\d{4})?)\b/);
    if (zipMatch) {
      const zipIndex = zipMatch.index!;
      const zip = zipMatch[1];
      const beforeZip = addressStr.substring(0, zipIndex).trim();
      
      // Look for state abbreviation (2 uppercase letters) before zip
      const stateMatch = beforeZip.match(/\b([A-Z]{2})\s*$/);
      if (stateMatch) {
        const stateIndex = stateMatch.index!;
        const state = stateMatch[1];
        const beforeState = beforeZip.substring(0, stateIndex).trim();
        
        // Find the last word before state (likely the city)
        const words = beforeState.split(/\s+/);
        if (words.length > 1) {
          const city = words[words.length - 1];
          const street = beforeState.substring(0, beforeState.lastIndexOf(city)).trim();
          return { 
            street: street || addressStr, 
            cityStateZip: `${city}, ${state} ${zip}` 
          };
        }
      }
      
      // If we found zip but couldn't parse state, try to split at common street suffixes
      const streetSuffixPattern = /\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl|Way|Circle|Cir)\b/i;
      const suffixMatch = beforeZip.match(streetSuffixPattern);
      if (suffixMatch) {
        const suffixEnd = suffixMatch.index! + suffixMatch[0].length;
        const street = addressStr.substring(0, suffixEnd).trim();
        const cityStateZip = addressStr.substring(suffixEnd, zipIndex + zip.length).trim();
        return { street, cityStateZip: `${cityStateZip} ${zip}` };
      }
    }
    
    // Fallback: look for street suffix and split there
    const streetSuffixPattern = /\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl|Way|Circle|Cir)\b/i;
    const suffixMatch = addressStr.match(streetSuffixPattern);
    if (suffixMatch) {
      const suffixEnd = suffixMatch.index! + suffixMatch[0].length;
      const street = addressStr.substring(0, suffixEnd).trim();
      const cityStateZip = addressStr.substring(suffixEnd).trim();
      if (cityStateZip) {
        return { street, cityStateZip };
      }
    }
    
    // Last resort: return entire address as street
    return { street: addressStr, cityStateZip: '' };
  } else {
    // Single part - try to intelligently split
    // Look for zip code pattern (5 digits) and work backwards
    const zipMatch = address.match(/\b(\d{5})\b/);
    if (zipMatch) {
      const zipIndex = zipMatch.index!;
      const afterZip = address.substring(zipIndex + 5).trim();
      const zip = zipMatch[1];
      const beforeZip = address.substring(0, zipIndex).trim();
      
      // Try to find state abbreviation (2 uppercase letters) before zip
      const stateMatch = beforeZip.match(/\b([A-Z]{2})\s*$/);
      if (stateMatch) {
        const stateIndex = stateMatch.index!;
        const city = beforeZip.substring(0, stateIndex).trim();
        const state = stateMatch[1];
        // Find where the street address ends (look for last occurrence of city)
        const cityIndex = address.lastIndexOf(city);
        if (cityIndex > 0) {
          const street = address.substring(0, cityIndex).trim().replace(/,\s*$/, '');
          return { street, cityStateZip: `${city}, ${state} ${zip}` };
        }
      }
      
      // If we found zip but no clear state, try to split at common street suffixes
      const streetSuffixPattern = /\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl|Way|Circle|Cir)\b/i;
      const suffixMatch = beforeZip.match(streetSuffixPattern);
      if (suffixMatch) {
        const suffixEnd = suffixMatch.index! + suffixMatch[0].length;
        const street = address.substring(0, suffixEnd).trim();
        const cityStateZip = address.substring(suffixEnd, zipIndex + 5).trim();
        return { street, cityStateZip };
      }
    }
    
    // Fallback: look for street suffix and split there
    const streetSuffixPattern = /\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl|Way|Circle|Cir)\b/i;
    const suffixMatch = address.match(streetSuffixPattern);
    if (suffixMatch) {
      const suffixEnd = suffixMatch.index! + suffixMatch[0].length;
      const street = address.substring(0, suffixEnd).trim();
      const cityStateZip = address.substring(suffixEnd).trim();
      if (cityStateZip) {
        return { street, cityStateZip };
      }
    }
    
    // Last resort: return entire address as street
    return { street: address, cityStateZip: '' };
  }
}

// Normalize address format to ensure it has commas: "Street, City, State Zip"
export function normalizeAddress(address: string): string {
  if (!address) return '';
  
  // If address already has commas, return as is (assuming it's properly formatted)
  if (address.includes(',')) {
    return address;
  }
  
  // Try to parse and reformat address without commas
  // Look for zip code pattern (5 digits)
  const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b/);
  if (zipMatch) {
    const zipIndex = zipMatch.index!;
    const zip = zipMatch[1];
    const beforeZip = address.substring(0, zipIndex).trim();
    
    // Look for state abbreviation (2 uppercase letters) before zip
    const stateMatch = beforeZip.match(/\b([A-Z]{2})\s*$/);
    if (stateMatch) {
      const stateIndex = stateMatch.index!;
      const state = stateMatch[1];
      const beforeState = beforeZip.substring(0, stateIndex).trim();
      
      // Find the last word before state (likely the city)
      const words = beforeState.split(/\s+/);
      if (words.length > 1) {
        const city = words[words.length - 1];
        const street = beforeState.substring(0, beforeState.lastIndexOf(city)).trim();
        if (street) {
          return `${street}, ${city}, ${state} ${zip}`;
        } else {
          return `${beforeState}, ${state} ${zip}`;
        }
      }
    }
    
    // If we found zip but couldn't parse properly, try to split at common street suffixes
    const streetSuffixPattern = /\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl|Way|Circle|Cir)\b/i;
    const suffixMatch = beforeZip.match(streetSuffixPattern);
    if (suffixMatch) {
      const suffixEnd = suffixMatch.index! + suffixMatch[0].length;
      const street = address.substring(0, suffixEnd).trim();
      const cityStateZip = address.substring(suffixEnd, zipIndex + zip.length).trim();
      return `${street}, ${cityStateZip} ${zip}`;
    }
  }
  
  // If we can't parse it, return as is (user will need to format manually)
  return address;
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
  const { start } = getWeekRange(); // Use UTC-based week range
  const monday = new Date(start);
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate() + i,
      0, 0, 0, 0
    ));
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

// Get start and end of current week (Monday to Sunday) in UTC
export function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  // Get current date in UTC
  const utcNow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  ));
  
  const day = utcNow.getUTCDay();
  const diff = utcNow.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(
    utcNow.getUTCFullYear(),
    utcNow.getUTCMonth(),
    diff,
    0, 0, 0, 0
  ));
  
  const sunday = new Date(Date.UTC(
    monday.getUTCFullYear(),
    monday.getUTCMonth(),
    monday.getUTCDate() + 6,
    23, 59, 59, 999
  ));
  
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

