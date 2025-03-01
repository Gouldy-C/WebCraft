import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { RESOURCES } from "./blocks";
import { Player } from "../../../components/unused/Player";
import { World } from "../../../components/World";

export function createUi(world: World, player: Player) {
  const gui = new GUI();
  gui.title("Settings");

  const playerFolder = gui.addFolder("Player");
  playerFolder.add(player, "baseSpeed", 1, 20).name("Max Speed");
  playerFolder.add(player.cameraHelper, "visible").name("Show Camera Helper");

  const chunkFolder = gui.addFolder("Chunk");
  chunkFolder.add(world, "drawDistance", 0, 10, 1).name("Draw Distance");

  const terrainFolder = gui.addFolder("Terrain");
  terrainFolder.add(world.terrainGenParams, "seed").name("Seed");
  terrainFolder
    .add(world.terrainGenParams.terrain, "offset", 0, 1, 0.05)
    .name("Offset");
  terrainFolder
    .add(world.terrainGenParams.terrain, "maxHeight", 0, 1, 0.05)
    .name("Max Height");
  terrainFolder
    .add(world.terrainGenParams.terrain, "frequency", 0.0001, 0.004, 0.0001)
    .name("Frequency");
  terrainFolder
    .add(world.terrainGenParams.terrain, "octaves", 1, 10, 1)
    .name("Octaves");
  terrainFolder
    .add(world.terrainGenParams.terrain, "lacunarity", 1.5, 2.5, 0.01)
    .name("Lacunarity");
  terrainFolder
    .add(world.terrainGenParams.terrain, "persistence", 0.3, 0.7, 0.01)
    .name("Persistence");

  const resorcesFolder = gui.addFolder("Resources");
  for (const resource of RESOURCES) {
    const resourceFolder = resorcesFolder.addFolder(resource.name);
    const scaleFolder = resourceFolder.addFolder("Scales");
    scaleFolder.add(resource.scale!, "x", 0, 100, 0.5).name("Scale X");
    scaleFolder.add(resource.scale!, "y", 0, 100, 0.5).name("Scale Y");
    scaleFolder.add(resource.scale!, "z", 0, 100, 0.5).name("Scale Z");
  }

  gui.onChange(() => {
    world.generate(player);
  });
}
