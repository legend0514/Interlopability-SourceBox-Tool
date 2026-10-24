import { timingSafeEqual } from 'node:crypto';

export const VERSION = 4;
export const GAMES = ['hl2', 'tf2', 'hl1mp', 'gmod', 'portal2', 'cs2'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const HEX = /^[0-9a-f]{64}$/;
export const label = x => typeof x === 'string' && /^[a-zA-Z0-9 _.-]{1,48}$/.test(x);
export const mapId = x => typeof x === 'string' && /^[a-zA-Z0-9_/-]{1,96}$/.test(x) && !x.includes('..');
export const exact = (x, keys) => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
export const member = x => exact(x, ['id', 'game', 'name', 'map']) && typeof x.id === 'string' && UUID.test(x.id) && GAMES.includes(x.game) && label(x.name) && mapId(x.map);
export function secretEqual(a, b) {
  return typeof a === 'string' && HEX.test(a) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

// Bound both incomplete frames and complete messages; never log received payloads.
export function frames(socket, receive, fail, max = 4096) {
  let pending = Buffer.alloc(0), stopped = false;
  socket.on('data', chunk => {
    if (stopped) return;
    for (let start = 0; start < chunk.length;) {
      const end = chunk.indexOf(10, start);
      const part = chunk.subarray(start, end < 0 ? chunk.length : end);
      if (pending.length + part.length > max) { stopped = true; fail('frame_limit'); return; }
      pending = Buffer.concat([pending, part]);
      if (end < 0) return;
      let data;
      try { data = JSON.parse(pending.toString('utf8')); }
      catch { stopped = true; fail('invalid_json'); return; }
      pending = Buffer.alloc(0);
      try { receive(data); } catch { stopped = true; fail('invalid_message'); return; }
      if (socket.destroyed) return;
      start = end + 1;
    }
  });
}

export function send(socket, value) {
  if (socket.destroyed || socket.writableLength > 65536) { socket.destroy(); return false; }
  socket.write(JSON.stringify(value) + '\n');
  return true;
}
