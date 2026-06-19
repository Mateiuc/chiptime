export const formatDuration = (seconds: number): string => {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Cost for a single period: round to nearest minute, then round up to dollar
export const calcPeriodCost = (seconds: number, hourlyRate: number): number => {
  const minutes = Math.round(seconds / 60); // round to nearest minute
  return Math.ceil((minutes / 60) * hourlyRate); // round up to next dollar
};

export const formatTime = (date: Date | string): string => {
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '00:00';
  }
  
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dateObj);
};

export const formatTimeForInput = (date: Date | string): string => {
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '00:00';
  }
  
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
};


export const formatDateForInput = (date: Date | string): string => {
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});
const timeOnlyFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', hour12: true,
});

export const formatSessionRange = (start?: Date | string, end?: Date | string): string => {
  if (!start) return '';
  const s = start instanceof Date ? start : new Date(start);
  if (isNaN(s.getTime())) return '';
  const startStr = dateTimeFmt.format(s);
  if (!end) return `${startStr} → …`;
  const e = end instanceof Date ? end : new Date(end);
  if (isNaN(e.getTime())) return `${startStr} → …`;
  const sameDay = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
  return `${startStr} → ${sameDay ? timeOnlyFmt.format(e) : dateTimeFmt.format(e)}`;
};
