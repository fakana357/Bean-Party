// Seeded RNG (mulberry32). The whole simulation draws from one stream so a
// match can be replayed or run server-side from the same seed + inputs.
export class Rng {
  constructor(seed = 1) { this.s = seed >>> 0; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // GetRandomReal(a,b)
  real(a, b) { return a + (b - a) * this.next(); }
  // GetRandomInt(a,b) inclusive
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  // GetRandomDirectionDeg()
  dir() { return this.real(0, 360); }
  pick(arr) { return arr.length ? arr[this.int(0, arr.length - 1)] : null; }
}
