import { World } from "./World";
import * as THREE from "three";
import { Sky } from 'three/addons/objects/Sky.js'


export class Lighting extends THREE.Group  {
  world: World
  sky: Sky
  cycleTime: number = 60 // seconds
  sun: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight
  center: THREE.Object3D
  DAY_INTENSITY = 2;
  DAY_AMBIENT = 0.2;
  NIGHT_AMBIENT = 0.04;
  INTENSITY_STEP = this.DAY_INTENSITY / 3;
  AMBIENT_STEP = (this.NIGHT_AMBIENT - this.DAY_AMBIENT) / 3;

  constructor(world: World) {
    super()

    this.world = world;
    this.ambientLight = new THREE.AmbientLight(0xffffff, this.NIGHT_AMBIENT);
    this.sun = new THREE.DirectionalLight("#fffbef", this.DAY_INTENSITY);
    this.center = new THREE.Object3D()

    this.sky = new Sky();
    this.sky.scale.setScalar( 45000 );

    this.sky.material.uniforms.turbidity.value = 0.3;
    this.sky.material.uniforms.rayleigh.value = 0.3;
    this.sky.material.uniforms.mieCoefficient.value = 0.005;
    this.sky.material.uniforms.mieDirectionalG.value = 0.8;

    this.add(this.sky);

    this.setupLighting();
  }

  getDayNight(theta: number, nightStartPercent: number, dayStartPercent: number) {
    if (isNaN(theta) || isNaN(dayStartPercent) || isNaN(nightStartPercent)) {
      throw new Error('Invalid input parameters');
    }

    // Adjust transition points
    const nightStart = Math.PI - Math.PI * nightStartPercent;
    const dayStart = Math.PI * 2 - Math.PI * dayStartPercent;
    const thetaCorrected = theta % (2 * Math.PI);

    // Day transition
    if (thetaCorrected > 0 && thetaCorrected <= nightStart) {
      const t = thetaCorrected / nightStart;
      const smoothT = smoothInterpolation(t);
      
      return { 
        color: DayNightColors[0],
        intensity: this.DAY_INTENSITY * (1 - smoothT * 0.2), 
        ambient: this.DAY_AMBIENT * (1 - smoothT * 0.3)
      };
    }

    // Sunset/Night transition
    if (thetaCorrected > nightStart && thetaCorrected <= Math.PI) {
      const t = (thetaCorrected - nightStart) / (Math.PI - nightStart);
      const smoothT = smoothInterpolation(t);
      
      return { 
        color: lerpColor(DayNightColors[0], DayNightColors[3], smoothT), 
        intensity: Math.max(this.DAY_INTENSITY * (1 - smoothT), 0), 
        ambient: this.NIGHT_AMBIENT + (this.DAY_AMBIENT - this.NIGHT_AMBIENT) * (1 - smoothT)
      };
    }

    // Night
    if (thetaCorrected > Math.PI && thetaCorrected < dayStart) {
      return { 
        color: DayNightColors[3], 
        intensity: 0, 
        ambient: this.NIGHT_AMBIENT 
      };
    }

    // Sunrise transition
    if (thetaCorrected >= dayStart) {
      const t = (thetaCorrected - dayStart) / (Math.PI * 2 - dayStart);
      const smoothT = smoothInterpolation(t);
      
      return { 
        color: lerpColor(DayNightColors[3], DayNightColors[0], smoothT), 
        intensity: Math.min(this.DAY_INTENSITY * smoothT, this.DAY_INTENSITY), 
        ambient: this.NIGHT_AMBIENT + (this.DAY_AMBIENT - this.NIGHT_AMBIENT) * smoothT
      };
    }

    // Fallback
    return { 
      color: DayNightColors[0], 
      intensity: this.DAY_INTENSITY, 
      ambient: this.DAY_AMBIENT 
    };
  }

  update(position: THREE.Vector3) {
    const theta = 2 * Math.PI / this.cycleTime
    const thetaAcu = theta * this.world.time.getTime();
    const radius = 5000
    const x = position.x + radius * Math.cos(thetaAcu)
    const y = radius * Math.sin(thetaAcu)
    this.center.position.copy(new THREE.Vector3(position.x, 0, position.z))
    this.sun.position.copy(new THREE.Vector3(x, y, position.z))
    this.sky.material.uniforms.sunPosition.value = this.sun.position

    const cycle = this.getDayNight(thetaAcu, 0.1, 0.1)
    if (!cycle) return
    this.sun.intensity = cycle.intensity
    // this.world.scene.renderer.setClearColor(cycle.color, 1)
    this.ambientLight.intensity = cycle.ambient
    // if (this.world.scene.fog) {
    //   this.world.scene.fog.color = new THREE.Color(cycle.color)
    // }
  }

  setupLighting() {
    this.cycleTime = this.world.fullDayTime
    const width = this.world.params.terrain.chunkSize.width * this.world.params.terrain.drawDistance 
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -width * 2;
    this.sun.shadow.camera.right = width  * 2;
    this.sun.shadow.camera.top = width  * 2;
    this.sun.shadow.camera.bottom = -width  * 2;
    this.sun.shadow.camera.near = 0.1;
    this.sun.shadow.camera.far = width + 5000
    this.sun.shadow.bias = -0.00005;
    this.sun.shadow.normalBias = 2.5;
    this.sun.shadow.mapSize = new THREE.Vector2(256, 256); 
    this.sun.shadow.radius = 2; 

    this.add(this.sun);
    this.add(this.ambientLight);
    this.add(this.center)

    this.sun.target = this.center
  }
}