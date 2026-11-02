import { ImageResponse } from "next/og";
import { OgLogo } from "@/components/og-card";

export const alt =
  "YaadiGo — group tours and customized trips, India and abroad";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#10141C",
          padding: 72,
        }}
      >
        <div style={{ display: "flex" }}>
          <OgLogo />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 62,
              color: "#F6F4EE",
              lineHeight: 1.15,
              letterSpacing: -1.5,
              maxWidth: 900,
            }}
          >
            Travel together, or travel your way.
          </div>
          <div style={{ fontSize: 28, color: "#9BA3B0", maxWidth: 820 }}>
            Small-group departures on fixed dates, or a private trip built around
            yours. Every itinerary written down before you pay.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 40, height: 4, background: "#E8963D", borderRadius: 2 }} />
          <div style={{ fontSize: 24, color: "#6E7686" }}>yaadigo.com</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
