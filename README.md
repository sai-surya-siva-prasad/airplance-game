# Skyline Ace

A small browser flying game. Pilot an airplane through an increasingly busy sky, dodge or shoot down enemy aircraft and balloons, and skim past hazards for bonus points — or dogfight a friend online.

## Play

Open `index.html` in a modern browser. No build step or local server is required.

## Modes

- **Single flight** — survive the sky, dodge hazards, and chain hits for a score multiplier.
- **Multiplayer dogfight** — one player creates a room and shares the 4-letter code; the other joins from anywhere. Messages relay through public MQTT brokers over secure WebSockets, which works across home, office, and mobile networks without any game server — it runs straight from GitHub Pages. First to shoot the rival down wins, with instant rematches.

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

Multiplayer relays gameplay messages through several free public MQTT brokers (EMQX, HiveMQ, Mosquitto) over WSS simultaneously; messages carry sequence ids and are deduplicated, so the duel works as long as both players can reach any one broker in common. Room topics are namespaced by the 4-letter room code.
