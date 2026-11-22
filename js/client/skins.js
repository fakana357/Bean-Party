// Bean skins: colour combos + patterns painted onto the bean's body texture.
import * as THREE from 'three';

export const PATTERNS = ['solid', 'gradient', 'bigdots', 'stripes', 'split', 'band', 'dip', 'vsplit'];
export const ACCENTS = ['#ffffff', '#ffd23f', '#2a1846', '#ff5fa8', '#7fd3ff', '#57d96b', '#ff8a3d', '#a066ff'];
export const PALETTE = ['#ff4d5e', '#ff8a3d', '#ffd23f', '#a8e05f', '#57d96b', '#2ee6c5', '#7fd3ff', '#3d8bff', '#a066ff', '#ff7fc8', '#ffffff', '#2a1846'];

// default skin per WC3 player slot (base colour keeps the slot identity)
export const DEFAULT_SKINS = [null,
  { pattern: 'bigdots', accent: '#ffffff' },
  { pattern: 'stripes', accent: '#7fd3ff' },
  { pattern: 'gradient', accent: '#3d8bff' },
  { pattern: 'split', accent: '#ffd23f' },
  { pattern: 'band', accent: '#ff5fa8' },
  { pattern: 'dip', accent: '#2a1846' },
  { pattern: 'vsplit', accent: '#ffffff' },
  { pattern: 'solid', accent: '#ffffff' },
];

const cache = new Map();
// The canvas wraps the bean body: x = around (front at the centre), y = top (0) to bottom (h).
// 512 x 370 matches the body's circumference : profile length, so 1 px is square on the bean
// and circles stay circles. Patterns keep to the straight cylinder band where possible.
export const SKIN_W = 512, SKIN_H = 370;
const BAND0 = 0.30, BAND1 = 0.72; // cylinder part of the profile (top .. bottom), as canvas fractions
export function skinCanvas(base, s, w = SKIN_W, h = SKIN_H, withFace = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  const A = s.accent, k = w / SKIN_W;
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  switch (s.pattern) {
    case 'gradient': { const gr = g.createLinearGradient(0, h * 0.2, 0, h); gr.addColorStop(0, base); gr.addColorStop(1, A); g.fillStyle = gr; g.fillRect(0, 0, w, h); break; }
    case 'bigdots': {
      g.fillStyle = A; const r = 14 * k, cols = 8;
      for (let row = 0; row < 4; row++) for (let i = 0; i < cols; i++) {
        const x = (i + (row % 2) * 0.5) * (w / cols) + w / cols / 2, y = h * (0.32 + row * 0.1);
        if (Math.abs(x - w / 2) < 62 * k && row < 2) continue; // keep the face clear
        g.beginPath(); g.arc(x % w, y, r, 0, 7); g.fill();
      }
      break;
    }
    case 'stripes': g.fillStyle = A; for (let i = 0; i < 3; i++) g.fillRect(0, h * (0.52 + i * 0.09), w, h * 0.045); break;
    case 'split': g.fillStyle = A; g.fillRect(0, h * 0.6, w, h); break;
    case 'band': g.fillStyle = A; g.fillRect(0, h * 0.55, w, h * 0.09); break;
    case 'dip': g.fillStyle = A; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 4) g.lineTo(x, h * 0.7 + Math.sin(x / w * Math.PI * 8) * h * 0.022); g.lineTo(w, h); g.fill(); break;
    case 'vsplit': g.fillStyle = A; g.fillRect(0, 0, w * 0.5, h); break; // left half
  }
  if (withFace && s.emoji) {
    const size = 92 * k;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif`;
    g.fillText(s.emoji, w / 2, h * 0.41 + size * 0.06);
  }
  return cv;
}
export function skinTexture(base, s) {
  const key = base + JSON.stringify(s);
  if (cache.has(key)) return cache.get(key);
  const t = new THREE.CanvasTexture(skinCanvas(base, s)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  cache.set(key, t); return t;
}
export function skinDataURL(base, s, w = 64, h = 64) { return skinCanvas(base, s, SKIN_W / 4, SKIN_H / 4, false).toDataURL(); }

export const EMOJIS = [...'😀😃😄😁😆🥹😅😂🤣🥲😊😇🙂🙃😉😌😍🥰😘😋😛😝😜🤪🤨🧐🤓😎🥸🤩🥳😏😒😔😟😕🙁😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😓🫣🤗🫡🤔🫢🤭🤫🤥😶🫠😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🫥🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👿👹👺🤡💩👻💀👽👾🤖🎃😺😸😹😻😼😽🙀😿😾🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦉🐺🐗🐴🦄🐝🐛🦋🐌🐞🐢🐍🦖🐙🦑🐡🐠🐳🐬🐊🦓🦍🐘🦔🐲🌝🌚🌞⭐🌈🔥💧🍎🍊🍋🍉🍓🍒🍑🥝🍍🥑🍆🌽🥕🧀🍔🍟🍕🌮🍩🍪🎂🧁🍭🍬⚽🏀🏈🎱🎯🎮🎲🧸💎💖💜💙💚💛🧡'].filter((c) => /\p{Extended_Pictographic}/u.test(c));
const faceCache = new Map();
// emoji face decal; drawn large on a transparent canvas so it reads at any distance
export function emojiTexture(e) {
  if (faceCache.has(e)) return faceCache.get(e);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const g = cv.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '200px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  g.fillText(e, 128, 138);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  faceCache.set(e, t); return t;
}
