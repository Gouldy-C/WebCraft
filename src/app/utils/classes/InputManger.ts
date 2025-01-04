import * as THREE from 'three';

// Enum for all possible input actions
export enum InputAction {
  MOVE_FORWARD = 'moveForward',
  MOVE_BACKWARD = 'moveBackward',
  MOVE_LEFT = 'moveLeft',
  MOVE_RIGHT = 'moveRight',
  JUMP = 'jump',
  SPRINT = 'sprint',
  CROUCH = 'crouch',
  INTERACT = 'interact',
  PRIMARY_ACTION = 'primaryAttack',
  SECONDARY_ACTION = 'secondaryAttack',
  RELOAD = 'reload',
  INVENTORY = 'inventory',
  MAP = 'map',
  PAUSE = 'pause',
  SCROLL_TOOLBAR_RIGHT = 'scrollToolbarRight',
  SCROLL_TOOLBAR_LEFT = 'scrollToolbarLeft'
}

// Interface for input configuration
interface InputConfig {
  [action: string]: {
    keyboard?: string;
    mouse?: string;
  };
}

export class InputManager {
  private domElement: HTMLElement;
  private activeKeys: Set<string>;
  private mouseButtons: Set<number>;
  private mouseDelta: THREE.Vector2;
  private currentConfig: InputConfig;
  private defaultConfig: InputConfig;
  private mouseWheelDelta: THREE.Vector2

  // Binding events
  private boundKeyDown: (event: KeyboardEvent) => void;
  private boundKeyUp: (event: KeyboardEvent) => void;
  private boundMouseDown: (event: MouseEvent) => void;
  private boundMouseUp: (event: MouseEvent) => void;
  private boundMouseMove: (event: MouseEvent) => void;
  private boundMouseWheel: (event: WheelEvent) => void;

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    this.activeKeys = new Set();
    this.mouseButtons = new Set();
    this.mouseDelta = new THREE.Vector2();
    this.mouseWheelDelta = new THREE.Vector2()

    // Set up default configuration
    this.defaultConfig = {
      [InputAction.MOVE_FORWARD]: { keyboard: 'KeyW' },
      [InputAction.MOVE_BACKWARD]: { keyboard: 'KeyS' },
      [InputAction.MOVE_LEFT]: { keyboard: 'KeyA' },
      [InputAction.MOVE_RIGHT]: { keyboard: 'KeyD' },
      [InputAction.JUMP]: { keyboard: 'Space' },
      [InputAction.SPRINT]: { keyboard: 'ShiftLeft' },
      [InputAction.CROUCH]: { keyboard: 'ControlLeft' },
      [InputAction.INTERACT]: { keyboard: 'KeyE' },
      [InputAction.PRIMARY_ACTION]: { mouse: 'left' },
      [InputAction.SECONDARY_ACTION]: { mouse: 'right' },
      [InputAction.INVENTORY]: { keyboard: 'KeyI' },
      [InputAction.MAP]: { keyboard: 'KeyM' },
      [InputAction.PAUSE]: { keyboard: 'Escape' },
      [InputAction.RELOAD]: { keyboard: 'KeyR' },
      [InputAction.SCROLL_TOOLBAR_RIGHT]: { mouse: 'WheelUp' },
      [InputAction.SCROLL_TOOLBAR_LEFT]: { mouse: 'WheelDown' }
    };

    this.currentConfig = JSON.parse(JSON.stringify(this.defaultConfig));

    // Bind event methods
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseWheel = this.onMouseWheel.bind(this);

    this.initialize();
  }

  private initialize(): void {
    this.domElement.addEventListener('keydown', this.boundKeyDown, {capture: true});
    this.domElement.addEventListener('keyup', this.boundKeyUp, {capture: true});
    this.domElement.addEventListener('mousedown', this.boundMouseDown, {capture: true});
    this.domElement.addEventListener('mouseup', this.boundMouseUp, {capture: true});
    this.domElement.addEventListener('mousemove', this.boundMouseMove, {capture: true});
    this.domElement.addEventListener('wheel', this.boundMouseWheel, {capture: true});
  }

  private onKeyDown(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeKeys.add(event.code);
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.activeKeys.delete(event.code);
  }

  private onMouseDown(event: MouseEvent): void {
    this.mouseButtons.add(event.button);
  }

  private onMouseUp(event: MouseEvent): void {
    this.mouseButtons.delete(event.button);
  }

  private onMouseMove(event: MouseEvent): void {
    this.mouseDelta.x = event.movementX || 0;
    this.mouseDelta.y = event.movementY || 0;
  }

  private onMouseWheel(event: WheelEvent): void {
    this.mouseWheelDelta.y = event.deltaY || 0;
    this.mouseWheelDelta.x = event.deltaX || 0;

  }

  // Check if a specific action is currently active
  public isActionActive(action: InputAction): boolean {
    const binding = this.currentConfig[action];
    
    if (binding?.keyboard && this.activeKeys.has(binding.keyboard)) {
      return true;
    }

    if (binding?.mouse) {
      const mouseButtonMap = {
        'left': 0,
        'middle': 1,
        'right': 2
      };
      const buttonCode = mouseButtonMap[binding.mouse as keyof typeof mouseButtonMap];
      return this.mouseButtons.has(buttonCode);
    }

    return false;
  }

  // Get mouse movement delta
  public getMouseDelta(): THREE.Vector2 {
    const delta = this.mouseDelta.clone();
    this.mouseDelta.set(0, 0);
    return delta;
  }

  public getMouseWheelDelta(): THREE.Vector2 {
    const delta = this.mouseWheelDelta.clone();
    this.mouseWheelDelta.set(0, 0)
    return delta;
  }

  // Remap a key or mouse button for a specific action
  public remapAction(action: InputAction, newKey?: string, newMouseButton?: string): void {
    const currentConfig = this.currentConfig[action];
    
    if (newKey) {
      currentConfig.keyboard = newKey;
    }
    
    if (newMouseButton) {
      currentConfig.mouse = newMouseButton;
    }

    // Optionally, save to local storage
    this.saveConfigToLocalStorage();
  }

  // Reset a specific action to its default binding
  public resetActionToDefault(action: InputAction): void {
    this.currentConfig[action] = this.defaultConfig[action];
    this.saveConfigToLocalStorage();
  }

  // Reset all actions to default bindings
  public resetAllToDefaults(): void {
    this.currentConfig = JSON.parse(JSON.stringify(this.defaultConfig));
    this.saveConfigToLocalStorage();
  }

  // Save current configuration to local storage
  private saveConfigToLocalStorage(): void {
    localStorage.setItem('gameInputConfig', JSON.stringify(this.currentConfig));
  }

  // Load configuration from local storage
  public loadConfigFromLocalStorage(): void {
    const savedConfig = localStorage.getItem('gameInputConfig');
    if (savedConfig) {
      this.currentConfig = JSON.parse(savedConfig);
    }
  }

  public getActiveKeys(): Set<string> {
    return this.activeKeys;
  }

  public getCurrentlyPressedActions(exclude = [InputAction.PAUSE, InputAction.PRIMARY_ACTION, InputAction.SECONDARY_ACTION]): InputAction[] {
    const pressedActions: InputAction[] = [];
    for (const action in this.currentConfig) {
      if (exclude.includes(action as InputAction)) {
        continue;
      }
      if (this.isActionActive(action as InputAction)) {
        pressedActions.push(action as InputAction);
      }
    }
    return pressedActions;
  }

  // Cleanup method to remove event listeners
  public dispose(): void {
    this.domElement.removeEventListener('keydown', this.boundKeyDown);
    this.domElement.removeEventListener('keyup', this.boundKeyUp);
    this.domElement.removeEventListener('mousedown', this.boundMouseDown);
    this.domElement.removeEventListener('mouseup', this.boundMouseUp);
    this.domElement.removeEventListener('mousemove', this.boundMouseMove);
  }
}