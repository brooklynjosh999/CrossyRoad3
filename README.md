# CrossyRoad3

3D Crossy Road–style mini-game built with HTML, CSS, JavaScript, and Three.js.

## Play

1. Serve the project root with any static server (for example: `python -m http.server 8000`).
2. Open `http://localhost:8000` in your browser.
3. Use the **arrow keys** or **WASD** to hop your chicken across roads and rivers in the 3D scene.

### Goals

- Dodge cars on road lanes.
- Ride moving logs across the river.
- Snag coins for bonus points.
- Reach the top grass to level up and speed up the world.

### Controls

- **Arrow keys / WASD**: Move one tile at a time.
- **Start run**: Begins a new game.
- **Reset score**: Clears best score/coins and restarts.

### Tech

- WebGL rendering powered by [Three.js](https://threejs.org/) (pulled from CDN).
- Custom lane/traffic/river logic written in vanilla JavaScript.
