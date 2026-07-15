# Skyline Ace

A small browser flying game. Pilot an airplane through an increasingly busy sky, dodge or shoot down enemy aircraft and balloons, and skim past hazards for bonus points — or dogfight a friend online.

## Play

Open `index.html` in a modern browser. No build step or local server is required.

## Modes

- **Single flight** — survive the sky, dodge hazards, and chain hits for a score multiplier.
- **Multiplayer dogfight** — one player creates a room and shares the 4-letter code; the other joins from anywhere. The connection is peer-to-peer (WebRTC via [PeerJS](https://peerjs.com)), so no game server is needed — it works straight from GitHub Pages. First to shoot the rival down wins, with instant rematches.

## Controls

- **Arrow keys** or **WASD** — steer
- **Click / hold** (any mouse button), **touch**, or **Space** — fire the cannon; dragging steers and fires at once
- **Drag / touch** — steer toward your pointer
- **P** — pause or resume
- **Enter / Space** — start or restart from a menu

You have three hull points. The flight gets faster over time, enemy aces bank through the sky, and enemy aircraft begin shooting back after takeoff. A pulsing red ring warns you before an enemy fires. Destroying consecutive hazards builds a multiplier worth up to 500 points per hit; close passes award 150 bonus points.

## Project files

- `index.html` — game page and interface
- `styles.css` — responsive presentation
- `game.js` — game loop, input, collisions, networking, and Canvas rendering

Multiplayer uses the free PeerJS cloud for the connection handshake only; gameplay traffic flows directly between the two browsers.
