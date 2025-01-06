import * as THREE from 'three';

export type Block = BasicBlock | Resource

export interface BasicBlock {
  id: number;
  name: string;
  textures: {
    top: string;
    bottom: string;
    left: string;
    right: string;
    front: string;
    back: string;
  };
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
    textures: {
      top: 'air',
      bottom: 'air',
      left: 'air',
      right: 'air',
      front: 'air',
      back: 'air',
    }
  },
  bedrock: {
    id: 1,
    name: 'bedrock',
    textures: {
      top: 'bedrock',
      bottom: 'bedrock',
      left: 'bedrock',
      right: 'bedrock',
      front: 'bedrock',
      back: 'bedrock',
    },
  },
  cloud: {
    id: 2,
    name: 'cloud',
    textures: {
      top: 'cloud',
      bottom: 'cloud',
      left: 'cloud',
      right: 'cloud',
      front: 'cloud',
      back: 'cloud',
    },
  },
  grass: {
    id: 3,
    name: 'grass',
    textures: {
      top: 'grass_top',
      bottom: 'dirt',
      left: 'grass_side',
      right: 'grass_side',
      front: 'grass_side',
      back: 'grass_side',
    },
  },
  dirt: {
    id: 4,
    name: 'dirt',
    textures: {
      top: 'dirt',
      bottom: 'dirt',
      left: 'dirt',
      right: 'dirt',
      front: 'dirt',
      back: 'dirt',
    },
  },
  sand: {
    id: 5,
    name: 'sand',
    textures: {
      top: 'sand',
      bottom: 'sand',
      left: 'sand',
      right: 'sand',
      front: 'sand',
      back: 'sand',
    },
  },
  stone: {
    id: 6,
    name: 'stone',
    textures: {
      top: 'stone',
      bottom: 'stone',
      left: 'stone',
      right: 'stone',
      front: 'stone',
      back: 'stone',
    },
    scale: { x: 30, y: 30, z: 30 },
    scarcity: 0.8,
  },
  water: {
    id: 7,
    name: 'water',
    textures: {
      top: 'water',
      bottom: 'water',
      left: 'water',
      right: 'water',
      front: 'water',
      back: 'water',
    },
  },
  cobblestone: {
    id: 8,
    name: 'cobblestone',
    textures: {
      top: 'cobblestone',
      bottom: 'cobblestone',
      left: 'cobblestone',
      right: 'cobblestone',
      front: 'cobblestone',
      back: 'cobblestone',
    }
  },
  coal_ore: {
    id: 9,
    name: 'coalOre',
    textures: {
      top: 'coal_ore',
      bottom: 'coal_ore',
      left: 'coal_ore',
      right: 'coal_ore',
      front: 'coal_ore',
      back: 'coal_ore',
    },
    scale: { x: 20, y: 20, z: 20 },
    scarcity: 0.8,
  },
  iron_ore: {
    id: 10,
    name: 'ironOre',
    textures: {
      top: 'iron_ore',
      bottom: 'iron_ore',
      left: 'iron_ore',
      right: 'iron_ore',
      front: 'iron_ore',
      back: 'iron_ore',
    },
    scale: { x: 40, y: 40, z: 40 },
    scarcity: 0.9,
  },
  snow_dirt: {
    id: 11,
    name: 'snow_dirt',
    textures: {
      top: 'snow',
      bottom: 'snow_dirt_side',
      left: 'snow_dirt_side',
      right: 'snow_dirt_side',
      front: 'snow_dirt_side',
      back: 'snow_dirt_side',
    },
  },
  snow: {
    id: 12,
    name: 'snow',
    textures: {
      top: 'snow',
      bottom: 'snow',
      left: 'snow',
      right: 'snow',
      front: 'snow',
      back: 'snow',
    },
  },
  oak_log: {
    id: 13,
    name: 'oak_log',
    textures: {
      top: 'log_oak_top',
      bottom: 'log_oak_top',
      left: 'log_oak',
      right: 'log_oak',
      front: 'log_oak',
      back: 'log_oak',
    }
  },
  oak_leaves: {
    id: 14,
    name: 'oak_leaves',
    textures: {
      top: 'oak_leaves',
      bottom: 'oak_leaves',
      left: 'oak_leaves',
      right: 'oak_leaves',
      front: 'oak_leaves',
      back: 'oak_leaves',
    }
  },
  

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