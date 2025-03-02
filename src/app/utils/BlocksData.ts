import * as THREE from 'three';

export type Block = BasicBlock | Resource

export interface BasicBlock {
  id: number;
  name: string;
  textures: string[];
  transparent: boolean
  material?: THREE.Material[] | THREE.Material
}
export interface Resource extends BasicBlock {
  scarcity: number;
  scale: {x: number, y: number, z: number};
}

export const BLOCKS: Record<string, Block> = {
  air: {
    id: 0,
    name: 'air',
    transparent: true,
    textures: ['/textures/blocks/missing_tile.png']
  },
  bedrock: {
    id: 1,
    name: 'bedrock',
    transparent: false,
    textures: ['/textures/blocks/bedrock.png'],
  },
  grass: {
    id: 2,
    name: 'grass',
    transparent: false,
    textures: [
      '/textures/blocks/grass_carried.png',
      '/textures/blocks/dirt.png',
      '/textures/blocks/grass_side_carried.png',
    ],
  },
  dirt: {
    id: 3,
    name: 'dirt',
    transparent: false,
    textures: ['/textures/blocks/dirt.png'],
  },
  stone: {
    id: 4,
    name: 'stone',
    transparent: false,
    textures: ['/textures/blocks/stone.png'],
    scale: { x: 30, y: 30, z: 30 },
    scarcity: 0.8,
  },
  sand: {
    id: 5,
    name: 'sand',
    transparent: false,
    textures: ['/textures/blocks/sand.png'],
  },
  water: {
    id: 6,
    name: 'water',
    transparent: true,
    textures: ['/textures/blocks/water_placeholder.png'],
  },
  cobblestone: {
    id: 7,
    name: 'cobblestone',
    transparent: false,
    textures: ['/textures/blocks/cobblestone.png'],
  },
  coal_ore: {
    id: 8,
    name: 'coalOre',
    transparent: false,
    textures: ['/textures/blocks/coal_ore.png'],
    scale: { x: 20, y: 20, z: 20 },
    scarcity: 0.8,
  },
  iron_ore: {
    id: 9,
    name: 'ironOre',
    transparent: false,
    textures: ['/textures/blocks/iron_ore.png'],
    scale: { x: 40, y: 40, z: 40 },
    scarcity: 0.9,
  },
  snow_dirt: {
    id: 10,
    name: 'snow_dirt',
    transparent: false,
    textures: [
      '/textures/blocks/snow.png',
      '/textures/blocks/dirt.png',
      '/textures/blocks/grass_side_snowed.png',
    ],
  },
  snow: {
    id: 11,
    name: 'snow',
    transparent: false,
    textures: ['/textures/blocks/snow.png'],
  },
  oak_log: {
    id: 12,
    name: 'oak_log',
    transparent: false,
    textures: [
      '/textures/blocks/log_oak_top.png',
      '/textures/blocks/log_oak_top.png',
      '/textures/blocks/log_oak.png',
    ]
  },
  oak_leaves: {
    id: 13,
    name: 'oak_leaves',
    transparent: true,
    textures: ['/textures/blocks/leaves_oak_carried.tga'],
  },
  gravel: {
    id: 14,
    name: 'gravel',
    transparent: false,
    textures: ['/textures/blocks/gravel.png'],
  }
};

export const blockIDToBlock: Record<number, Block> = Object.values(BLOCKS).reduce((acc, block) => {
  acc[block.id] = block;
  return acc;
}, {} as Record<number, Block>);


// highest priority first 
export const RESOURCES: Resource[] = [
  BLOCKS.iron_ore as Resource,
  BLOCKS.coal_ore as Resource,
  BLOCKS.stone as Resource,
]