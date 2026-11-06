import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// ImageResponse renders this embedded image directly; next/image is not supported here.
/* eslint-disable @next/next/no-img-element */
export const alt = "Tamark Solar Energy — solar solutions and practical training";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public", "solar-leaf-energy-emblem.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    <div style={{
      display: "flex", width: "100%", height: "100%", alignItems: "center", gap: 48,
      padding: "72px", color: "white", background: "linear-gradient(125deg,#08181a 0%,#102a2a 58%,#0f5a40 115%)",
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{ display: "flex", width: 220, height: 220, padding: 14, borderRadius: 38, background: "white" }}>
        <img src={logoSrc} width="192" height="192" alt="" style={{ objectFit: "contain" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
        <div style={{ color: "#f4bd45", fontSize: 24, fontWeight: 700, letterSpacing: 5 }}>TAMARK SOLAR ENERGY</div>
        <div style={{ marginTop: 26, fontSize: 60, fontWeight: 800, lineHeight: 1.12 }}>Powering tomorrow with clean energy.</div>
        <div style={{ marginTop: 26, color: "#c3dad0", fontSize: 28 }}>Solar solutions and practical technical training</div>
      </div>
    </div>,
    size,
  );
}
