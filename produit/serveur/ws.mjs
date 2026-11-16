// Serveur WebSocket minimal (envoi de messages texte aux pages du jeu), sans dépendance.

import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function trame(texte, opcode = 0x1) {
  const charge = Buffer.from(texte);
  const n = charge.length;
  let tete;
  if (n < 126) tete = Buffer.from([0x80 | opcode, n]);
  else if (n < 65536) tete = Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]);
  else {
    tete = Buffer.alloc(10);
    tete[0] = 0x80 | opcode;
    tete[1] = 127;
    tete.writeBigUInt64BE(BigInt(n), 2);
  }
  return Buffer.concat([tete, charge]);
}

/** Accepte les connexions WebSocket sur un chemin donné ; renvoie { diffuser, nombre, surConnexion }. */
export function serveurWebSocket(serveurHttp, chemin, { surConnexion = () => {} } = {}) {
  const clients = new Set();
  serveurHttp.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://localhost');
    const cle = req.headers['sec-websocket-key'];
    // seules les pages servies par ce PC peuvent se connecter
    const origine = req.headers.origin;
    if (url.pathname !== chemin || !cle || (origine && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine))) {
      socket.destroy();
      return;
    }
    const accept = crypto.createHash('sha1').update(cle + GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.setNoDelay(true);
    clients.add(socket);
    const fermer = () => clients.delete(socket);
    socket.on('close', fermer);
    socket.on('error', fermer);
    socket.on('data', (buf) => {
      const opcode = buf[0] & 0x0f;
      if (opcode === 0x8) {
        try {
          socket.end(trame('', 0x8));
        } catch {
          /* déjà fermé */
        }
        fermer();
      } else if (opcode === 0x9) socket.write(trame('', 0xa)); // ping → pong
    });
    surConnexion((message) => socket.write(trame(JSON.stringify(message))));
  });
  return {
    diffuser(message) {
      const t = trame(JSON.stringify(message));
      for (const s of clients) s.write(t);
    },
    nombre: () => clients.size,
    fermerTout() {
      for (const s of clients) s.destroy();
      clients.clear();
    },
  };
}
