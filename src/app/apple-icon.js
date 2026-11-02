import { ImageResponse } from "next/og";

// Apple touch icons must be a raster image, so this draws the same mark the
// site uses (see LogoMark in components/icons.js) at the size iOS wants.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E8963D",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 12h4l2-7 4 14 2-7h6"
            stroke="#10141C"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
