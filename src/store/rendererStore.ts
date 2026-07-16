import { create } from 'zustand';

export interface Camera {
  n: number;
  m: number;
  theta: number;
  zoom: number;
}

export interface JoystickState {
  active: boolean;
  dx: number;
  dy: number;
}

export type SpritePlane = 'xy' | 'xz' | 'yz';

export interface Sprite {
  id: string;
  plane: SpritePlane;
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  texture: HTMLCanvasElement;
}

export type ViewMode = 'camera' | 'camera2' | 'debug';

interface RendererState {
  camera: Camera;
  mode: ViewMode;
  joystick: JoystickState;
  fps: number;
  editorRotateSpeed: number;
  materials: Record<string, string>;
  setCamera: (camera: Partial<Camera>) => void;
  setMode: (mode: ViewMode) => void;
  setJoystick: (joystick: Partial<JoystickState>) => void;
  setFps: (fps: number) => void;
  setEditorRotateSpeed: (speed: number) => void;
  setMaterials: (materials: Record<string, string>) => void;
  addMaterial: (name: string, url: string) => void;
  removeMaterial: (name: string) => void;
}

export const useRendererStore = create<RendererState>((set) => ({
  camera: { n: 0, m: 0, theta: 0, zoom: 1 },
  mode: 'camera2',
  joystick: { active: false, dx: 0, dy: 0 },
  fps: 0,
  editorRotateSpeed: 1,
  materials: {},
  setCamera: (camera) =>
    set((state) => ({ camera: { ...state.camera, ...camera } })),
  setMode: (mode) => set({ mode }),
  setJoystick: (joystick) =>
    set((state) => ({ joystick: { ...state.joystick, ...joystick } })),
  setFps: (fps) => set({ fps }),
  setEditorRotateSpeed: (speed) => set({ editorRotateSpeed: speed }),
  setMaterials: (materials) => set({ materials }),
  addMaterial: (name, url) =>
    set((state) => ({ materials: { ...state.materials, [name]: url } })),
  removeMaterial: (name) =>
    set((state) => {
      const next = { ...state.materials };
      delete next[name];
      return { materials: next };
    }),
}));
