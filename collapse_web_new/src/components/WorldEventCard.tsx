import React, { useState } from "react";
import { WorldEvent } from "../domain/worldEvents";

interface Props {
  event: WorldEvent;
  selected: boolean;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export const WorldEventCard: React.FC<Props> = ({ event, selected, onSelect, disabled }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: selected ? "2px solid var(--accent-collapse)" : "1px solid var(--border)",
        borderRadius: 12,
        margin: "8px 0",
        background: selected ? "var(--surface)" : "var(--surface)",
        color: "var(--text)",
        padding: 12,
        boxShadow: selected ? "0 0 8px var(--accent-collapse)" : "none",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
        position: "relative"
      }}
      onClick={() => !disabled && onSelect(event.id)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{event.name}</h3>
        {selected && (
          <span style={{
            display: "inline-block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--accent-influence)",
            marginLeft: 4,
            border: "2px solid var(--text)"
          }} title="Selected"></span>
        )}
      </div>
      <button
        style={{ fontSize: 12, marginTop: 4, background: "var(--surface-solid)", color: "var(--accent-influence)", border: "1px solid var(--accent-influence)", borderRadius: 4, padding: "2px 8px" }}
        onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
      >
        {expanded ? "Hide Details" : "Show Details"}
      </button>
      {expanded && (
        <div style={{ marginTop: 8 }}>
          <p>{event.description}</p>
          <ul>
            {event.effects.map((eff, i) => (
              <li key={i}>
                <strong>{eff.meter}:</strong> {eff.change > 0 ? "+" : ""}{eff.change}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
