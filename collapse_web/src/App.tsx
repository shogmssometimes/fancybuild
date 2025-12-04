import React, { useEffect, useMemo, useState } from "react";
import RoleSelectLanding, { UserRole } from "./components/RoleSelectLanding";
import DeckBuilder from "./pages/DeckBuilder";

type Route = "hub" | "cvttweb" | "chud" | "csmatrix";

const buildPath = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const deriveRoute = (): Route => {
  if (typeof window === "undefined") return "hub";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const segment = hash.split(/[/?]/)[0];
  if (segment === "cvttweb") return "cvttweb";
  if (segment === "chud") return "chud";
  if (segment === "csmatrix") return "csmatrix";
  if (window.location.pathname.includes("/cvttweb")) return "cvttweb";
  return "hub";
};

const SubAppFrame: React.FC<{ title: string; src: string; onBack: () => void; note?: string }> = ({
  title,
  src,
  onBack,
  note,
}) => {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          {note ? <p style={{ margin: 0, color: "var(--muted)" }}>{note}</p> : null}
        </div>
        <button onClick={onBack}>← Back to hub</button>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <iframe
          title={title}
          src={src}
          style={{ border: "none", width: "100%", height: "100%" }}
          allow="fullscreen"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock"
        />
      </div>
    </main>
  );
};

const HubLanding: React.FC<{ onNavigate: (route: Route) => void }> = ({ onNavigate }) => {
  const cardStyles: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "1.25rem",
    background: "var(--surface)",
    minHeight: 180,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: "0.75rem",
  };

  const cards = [
    {
      id: "cvttweb" as Route,
      title: "Collapse Companion",
      description: "Player and GM tools (world events, deck builder, engram ops) with offline PWA support.",
      cta: "Open Companion",
      subtitle: "In-app",
    },
    {
      id: "chud" as Route,
      title: "cHUD",
      description: "Compact HUD for derived stats; keep it alongside your session.",
      cta: "Open cHUD",
      subtitle: "In-app",
    },
    {
      id: "csmatrix" as Route,
      title: "CS Matrix",
      description: "Campaign Support Matrix with draggable nodes, meters, and node drawers.",
      cta: "Open CS Matrix",
      subtitle: "In-app",
    },
  ];

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "min(1100px, 100%)", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 0.35rem 0" }}>Collapse Full Build</h1>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Launch any build directly. Each experience runs inside this PWA and stays offline once loaded.
            </p>
          </div>
          <span style={{ color: "var(--muted)", fontSize: "0.95rem" }}>{buildPath("")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
          {cards.map((card) => (
            <div key={card.id} style={cardStyles}>
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
  const [role, setRole] = useState<UserRole | null>(null);

  const subApps = useMemo(
    () => ({
      chud: {
        title: "cHUD — Compact HUD",
        src: buildPath("chud/"),
        note: "Loaded inside the fullbuild shell.",
      },
      csmatrix: {
        title: "CS Matrix",
        src: buildPath("csmatrix/"),
        note: "Campaign Support Matrix (in-app iframe).",
      },
    }),
    []
  );

  useEffect(() => {
    const syncRoute = () => setRoute(deriveRoute());
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
    const desiredHash = `#/${route}`;
    if (window.location.hash !== desiredHash) {
      window.location.hash = desiredHash;
    }
  }, [route]);

  if (route === "cvttweb") {
    if (!role) {
      return <RoleSelectLanding onSelect={setRole} />;
    }
    return <DeckBuilder />;
  }

  if (route === "chud") {
    return (
      <SubAppFrame
        title={subApps.chud.title}
        src={subApps.chud.src}
        note={subApps.chud.note}
        onBack={() => setRoute("hub")}
      />
    );
  }

  if (route === "csmatrix") {
    return (
      <SubAppFrame
        title={subApps.csmatrix.title}
        src={subApps.csmatrix.src}
        note={subApps.csmatrix.note}
        onBack={() => setRoute("hub")}
      />
    );
  }

  return <HubLanding onNavigate={(next) => setRoute(next)} />;
}
