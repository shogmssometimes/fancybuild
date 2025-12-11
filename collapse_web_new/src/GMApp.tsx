import React, { useMemo } from "react";
import DeckBuilder from "./pages/DeckBuilder";
import { Card } from "./domain/decks/DeckEngine";

// GM-only shell for local builds. Keeps the player experience untouched and stores
// data under a separate localStorage key so existing decks remain intact.
const GMShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="gm-shell" style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
    <header className="topbar">
      <div className="topbar-title">
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          Collapse GM Companion
        </div>
        <strong>Local GM Build</strong>
      </div>
      <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: "0.9rem", textAlign: "right" }}>
        Player companion is unchanged. GM data is stored separately from player decks.
      </div>
    </header>
    {children}
  </div>
);

export default function GMApp() {
  const gmBaseCards = useMemo<Card[]>(() => [{
    id: "gm-base-1",
    name: "Base",
    type: "Base",
  }], [])

  const gmModCards = useMemo<Card[]>(() => [{
    id: "gm-mod-1",
    name: "Mod",
    type: "Modifier",
    cost: 1,
  }], [])

  const gmNullCard = useMemo<Card>(() => ({
    id: "gm-null",
    name: "Null",
    type: "Null",
  }), [])

  return (
    <GMShell>
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem 1rem 2rem" }}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "1rem 1.25rem",
            marginBottom: "1.25rem",
          }}
        >
          <h2 style={{ margin: "0 0 0.35rem 0" }}>GM-Only Companion</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            This build is meant for local GM use only. It runs offline, avoids the player shell, and uses its own
            storage namespace so existing player data stays intact.
          </p>
        </div>
        <DeckBuilder
          storageKey="collapse.deck-builder.gm.v1"
          exportPrefix="collapse-gm-deck"
          baseCardsOverride={gmBaseCards}
          modCardsOverride={gmModCards}
          nullCardOverride={gmNullCard}
          baseTarget={15}
          minNulls={5}
          modifierCapacityDefault={10}
          showCardDetails={false}
          simpleCounters={true}
          modCapacityAsCount={true}
          showOpsSections={false}
          showModifierCards={true}
          showModifierCapacity={false}
          showBaseCounters={true}
        />
      </section>
    </GMShell>
  );
}
