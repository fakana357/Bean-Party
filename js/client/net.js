// WebSocket link to the Bean Party room server (server/main.ts).
// The server address is the page's own origin, or ?server=host:port.
export function serverURL() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return (/^wss?:\/\//.test(q) ? q : (location.protocol === 'https:' ? 'wss://' : 'ws://') + q).replace(/\/$/, '') + '/ws';
  if (window.BEAN_SERVER) return window.BEAN_SERVER;
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
}

export class Net {
  constructor(handlers) { this.h = handlers; this.ws = null; this.open = false; }
  connect() {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(serverURL()); } catch (e) { reject(e); return; }
      this.ws = ws;
      const t = setTimeout(() => { if (!this.open) { try { ws.close(); } catch {} reject(new Error('timeout')); } }, 6000);
      ws.onopen = () => { clearTimeout(t); this.open = true; resolve(); };
      ws.onerror = () => { if (!this.open) { clearTimeout(t); reject(new Error('unreachable')); } };
      ws.onclose = () => { const was = this.open; this.open = false; if (was) this.h.close?.(); };
      ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this.h[m.t]?.(m); };
    });
  }
  send(m) { if (this.open) this.ws.send(JSON.stringify(m)); }
  close() { this.open = false; try { this.ws?.close(); } catch {} }
}
