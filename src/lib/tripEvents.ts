import type { PostType } from '@/types/database';
import type { IconName } from '@/components/icons';

export interface TripEventDef {
  type: string;
  label: string;
  pushMessage: string;
  icon: IconName;
}

/**
 * Ordered event sequences by post type.
 * Only the actor (booker or poster) can trigger events.
 * Order matters — each event is offered sequentially.
 */
const EVENT_SEQUENCES: Record<string, TripEventDef[]> = {
  route_offer: [
    { type: 'en_route', label: 'En Route to Pickup', pushMessage: 'Your driver is en route', icon: 'navigation' },
    { type: 'arrived_pickup', label: 'Arrived at Pickup', pushMessage: 'Driver arrived at pickup', icon: 'map-pin' },
    { type: 'departed', label: 'Trip Started', pushMessage: 'Trip has started', icon: 'compass' },
    { type: 'arrived_destination', label: 'Arrived at Destination', pushMessage: "You've arrived!", icon: 'map-pin' },
  ],
  route_request: [
    { type: 'driver_confirmed', label: 'Driver Confirmed', pushMessage: 'Your driver confirmed', icon: 'user' },
    { type: 'en_route', label: 'En Route to Pickup', pushMessage: 'Driver is on the way', icon: 'navigation' },
    { type: 'arrived_pickup', label: 'Arrived at Pickup', pushMessage: 'Driver at pickup', icon: 'map-pin' },
    { type: 'departed', label: 'Trip Started', pushMessage: 'Trip has started', icon: 'compass' },
    { type: 'arrived_destination', label: 'Arrived', pushMessage: 'Arrived at destination', icon: 'map-pin' },
  ],
  errand: [
    { type: 'accepted_errand', label: 'Errand Accepted', pushMessage: 'Helper accepted your errand', icon: 'clipboard-list' },
    { type: 'en_route', label: 'En Route', pushMessage: 'Helper is on the way', icon: 'navigation' },
    { type: 'arrived_location', label: 'Arrived at Location', pushMessage: 'Helper arrived', icon: 'map-pin' },
    { type: 'picked_up', label: 'Picked Up', pushMessage: 'Item picked up!', icon: 'package' },
    { type: 'returning', label: 'Returning', pushMessage: 'Helper is returning', icon: 'navigation' },
    { type: 'delivered', label: 'Delivered', pushMessage: 'Delivered!', icon: 'map-pin' },
  ],
  package: [
    { type: 'picked_up', label: 'Package Picked Up', pushMessage: 'Package picked up', icon: 'package' },
    { type: 'en_route', label: 'En Route', pushMessage: 'Driver en route', icon: 'navigation' },
    { type: 'arrived_destination', label: 'Arrived at Destination', pushMessage: 'Driver arrived', icon: 'map-pin' },
    { type: 'delivered', label: 'Package Delivered', pushMessage: 'Package delivered!', icon: 'package' },
  ],
  job: [
    { type: 'checked_in', label: 'Checked In', pushMessage: 'Worker checked in', icon: 'user' },
    { type: 'started_work', label: 'Work Started', pushMessage: 'Work started', icon: 'clock' },
    { type: 'completed_work', label: 'Work Completed', pushMessage: 'Work completed', icon: 'star' },
  ],
};

/** Get the ordered event definitions for a post type */
export function getEventSequence(postType: PostType): TripEventDef[] {
  return EVENT_SEQUENCES[postType] ?? [];
}

/** Get the human-readable label for an event type */
export function getEventLabel(eventType: string): string {
  for (const seq of Object.values(EVENT_SEQUENCES)) {
    const found = seq.find((e) => e.type === eventType);
    if (found) return found.label;
  }
  // Fallback: convert snake_case to Title Case
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Get the icon name for an event type */
export function getEventIcon(eventType: string): IconName {
  for (const seq of Object.values(EVENT_SEQUENCES)) {
    const found = seq.find((e) => e.type === eventType);
    if (found) return found.icon;
  }
  return 'circle-dot';
}

/**
 * Determine the next available action based on completed events.
 * Returns null if all events are done (trip should be marked complete).
 */
export function getNextEvent(
  postType: PostType,
  completedEventTypes: string[],
): TripEventDef | null {
  const sequence = getEventSequence(postType);
  const completedSet = new Set(completedEventTypes);

  for (const eventDef of sequence) {
    if (!completedSet.has(eventDef.type)) {
      return eventDef;
    }
  }

  return null; // All events completed
}

/** Check if all events in the sequence have been completed */
export function isSequenceComplete(postType: PostType, completedEventTypes: string[]): boolean {
  return getNextEvent(postType, completedEventTypes) === null;
}
