# Skyline Ace

A small, dependency-free browser flying game. Pilot an airplane through an increasingly busy sky, dodge or shoot down enemy aircraft and balloons, and skim past hazards for bonus points.

## Play

Open `index.html` in a modern browser. No build step or local server is required.

## Controls

- **Arrow keys** or **WASD** — steer
- **Right click / hold** or **Space** — fire the cannon
- **Drag / touch** — steer toward your pointer
- **P** — pause or resume
- **Enter / Space** — start or restart from a menu

You have three hull points. The flight gets faster over time, enemy aces bank through the sky, and enemy aircraft begin shooting back after takeoff. A pulsing red ring warns you before an enemy fires. Destroying consecutive hazards builds a multiplier worth up to 500 points per hit; close passes award 150 bonus points.

## Project files

- `index.html` — game page and interface
- `styles.css` — responsive presentation
- `game.js` — game loop, input, collisions, and Canvas rendering
