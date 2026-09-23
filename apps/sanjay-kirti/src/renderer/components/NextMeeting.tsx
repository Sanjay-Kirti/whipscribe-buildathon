import React from 'react';
import type { CalendarEvent } from '../../preload/index';
import { formatEventTime, getTimeUntilEvent, formatDuration } from '../utils/dateUtils';

interface NextMeetingProps {
  event: CalendarEvent;
}

/**
 * Next meeting card with visual priority
 */
export function NextMeeting({ event }: NextMeetingProps): JSX.Element {
  const timeUntil = getTimeUntilEvent(event.startTime);
  const duration = formatDuration(event.startTime, event.endTime);
  const formattedTime = formatEventTime(event.startTime, event.endTime, event.isAllDay);

  return (
    <div className="next-meeting">
      <div className="next-meeting-header">
        <h2 className="section-title">Next Meeting</h2>
        {timeUntil && <span className="time-until">{timeUntil}</span>}
      </div>

      <div className="next-meeting-card">
        <h3 className="meeting-title">{event.title}</h3>

        <div className="meeting-details">
          <div className="meeting-time">
            <span className="icon">🕐</span>
            <div className="time-info">
              <div className="time-primary">{formattedTime}</div>
              {!event.isAllDay && duration && (
                <div className="time-secondary">{duration}</div>
              )}
            </div>
          </div>

          {event.location && !event.meetingLink && (
            <div className="meeting-location">
              <span className="icon">📍</span>
              <span className="location-text">{event.location}</span>
            </div>
          )}

          {event.meetingLink && (
            <div className="meeting-link">
              <button
                className="btn-meeting-link"
                onClick={() => {
                  if (event.meetingLink) {
                    window.open(event.meetingLink, '_blank');
                  }
                }}
              >
                <span className="icon">🎥</span>
                <span className="link-text">Join Meeting</span>
              </button>
              {event.conferenceData?.provider && (
                <span className="provider-badge">{event.conferenceData.provider}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
