import { google, calendar_v3 } from 'googleapis';
import { GoogleOAuthService } from './GoogleOAuthService';

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  isAllDay: boolean;
  location?: string;
  meetingLink?: string;
  conferenceData?: {
    provider?: string;
    url?: string;
  };
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  error?: string;
}

/**
 * Google Calendar API client
 * Fetches upcoming calendar events
 */
export class GoogleCalendarClient {
  private oauthService: GoogleOAuthService;
  private calendar: calendar_v3.Calendar | null = null;

  constructor(oauthService: GoogleOAuthService) {
    this.oauthService = oauthService;
  }

  /**
   * Initialize OAuth2 client with credentials
   */
  private async initializeClient(): Promise<void> {
    const accessToken = await this.oauthService.getValidAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Fetch upcoming calendar events
   * @param maxResults Maximum number of events to return (default: 10)
   * @param timeWindowDays Number of days to look ahead (default: 7)
   */
  async getUpcomingEvents(
    maxResults: number = 10,
    timeWindowDays: number = 7
  ): Promise<CalendarEventsResponse> {
    try {
      await this.initializeClient();

      if (!this.calendar) {
        return { events: [], error: 'Calendar client not initialized' };
      }

      const now = new Date();
      const timeMax = new Date(now.getTime() + timeWindowDays * 24 * 60 * 60 * 1000);

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const items = response.data.items || [];

      // Filter out cancelled events and map to our CalendarEvent interface
      const events: CalendarEvent[] = items
        .filter((item) => item.status !== 'cancelled')
        .map((item) => this.mapToCalendarEvent(item))
        .filter((event): event is CalendarEvent => event !== null);

      return { events };
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      
      // Check if it's an auth error
      if (error instanceof Error && error.message.includes('invalid_grant')) {
        return { events: [], error: 'Authentication expired. Please reconnect.' };
      }

      return {
        events: [],
        error: error instanceof Error ? error.message : 'Failed to fetch calendar events',
      };
    }
  }

  /**
   * Map Google Calendar event to our CalendarEvent interface
   */
  private mapToCalendarEvent(item: calendar_v3.Schema$Event): CalendarEvent | null {
    // Skip if no start time
    if (!item.start) {
      return null;
    }

    const isAllDay = !!(item.start.date && !item.start.dateTime);
    const startTime = item.start.dateTime || item.start.date || '';
    const endTime = item.end?.dateTime || item.end?.date || '';

    if (!startTime || !endTime) {
      return null;
    }

    // Extract meeting link
    const meetingLink = this.extractMeetingLink(item);

    // Extract conference data
    const conferenceData = item.conferenceData
      ? {
          provider: item.conferenceData.conferenceSolution?.name || undefined,
          url: item.conferenceData.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri || undefined,
        }
      : undefined;

    return {
      id: item.id || '',
      title: item.summary || '(No title)',
      startTime,
      endTime,
      isAllDay,
      location: item.location || undefined,
      meetingLink: meetingLink || conferenceData?.url || undefined,
      conferenceData,
      status: (item.status as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
    };
  }

  /**
   * Extract meeting link from event
   * Checks hangoutLink, conferenceData, location, and description
   */
  private extractMeetingLink(item: calendar_v3.Schema$Event): string | undefined {
    // Google Meet link
    if (item.hangoutLink) {
      return item.hangoutLink;
    }

    // Conference data
    if (item.conferenceData?.entryPoints) {
      const videoEntry = item.conferenceData.entryPoints.find(
        (ep) => ep.entryPointType === 'video'
      );
      if (videoEntry?.uri) {
        return videoEntry.uri;
      }
    }

    // Check location for meeting links
    if (item.location) {
      const urlMatch = item.location.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        return urlMatch[1];
      }
    }

    // Check description for common meeting links
    if (item.description) {
      const meetingLinkPatterns = [
        /https:\/\/meet\.google\.com\/[a-z-]+/i,
        /https:\/\/zoom\.us\/[^\s]+/i,
        /https:\/\/.*\.zoom\.us\/[^\s]+/i,
        /https:\/\/teams\.microsoft\.com\/[^\s]+/i,
        /https:\/\/.*\.webex\.com\/[^\s]+/i,
      ];

      for (const pattern of meetingLinkPatterns) {
        const match = item.description.match(pattern);
        if (match) {
          return match[0];
        }
      }
    }

    return undefined;
  }

  /**
   * Check if client is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return this.oauthService.isAuthenticated();
  }
}
