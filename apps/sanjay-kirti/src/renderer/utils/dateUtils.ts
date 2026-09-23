/**
 * Format event time for display
 */
export function formatEventTime(
  startTime: string,
  endTime: string,
  isAllDay: boolean
): string {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isAllDay) {
    return formatDate(start);
  }

  const startDate = formatDate(start);
  const startTimeStr = formatTime(start);
  const endTimeStr = formatTime(end);

  // Same day
  if (isSameDay(start, end)) {
    return `${startDate}, ${startTimeStr} - ${endTimeStr}`;
  }

  // Different days
  const endDate = formatDate(end);
  return `${startDate} ${startTimeStr} - ${endDate} ${endTimeStr}`;
}

/**
 * Get human-readable time until event
 */
export function getTimeUntilEvent(startTime: string): string | null {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();

  // Event has passed
  if (diffMs < 0) {
    return 'Now';
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Starting now';
  } else if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
  } else if (diffHours < 24) {
    return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  } else if (diffDays === 1) {
    return 'tomorrow';
  } else if (diffDays < 7) {
    return `in ${diffDays} days`;
  } else {
    return formatDate(start);
  }
}

/**
 * Format duration between two times
 */
export function formatDuration(startTime: string, endTime: string): string | null {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();

  if (diffMs <= 0) {
    return null;
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;

  if (diffHours === 0) {
    return `${diffMinutes} min`;
  } else if (remainingMinutes === 0) {
    return `${diffHours} hr`;
  } else {
    return `${diffHours} hr ${remainingMinutes} min`;
  }
}

/**
 * Format recording duration in seconds
 */
export function formatRecordingDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
}

/**
 * Format date as "Mon, Jan 1"
 */
function formatDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(date, today)) {
    return 'Today';
  } else if (isSameDay(date, tomorrow)) {
    return 'Tomorrow';
  }

  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();

  return `${dayOfWeek}, ${month} ${day}`;
}

/**
 * Format time as "2:30 PM"
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
