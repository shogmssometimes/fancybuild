import React from "react";
import { Meters } from "../domain/meters";
import socialMatrixSvg from "../assets/social_matrix.svg";

interface Props {
  meters: Meters;
}

const getMatrixPosition = (meters: Meters) => {
  // Center is (300, 300) in SVG, each tick is 40px, range -5 to +5 for each axis
  // Trust increases left, Distrust increases right, Surveillance up, Carte Blanche down
  const x = 300 - meters.trust * 40 + meters.distrust * 40;
  const y = 300 - meters.surveillance * 40 + meters.carteBlanche * 40;
  return { x, y };
};

export const SocialMatrix: React.FC<Props> = ({ meters }) => {
  const { x, y } = getMatrixPosition(meters);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 400 }}>
      <img src={socialMatrixSvg} alt="Social Matrix" style={{ width: "100%" }} />
      {/* Marker */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          width: "100%",
          height: "100%",
        }}
        viewBox="0 0 600 600"
      >
        <circle cx={x} cy={y} r={12} fill="var(--accent-influence)" stroke="var(--text)" strokeWidth={3} />
      </svg>
      {/* Meter values */}
      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12 }}>
        {Object.entries(meters).map(([key, value]) => (
          <div key={key} style={{ fontSize: 16 }}>
            <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {value}
          </div>
        ))}
      </div>
    </div>
  );
};
