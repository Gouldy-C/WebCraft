# WebCraft 🎮

A Minecraft-inspired voxel game engine built with TypeScript and Three.js, featuring procedural terrain generation and efficient chunk management.

## 🌟 Features

- **Procedural World Generation**: Dynamic terrain generation using Simplex noise
- **Chunk-based World Management**: Efficient rendering using a chunk-based system
- **Multi-threaded Performance**: Web Workers for non-blocking chunk generation
- **Modern 3D Graphics**: Powered by Three.js with fog and shadow effects
- **Physics System**: Basic physics implementation for player movement
- **Optimized Rendering**: Draw distance management and fog for performance
- **Interactive Controls**: Player movement and world interaction

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/WebCraft.git
cd WebCraft
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## 🧰 Scope

WebCraft aspires to be a unique blend of features inspired by Minecraft, Terraria, and Path of Exile, delivering a rich and immersive gaming experience:

- **Exploration and Voxel World** (Minecraft-inspired):
  - Explore an expansive, procedurally generated voxel-based world with diverse biomes and dynamic weather systems.
  - Build and customize your world block by block with complete creative freedom.

- **Mining and Self-Upgrade** (Terraria-inspired):
  - Mine resources to craft tools, weapons, and armor.
  - Progress through a tiered system of upgrades that unlock new abilities and exploration opportunities.
  - Unearth rare materials and artifacts in challenging underground environments.

- **Intense Boss Fights and Character Progression** (Path of Exile-inspired):
  - Face powerful bosses with unique mechanics and combat challenges.
  - Develop your character with intricate stat systems, skill trees, and item customization.
  - Participate in seasonal content (Leagues) with unique challenges, rewards, and mechanics to keep the game fresh and exciting.

## 🛠️ Tech Stack

- **TypeScript**: Type-safe programming
- **Three.js**: 3D graphics rendering
- **Vite**: Fast build tool and development server
- **Web Workers**: Parallel processing for chunk generation
- **Simplex Noise**: Procedural terrain generation

## 🗰 Project Structure

```
src/
├── app/
│   ├── components/         # Core game components
│   │   ├── World.ts       # World management
│   │   ├── WorldChunk.ts  # Chunk handling
│   │   ├── Player.ts      # Player controls
│   │   └── Physics.ts     # Physics system
│   ├── pages/             # Game scenes
│   │   └── MainScene.ts   # Main game scene
│   └── utils/             # Utility functions
│       ├── workers/       # Web Workers
│       ├── blocks.ts      # Block definitions
│       └── TexturesManager.ts # Texture handling
```

## 🎮 Controls

- **W/A/S/D**: Move player
- **Space**: Jump
- **Mouse**: Look around
- (Add other controls specific to your implementation)

## ⚙️ Configuration

The game can be configured through various parameters:

- **Chunk Size**: Adjustable in `World.ts`
- **Draw Distance**: Configurable render distance
- **Terrain Parameters**: Customize world generation
- **Performance Settings**: Adjustable graphics quality

## 🔧 Development

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🖍️ License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Three.js community for the excellent 3D graphics library
- Minecraft for the inspiration
- Terraria and Path of Exile for gameplay mechanics inspiration
- Contributors and maintainers of the dependencies used in this project

