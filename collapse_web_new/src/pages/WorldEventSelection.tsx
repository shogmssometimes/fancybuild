import React, { useMemo } from "react";
import { SocialMatrix } from "../components/SocialMatrix";
import { WorldEventCard } from "../components/WorldEventCard";
import { Meters } from "../domain/meters";
import { WorldEvent } from "../domain/worldEvents";
import { worldEvents } from "../data/worldEvents";
import { UserRole } from "../components/RoleSelectLanding";

const initialMeters: Meters = {
  trust: 0,
  distrust: 0,
  surveillance: 0,
  carteBlanche: 0,
  influence: 0,
  record: 0,
  collapse: 0,
};

function applyEventEffects(selectedIds: string[], events: WorldEvent[]): Meters {
  const meters = { ...initialMeters };
  selectedIds.forEach(id => {
    const event = events.find(e => e.id === id);
    if (event) {
      event.effects.forEach(eff => {
        meters[eff.meter] += eff.change;
      });
    }
  });
  return meters;
}

interface WorldEventSelectionProps {
  mode: UserRole;
  selectedEventIds: string[];
  onSelectionChange: (ids: string[]) => void;
  readOnly?: boolean;
}

export const WorldEventSelection: React.FC<WorldEventSelectionProps> = ({ mode, selectedEventIds, onSelectionChange, readOnly }) => {
  const meters = useMemo(() => applyEventEffects(selectedEventIds, worldEvents), [selectedEventIds]);

  const handleSelect = (id: string) => {
    if (readOnly) return;
    onSelectionChange(
      selectedEventIds.includes(id)
        ? selectedEventIds.filter((value) => value !== id)
        : [...selectedEventIds, id]
    );
  };

  return (
    <div>
      <h2>World Events</h2>
      {readOnly && (
        <p style={{ maxWidth: 600 }}>
          These are read-only in player mode. Your GM will let you know which events are active for this campaign.
        </p>
      )}
      {worldEvents.map(event => (
        <WorldEventCard
          key={event.id}
          event={event}
          selected={selectedEventIds.includes(event.id)}
          onSelect={handleSelect}
          disabled={readOnly}
        />
      ))}
      <h2>Social Matrix & Meters</h2>
      <SocialMatrix meters={meters} />
      <div style={{ marginTop: 24 }}>
        <h3>{mode === "gm" ? "Selected Events Summary" : "GM-Selected World Events"}</h3>
        {selectedEventIds.length === 0 ? (
          <p>{mode === "gm" ? "No events selected." : "Waiting for GM selections."}</p>
        ) : (
          selectedEventIds.map(id => {
            const event = worldEvents.find(e => e.id === id);
            return (
              <div key={id} style={{ marginBottom: 12 }}>
                <strong>{event?.name}</strong>
                <p>{event?.description}</p>
                  <ul>
                    {event?.effects.map((eff: { meter: string; change: number }, i: number) => (
                      <li key={i}>
                        <strong>{eff.meter}:</strong> {eff.change > 0 ? "+" : ""}{eff.change}
                      </li>
                    ))}
                  </ul>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
