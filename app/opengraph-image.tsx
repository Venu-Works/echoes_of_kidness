import { ImageResponse } from "next/og";

export const alt = "Heart Witness — Some moments deserve to be remembered";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "#FAF7F2", color: "#44332D", borderBottom: "18px solid #B76550" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "22px", color: "#B76550", fontSize: 32 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="21" fill="#B76550" /><path d="M32 23C23 13 12 24 21 33L32 44L43 33C52 24 41 13 32 23Z" fill="#FFF8ED" /><path d="M15 39C22 38 28 41 32 47C36 41 42 38 49 39M32 36V47" stroke="#FFF8ED" strokeWidth="2.5" strokeLinecap="round" /></svg>
        Heart Witness
      </div>
      <div style={{ display: "flex", marginTop: 42, fontSize: 66, lineHeight: 1.15, maxWidth: 950 }}>Some moments deserve to be remembered.</div>
      <div style={{ display: "flex", marginTop: 32, fontSize: 26, color: "#75675F" }}>Real stories of love, respect, gratitude, and kindness.</div>
    </div>,
    size
  );
}
