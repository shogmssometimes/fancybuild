import React, { useEffect, useMemo, useState } from "react";
import RoleSelectLanding, { UserRole } from "./components/RoleSelectLanding";
import DeckBuilder from "./pages/DeckBuilder";

type Route = "hub" | "cvttweb" | "chud" | "csmatrix" | "gm";

const buildPath = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const deriveRoute = (): Route => {
  if (typeof window === "undefined") return "hub";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [segment] = hash.split(/[/?]/);
  if (segment === "cvttweb") return "cvttweb";
  if (segment === "chud") return "chud";
  if (segment === "csmatrix") return "csmatrix";
  if (segment === "gm") return "gm";
  if (window.location.pathname.includes("/cvttweb")) return "cvttweb";
  return "hub";
};

const deriveRole = (): UserRole | null => {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [, roleSegment] = hash.split("/");
  if (roleSegment === "player" || roleSegment === "gm") return roleSegment;
  return null;
};

const SubAppFrame: React.FC<{ title: string; src: string; onBack: () => void; note?: string }> = ({
  title,
  src,
  onBack,
  note,
}) => {
  return (
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
};

const CompanionShell: React.FC<{ onBack: () => void; children: React.ReactNode }> = ({ onBack, children }) => (
  <div style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
    <header className="topbar">
      <button className="ghost-btn" onClick={onBack} aria-label="Back to hub">
        ← Back to hub
      </button>
      <div className="topbar-title">
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          Collapse Full Build
        </div>
        <strong>Collapse Companion</strong>
      </div>
    </header>
    {children}
  </div>
);

const ChudDock: React.FC<{ basePath: string }> = ({ basePath }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`chud-dock ${open ? "open" : ""}`}>
      <button className="chud-dock-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide cHUD" : "Show cHUD"}
      </button>
      {open && (
        <div className="chud-dock-frame">
          <iframe
            title="cHUD"
            src={`${basePath}chud/`}
            allow="fullscreen"
            sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock"
          />
        </div>
      )}
    </div>
  );
};

const HubLanding: React.FC<{ onNavigate: (route: Route, presetRole?: UserRole) => void }> = ({ onNavigate }) => {
  const cardStyles: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "1rem",
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
      title: "Companion — Player",
      description: "Player-facing tools with read-only world events and the deck builder.",
      cta: "Enter Player Mode",
      subtitle: "In-app",
      role: "player" as UserRole,
    },
    {
      id: "gm" as Route,
      title: "Companion — GM (Standalone)",
      description: "GM-only deck tools (pure counts). Player app remains unchanged.",
      cta: "Launch GM Companion",
      subtitle: "Standalone",
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
      <div
        style={{
          width: "min(1100px, 100%)",
          padding: "1.25rem 1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 0.35rem 0" }}>Collapse Full Build</h1>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Launch any build directly. Each experience runs inside this PWA and stays offline once loaded.
            </p>
          </div>
          <span style={{ color: "var(--muted)", fontSize: "0.95rem" }}>{buildPath("")}</span>
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
            <div key={card.id} style={cardStyles}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <h2 style={{ margin: 0 }}>{card.title}</h2>
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{card.subtitle}</span>
                </div>
                <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>{card.description}</p>
              </div>
              <button onClick={() => onNavigate(card.id, card.role)}>{card.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => deriveRoute());
  const [role, setRole] = useState<UserRole | null>(() => deriveRole());

  const chudDock = route !== "chud" ? <ChudDock basePath={buildPath("")} /> : null;

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
    const syncRoute = () => {
      setRoute(deriveRoute());
      const hashRole = deriveRole();
      if (hashRole) setRole(hashRole);
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
    const desiredHash = route === "cvttweb" && role ? `#/${route}/${role}` : `#/${route}`;
    if (window.location.hash !== desiredHash) {
      window.location.hash = desiredHash;
    }
  }, [route, role]);

  if (route === "gm") {
    return (
      <SubAppFrame
        title="Companion — GM"
        src={buildPath("gm.html")}
        onBack={() => setRoute("hub")}
        note="GM-only view; player app remains unchanged."
      />
    );
  }

  if (route === "cvttweb") {
    if (!role) {
      return <RoleSelectLanding onSelect={setRole} />;
    }
    return (
      <CompanionShell onBack={() => setRoute("hub")}>
        {chudDock}
        <DeckBuilder />
      </CompanionShell>
    );
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
      <>
        {chudDock}
        <SubAppFrame
          title={subApps.csmatrix.title}
          src={subApps.csmatrix.src}
          note={subApps.csmatrix.note}
          onBack={() => setRoute("hub")}
        />
      </>
    );
  }

  return (
    <>
      {chudDock}
      <HubLanding
        onNavigate={(next, presetRole) => {
          if (presetRole) setRole(presetRole);
          setRoute(next);
        }}
      />
    </>
  );
}
