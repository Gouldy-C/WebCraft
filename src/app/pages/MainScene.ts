import { InputManager } from "../utils/classes/InputManger";
import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";
// import { createUi } from "../utils/ui";
import { World } from "../components/World";

export class MainScene extends THREE.Scene {
  fogBoolean = true;

  renderer: THREE.WebGLRenderer;
  stats: Stats;
  previousTime = performance.now();
  world: World;
  inputManager: InputManager;

  constructor(domElement: HTMLElement) {
    super();

    this.stats = new Stats();
    domElement.appendChild(this.stats.dom);

    this.inputManager = new InputManager(document.body);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    domElement.appendChild(this.renderer.domElement);

    this.world = new World(this);
    this.add(this.world);

    if (this.fogBoolean) {
      const { chunkSize, hDrawDist } = this.world.params.terrain;
      this.fog = new THREE.Fog(
        "#c4e2ff",
        chunkSize * hDrawDist,
        chunkSize * (hDrawDist / 2 + 2)
      );
    }


    // createUi(this.world, this.player);

    this.addEventListeners();
    this.renderer.setAnimationLoop(() => this.animate());
  }
  
  private animate() {
    let currentTime = performance.now();
    let deltaTime = (currentTime - this.previousTime) / 1000;
    this.previousTime = currentTime;
    
    this.world.update(deltaTime);
    this.renderer.render(this, this.world.activeCamera);
    this.stats.update();
    
    // console.log(Math.round(this.renderer.info.render.triangles), this.renderer.info.render.calls);
  }

  private addEventListeners() {
    window.addEventListener("resize", () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.world.orbitCamera.aspect = window.innerWidth / window.innerHeight;
      this.world.orbitCamera.updateProjectionMatrix();
      // this.world.controls.update()
      // this.world.player.camera.aspect = window.innerWidth / window.innerHeight;
      // this.world.player.camera.updateProjectionMatrix();
    });
  }
}
