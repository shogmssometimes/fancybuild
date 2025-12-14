import React, { useEffect, useMemo, useState } from "react";
import DeckBuilder from "./pages/DeckBuilder";
import { Card } from "./domain/decks/DeckEngine";

type Mode = "player" | "gm";
type Route = "hub" | "player" | "player-ops" | "gm" | "gm-ops" | "chud" | "csmatrix";

const MODE_KEY = "collapse.mode";
const buildPath = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const deriveRoute = (): Route => {
  if (typeof window === "undefined") return "hub";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [segment, sub] = hash.split(/[\/?]/);
  if (segment === "player") {
    if (sub === "ops") return "player-ops";
    return "player";
  }
  if (segment === "gm") {
    if (sub === "ops") return "gm-ops";
    return "gm";
  }
  if (segment === "chud") return "chud";
  if (segment === "csmatrix") return "csmatrix";
  return "hub";
};

const deriveMode = (): Mode => {
  if (typeof window === "undefined") return "player";
  const saved = window.localStorage.getItem(MODE_KEY) as Mode | null;
  const route = deriveRoute();
  if (route === "gm" || route === "gm-ops") return "gm";
  if (route === "player" || route === "player-ops" || route === "chud" || route === "csmatrix") return "player";
  return saved ?? "player";
};

const SubAppFrame: React.FC<{ title: string; src: string; onBack: () => void; note?: string }> = ({
  title,
  src,
  onBack,
  note,
}) => (
  <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <header className="topbar">
      <button className="ghost-btn" onClick={onBack}>← Back to hub</button>
      <div className="topbar-title">
        <div className="muted" style={{ fontSize: "0.85rem" }}>Collapse Full Build</div>
        <strong>{title}</strong>
      </div>
    </header>
    <div className="subapp-frame">
      <iframe
        title={title}
        src={src}
        style={{ border: "none" }}
        allow="fullscreen"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock"
      />
    </div>
  </main>
);

const PlayerShell: React.FC<{ onBack: () => void; children: React.ReactNode; chudDock?: React.ReactNode }> = ({ onBack, children, chudDock }) => {
  const openChud = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("chud-open"));
  };
  return (
  <div className="player-shell" style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
    <header className="topbar">
      <button className="ghost-btn" onClick={onBack} aria-label="Back to hub">
        ← Back to hub
      </button>
      <div className="topbar-title">
        <div className="muted" style={{ fontSize: "0.85rem" }}>Collapse Full Build</div>
        <strong>Collapse Companion</strong>
      </div>
      <div className="topbar-actions">
        <button className="chud-top-btn" onClick={openChud} aria-label="Open cHUD overlay">cHUD</button>
      </div>
    </header>
    {chudDock}
    {children}
  </div>
  );
};

const GMShell: React.FC<{ onBack: () => void; children: React.ReactNode; chudDock?: React.ReactNode }> = ({ onBack, children, chudDock }) => {
  const openChud = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("chud-open"));
  };
  return (
  <div className="gm-shell" style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
    <header className="topbar">
      <button className="ghost-btn" onClick={onBack} aria-label="Back to hub">
        ← Back to hub
      </button>
      <div className="topbar-title">
        <div className="muted" style={{ fontSize: "0.85rem" }}>Collapse GM Companion</div>
        <strong>GM Tools</strong>
      </div>
      <div className="topbar-actions">
        <button className="chud-top-btn" onClick={openChud} aria-label="Open cHUD overlay">cHUD</button>
      </div>
    </header>
    {chudDock}
    {children}
  </div>
  );
};

const CompanionIntro: React.FC<{ eyebrow: string; title: string; description: string; helper?: string }> = ({
  eyebrow,
  title,
  description,
  helper,
}) => (
  <div className="page">
    <div className="page-header">
      <div>
        <div className="muted" style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {eyebrow}
        </div>
        <h1 style={{ margin: "0.15rem 0 0.35rem 0" }}>{title}</h1>
        <p className="muted" style={{ margin: 0 }}>{description}</p>
      </div>
      {helper && (
        <div className="muted text-body" style={{ maxWidth: 320, textAlign: "right" }}>
          {helper}
        </div>
      )}
    </div>
  </div>
);

const ChudDock: React.FC<{ basePath: string }> = ({ basePath }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("chud-open", handler as EventListener);
    return () => window.removeEventListener("chud-open", handler as EventListener);
  }, []);
  return (
    <>
      <button className="chud-fab" onClick={() => setOpen(true)} aria-label="Open cHUD overlay">
        cHUD
      </button>
      {open && (
        <div className="chud-overlay" role="dialog" aria-modal="true" aria-label="cHUD overlay">
          <div className="chud-sheet">
            <div className="chud-sheet-header">
              <span>cHUD</span>
              <button className="chud-close" onClick={() => setOpen(false)} aria-label="Close cHUD">✕</button>
            </div>
            <div className="chud-sheet-body">
              <iframe
                title="cHUD"
                src={`${basePath}chud/index.html`}
                allow="fullscreen"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const HubLanding: React.FC<{
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onNavigate: (route: Route) => void;
}> = ({ mode, onModeChange, onNavigate }) => {
  const cards = useMemo(() => {
    const base = [
      {
        id: "player" as Route,
        title: "Companion — Player",
        description: "Player-facing tools with deck builder and ops.",
        cta: "Open Player Companion",
        subtitle: "Player",
      },
      {
        id: "player-ops" as Route,
        title: "Deck Ops — Player",
        description: "Standalone deck operations for the player deck.",
        cta: "Open Player Deck Ops",
        subtitle: "Player",
      },
      {
        id: "gm" as Route,
        title: "Companion — GM",
        description: "GM-only deck tools with pure counts.",
        cta: "Open GM Companion",
        subtitle: "GM",
      },
      {
        id: "gm-ops" as Route,
        title: "Deck Ops — GM",
        description: "Standalone deck operations for the GM deck.",
        cta: "Open GM Deck Ops",
        subtitle: "GM",
      },
      {
        id: "csmatrix" as Route,
        title: "CS Matrix",
        description: "Campaign Support Matrix with draggable nodes.",
        cta: "Open CS Matrix",
        subtitle: "Player",
      },
      {
        id: "chud" as Route,
        title: "cHUD",
        description: "Compact HUD for derived stats.",
        cta: "Open cHUD",
        subtitle: "Player",
      },
    ];
    return base.filter((c) => {
      if (mode === "gm") return c.subtitle === "GM";
      return c.subtitle === "Player";
    });
  }, [mode]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "min(1100px, 100%)", padding: "1.25rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 0.35rem 0" }}>Collapse Full Build</h1>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Choose a mode to open the companion and deck ops independently.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Mode:</span>
            <button
              className={`mode-toggle ${mode === "player" ? "active" : ""}`}
              onClick={() => onModeChange("player")}
              aria-pressed={mode === "player"}
            >
              Player
            </button>
            <button
              className={`mode-toggle ${mode === "gm" ? "active" : ""}`}
              onClick={() => onModeChange("gm")}
              aria-pressed={mode === "gm"}
            >
              GM
            </button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginTop: "1.1rem",
          }}
        >
          {cards.map((card) => (
            <div
              key={card.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: "1rem",
                background: "var(--surface)",
                minHeight: 180,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <h2 style={{ margin: 0 }}>{card.title}</h2>
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{card.subtitle}</span>
                </div>
                <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>{card.description}</p>
              </div>
              <button onClick={() => onNavigate(card.id)}>{card.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => deriveRoute());
  const [mode, setMode] = useState<Mode>(() => deriveMode());

  const chudDock = route !== "chud" ? <ChudDock basePath={buildPath("")} /> : null;

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = deriveRoute();
      setRoute(nextRoute);
      if (nextRoute === "gm" || nextRoute === "gm-ops") {
        setMode("gm");
      } else if (nextRoute === "player" || nextRoute === "player-ops") {
        setMode("player");
      } else {
        const stored = (typeof window !== "undefined"
          ? (window.localStorage.getItem(MODE_KEY) as Mode | null)
          : null);
        if (stored) setMode(stored);
      }
    };
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const desiredHash = (() => {
      switch (route) {
        case "player":
          return "#/player";
        case "player-ops":
          return "#/player/ops";
        case "gm":
          return "#/gm";
        case "gm-ops":
          return "#/gm/ops";
        case "chud":
          return "#/chud";
        case "csmatrix":
          return "#/csmatrix";
        default:
          return "#/hub";
      }
    })();
    if (window.location.hash !== desiredHash) {
      window.location.hash = desiredHash;
    }
  }, [route]);

  // GM deck overrides (simple counts)
  const gmBaseCards = useMemo<Card[]>(() => [{ id: "gm-base-1", name: "Base", type: "Base" }], []);
  const gmModCards = useMemo<Card[]>(() => [{ id: "gm-mod-1", name: "Mod", type: "Modifier", cost: 1 }], []);
  const gmNullCard = useMemo<Card>(() => ({ id: "gm-null", name: "Null", type: "Null" }), []);

  if (route === "player") {
    return (
      <PlayerShell onBack={() => setRoute("hub")} chudDock={chudDock}>
        <DeckBuilder
          showOpsSections={false}
          showModifierCards={true}
          showModifierCardCounter={false}
          showModifierCapacity={true}
          showBaseCounters={true}
          showBaseAdjusters={false}
        />
      </PlayerShell>
    );
  }

  if (route === "player-ops") {
    return (
      <PlayerShell onBack={() => setRoute("hub")} chudDock={chudDock}>
        <DeckBuilder
          storageKey="collapse.deck-builder.v2"
          showBuilderSections={false}
          showOpsSections={true}
        />
      </PlayerShell>
    );
  }

  if (route === "gm") {
    return (
      <GMShell onBack={() => setRoute("hub")} chudDock={chudDock}>
        <CompanionIntro
          eyebrow="GM Companion"
          title="GM Deck & Table Tools"
          description="Pure-count GM deck controls with offline storage, separate from player data."
          helper="Use this to prep encounters, lock decks, and keep the GM pool isolated."
        />
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
        />
      </GMShell>
    );
  }

  if (route === "gm-ops") {
    return (
      <GMShell onBack={() => setRoute("hub")} chudDock={chudDock}>
        <CompanionIntro
          eyebrow="GM Deck Ops"
          title="Operational View"
          description="Minimal deck operations for live sessions, keeping the GM pool locked and quick to reach."
          helper="Builder sections stay hidden; use the dock to draw, shuffle, and manage discard."
        />
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
          showBuilderSections={false}
          showOpsSections={true}
        />
      </GMShell>
    );
  }

  if (route === "chud") {
    return (
      <SubAppFrame
        title="cHUD — Compact HUD"
        src={`${buildPath("")}chud/index.html`}
        onBack={() => setRoute("hub")}
        note="Loaded inside the fullbuild shell."
      />
    );
  }

  if (route === "csmatrix") {
    return (
      <SubAppFrame
        title="CS Matrix"
        src={buildPath("csmatrix/index.html")}
        onBack={() => setRoute("hub")}
        note="Campaign Support Matrix (in-app iframe)."
      />
    );
  }

  return (
    <>
      {chudDock}
      <HubLanding
        mode={mode}
        onModeChange={(next) => {
          setMode(next);
          setRoute("hub");
        }}
        onNavigate={(next) => {
          setRoute(next);
          setMode(next === "gm" || next === "gm-ops" ? "gm" : "player");
        }}
      />
    </>
  );
}
