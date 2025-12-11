import React from "react";

export type UserRole = "player" | "gm";

interface RoleConfig {
  id: UserRole;
  title: string;
  description: string;
}

const ROLES: RoleConfig[] = [
  {
    id: "player",
    title: "Player Mode",
    description: "Guided experience with read-only world events and your personal engram deck builder.",
  },
  {
    id: "gm",
    title: "GM Mode",
    description: "Unlock world events, editable social matrix, and the deck builder for campaign prep.",
  },
];

interface RoleSelectLandingProps {
  onSelect: (role: UserRole) => void;
}

const tileStyles: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: "1.25rem",
  background: "var(--surface)",
  minHeight: 160,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const RoleSelectLanding: React.FC<RoleSelectLandingProps> = ({ onSelect }) => {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "min(960px, 100%)", padding: "2rem" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Collapse Companion</h1>
        <p style={{ marginBottom: "2rem", color: "var(--muted)" }}>
          Pick a role to continue. You can switch later without losing progress.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
          {ROLES.map((role) => (
            <div key={role.id} style={tileStyles}>
              <div>
                <h2 style={{ margin: 0 }}>{role.title}</h2>
                <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>{role.description}</p>
              </div>
              <button onClick={() => onSelect(role.id)}>Enter {role.id === "gm" ? "GM" : "Player"} Mode</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};

export default RoleSelectLanding;
