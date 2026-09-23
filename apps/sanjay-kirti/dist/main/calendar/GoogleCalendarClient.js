"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCalendarClient = void 0;
const googleapis_1 = require("googleapis");
/**
 * Google Calendar API client
 * Fetches upcoming calendar events
 */
class GoogleCalendarClient {
    constructor(oauthService) {
        this.calendar = null;
        this.oauthService = oauthService;
    }
    /**
     * Initialize OAuth2 client with credentials
     */
    async initializeClient() {
        const accessToken = await this.oauthService.getValidAccessToken();
        if (!accessToken) {
            throw new Error('Not authenticated');
        }
        const oauth2Client = new googleapis_1.google.auth.OAuth2();
        oauth2Client.setCredentials({
            access_token: accessToken,
        });
        this.calendar = googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
    }
    /**
     * Fetch upcoming calendar events
     * @param maxResults Maximum number of events to return (default: 10)
     * @param timeWindowDays Number of days to look ahead (default: 7)
     */
    async getUpcomingEvents(maxResults = 10, timeWindowDays = 7) {
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
            const events = items
                .filter((item) => item.status !== 'cancelled')
                .map((item) => this.mapToCalendarEvent(item))
                .filter((event) => event !== null);
            return { events };
        }
        catch (error) {
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
    mapToCalendarEvent(item) {
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
            status: item.status || 'confirmed',
        };
    }
    /**
     * Extract meeting link from event
     * Checks hangoutLink, conferenceData, location, and description
     */
    extractMeetingLink(item) {
        // Google Meet link
        if (item.hangoutLink) {
            return item.hangoutLink;
        }
        // Conference data
        if (item.conferenceData?.entryPoints) {
            const videoEntry = item.conferenceData.entryPoints.find((ep) => ep.entryPointType === 'video');
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
    async isAuthenticated() {
        return this.oauthService.isAuthenticated();
    }
}
exports.GoogleCalendarClient = GoogleCalendarClient;
