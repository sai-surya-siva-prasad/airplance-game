# Skyline Ace

A small browser flying game. Pilot an airplane through an increasingly busy sky, dodge or shoot down enemy aircraft and balloons, and skim past hazards for bonus points — or dogfight a friend online.

## Play

Open `index.html` in a modern browser. No build step or local server is required.

## Modes

- **Story campaign** — Baron Nyx and his Crimson Armada have seized the planet's skies. A Star Wars-style opening crawl sets the scene, radio chatter from Flight Command (and taunts from the Baron) tells the story as you fly, and after the sixth stage you face **Baron Nyx himself** — a human-like ace who tracks your altitude, jinks unpredictably, and alternates spread volleys with rapid aimed bursts. Defeat him to save the planet, then take the victory-screen challenge: fight a *real* human in multiplayer. Fight through six themed stages of increasing difficulty: **Daybreak**, **Sunset Squadron**, **Night Raid** (moonlit, starry), **Storm Front** (rain and lightning), **Deep Space** (asteroids, green enemy lasers, a ringed planet), and the final **Manhattan Run** — a night flight through New York City with a parallax skyline, sweeping searchlights, and skyscrapers you must weave between. Each stage spawns faster, tougher, more accurate enemies, and a **stage guardian boss** attacks at every stage transition — beat it for big points and a repair drop. Grab floating power-ups (**shield**, **triple shot**, **repair**), chain hits for a score multiplier, and beat your personal best (saved locally).
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
