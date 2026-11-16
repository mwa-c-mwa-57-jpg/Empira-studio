// Outil de développement (jamais livré) : faux serveur WebSocket au format TikFinity,
// pour tester la source « TikFinity » (secours) du jeu.

import http from 'node:http';
import crypto from 'node:crypto';

/** Faux TikFinity : serveur WebSocket minimal qui envoie des messages texte aux clients connectés. */
export function createFauxTikFinity() {
  const clients = new Set();
  const serveur = http.createServer((req, res) => {
    res.writeHead(426);
    res.end();
  });
  serveur.on('upgrade', (req, socket) => {
    const cle = req.headers['sec-websocket-key'];
    if (!cle) return socket.destroy();
    const accept = crypto.createHash('sha1').update(`${cle}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
    socket.on('data', () => {}); // les trames du client (ping, fermeture) sont ignorées
  });
  serveur.envoyer = (obj) => {
    const charge = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));
    const n = charge.length;
    const tete = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127, 0, 0, 0, 0]), Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])]);
    const trame = Buffer.concat([tete, charge]);
    for (const s of clients) s.write(trame);
  };
  serveur.nbClients = () => clients.size;
  serveur.fermerClients = () => {
    for (const s of clients) s.destroy();
    clients.clear();
  };
  return serveur;
}
