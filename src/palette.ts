// Flag-inspired palettes for common countries
export const flagPalette: Record<string, string[]> = {
  Finland: ["#003580", "#fff"],
  Denmark: ["#c60c30", "#fff"],
  Iceland: ["#003897", "#fff", "#d72828"],
  Sweden: ["#006aa7", "#fecc00"],
  Israel: ["#0038b8", "#fff"],
  Netherlands: ["#21468b", "#fff", "#ae1c28"],
  Norway: ["#ba0c2f", "#fff", "#00205b"],
  Luxembourg: ["#00a1de", "#fff", "#ed2939"],
  Switzerland: ["#d52b1e", "#fff"],
  Australia: ["#00247d", "#fff", "#e4002b"],
  "New Zealand": ["#00247d", "#fff", "#cc142b"],
  Canada: ["#ff0000", "#fff"],
  "United States": ["#3c3b6e", "#fff", "#b22234"],
  "United Kingdom": ["#00247d", "#fff", "#cf142b"],
  France: ["#0055a4", "#fff", "#ef4135"],
  Germany: ["#000", "#dd0000", "#ffce00"],
  Italy: ["#008c45", "#fff", "#cd212a"],
  Spain: ["#aa151b", "#f1bf00"],
  Japan: ["#fff", "#bc002d"],
  China: ["#de2910", "#ffde00"],
  India: ["#ff9933", "#fff", "#138808", "#000080"],
  Brazil: ["#009739", "#ffcc29", "#3e4095"],
  Russia: ["#fff", "#0039a6", "#d52b1e"],
};
export function fallbackPalette(name: string): string[] {
  // Deterministic fallback: hash name to HSL
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return [`hsl(${h},70%,55%)`, `hsl(${(h + 40) % 360},60%,40%)`, `hsl(${(h + 80) % 360},50%,30%)`];
}
