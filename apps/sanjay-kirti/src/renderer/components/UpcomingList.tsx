import React from 'react';
import type { CalendarEvent } from '../../preload/index';
import { formatEventTime } from '../utils/dateUtils';

interface UpcomingListProps {
  events: CalendarEvent[];
}

/**
 * List of upcoming events after the next meeting
 */
export function UpcomingList({ events }: UpcomingListProps): JSX.Element {
  return (
    <div className="upcoming-list">
      <h2 className="section-title">Upcoming</h2>
      <div className="upcoming-events">
        {events.map((event) => (
          <UpcomingEventItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

interface UpcomingEventItemProps {
  event: CalendarEvent;
}

function UpcomingEventItem({ event }: UpcomingEventItemProps): JSX.Element {
  const formattedTime = formatEventTime(event.startTime, event.endTime, event.isAllDay);

  return (
    <div className="upcoming-event-item">
      <div className="event-time-badge">
        <div className="event-time">{formattedTime}</div>
      </div>
      <div className="event-content">
        <h3 className="event-title">{event.title}</h3>
        <div className="event-meta">
          {event.meetingLink && (
            <button
              className="event-meeting-link"
              onClick={() => {
                if (event.meetingLink) {
                  window.open(event.meetingLink, '_blank');
                }
              }}
              title="Join meeting"
            >
              🎥 Join
            </button>
          )}
          {event.location && !event.meetingLink && (
            <span className="event-location" title={event.location}>
              📍 {event.location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
