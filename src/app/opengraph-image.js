import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

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
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#E8963D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 12h4l2-7 4 14 2-7h6"
                stroke="#10141C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ fontSize: 40, color: "#F6F4EE", letterSpacing: -0.5 }}>{SITE_NAME}</div>
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
