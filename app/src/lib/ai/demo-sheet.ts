import sharp from 'sharp';

// Demo mode (no GEMINI_API_KEY): a plain placeholder in the character sheet's layout.
// Gray boxes and labels only, so no real person's image ever stands in for a generated sheet.
const W = 1200;
const H = 1600;

function box(x: number, y: number, w: number, h: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#DAD7D0"/>`;
}
function label(x: number, y: number, text: string, anchor = 'middle'): string {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial Narrow, Arial, sans-serif" font-size="30" letter-spacing="4" fill="#5D636A">${text}</text>`;
}

export function demoSheetSvg(): string {
  const pad = 24;
  const gap = 12;
  const colW = (W - pad * 2 - gap * 3) / 4;
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="#F3F2EE"/>`];

  parts.push(label(pad + colW / 2, 60, 'FRONT'), label(W - pad - colW / 2, 60, 'BACK'));
  for (let i = 0; i < 4; i++) parts.push(box(pad + i * (colW + gap), 84, colW, 520));

  parts.push(label(W / 2, 660, 'PROFILE'));
  for (let i = 0; i < 4; i++) parts.push(box(pad + i * (colW + gap), 684, colW, 360));

  parts.push(label(W / 2, 1100, 'FULL BODY VIEW'));
  const fullW = (W - pad * 2 - gap) / 2;
  for (let i = 0; i < 2; i++) parts.push(box(pad + i * (fullW + gap), 1124, fullW, H - 1124 - 90));

  parts.push(label(W / 2, H - 36, 'DEMO MODE · ADD GEMINI_API_KEY FOR A REAL SHEET'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
}

export function demoSheet(): Promise<Buffer> {
  return sharp(Buffer.from(demoSheetSvg())).png().toBuffer();
}
