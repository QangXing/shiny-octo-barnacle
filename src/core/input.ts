import type { JoystickState } from '@/store/rendererStore';
import {
  JOYSTICK_RADIUS,
  JOYSTICK_DEADZONE,
  ROTATE_SPEED,
} from './config';

export interface PointerState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  role: 'joystick' | 'rotate';
  rotateDelta?: number;
}

export interface PointerHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLCanvasElement>) => void;
}

export interface InputContext {
  pointerRef: React.MutableRefObject<PointerState | null>;
  joystickCenterRef: React.MutableRefObject<{ x: number; y: number }>;
  setJoystick: (joystick: Partial<JoystickState>) => void;
  getCanvas: () => HTMLCanvasElement | null;
  rotateSpeedMultiplier?: number | (() => number);
}

export function createPointerHandlers(
  ctx: InputContext,
): PointerHandlers {
  const { pointerRef, joystickCenterRef, setJoystick, getCanvas } = ctx;

  const classifyPointer = (x: number, y: number, width: number, height: number): 'joystick' | 'rotate' => {
    const center = joystickCenterRef.current;
    const dx = x - center.x;
    const dy = y - center.y;
    // 左下角圆形区域优先判定为摇杆
    if (Math.hypot(dx, dy) < 90 || (x < 160 && y > height - 160)) {
      return 'joystick';
    }
    return 'rotate';
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    const role = classifyPointer(x, y, width, height);
    pointerRef.current = {
      id: e.pointerId,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      role,
    };

    if (role === 'joystick') {
      setJoystick({ active: true, dx: 0, dy: 0 });
    }
    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ptr = pointerRef.current;
    if (!ptr || ptr.id !== e.pointerId) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (ptr.role === 'joystick') {
      const center = joystickCenterRef.current;
      let dx = x - center.x;
      let dy = y - center.y;
      const dist = Math.hypot(dx, dy);
      if (dist > JOYSTICK_RADIUS) {
        dx = (dx / dist) * JOYSTICK_RADIUS;
        dy = (dy / dist) * JOYSTICK_RADIUS;
      }
      setJoystick({
        active: true,
        dx: dx / JOYSTICK_RADIUS,
        dy: dy / JOYSTICK_RADIUS,
      });
    } else if (ptr.role === 'rotate') {
      const deltaX = x - ptr.lastX;
      const multiplier =
        typeof ctx.rotateSpeedMultiplier === 'function'
          ? ctx.rotateSpeedMultiplier()
          : (ctx.rotateSpeedMultiplier ?? 1);
      ptr.rotateDelta = (ptr.rotateDelta ?? 0) + deltaX * ROTATE_SPEED * multiplier;
    }

    ptr.lastX = x;
    ptr.lastY = y;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ptr = pointerRef.current;
    if (!ptr || ptr.id !== e.pointerId) return;
    if (ptr.role === 'joystick') {
      setJoystick({ active: false, dx: 0, dy: 0 });
    }
    pointerRef.current = null;
  };

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    onPointerLeave: handlePointerUp,
  };
}

export function subscribeKeyboard(
  keysRef: React.MutableRefObject<Record<string, boolean>>,
): () => void {
  const down = (e: KeyboardEvent) => {
    keysRef.current[e.key.toLowerCase()] = true;
  };
  const up = (e: KeyboardEvent) => {
    keysRef.current[e.key.toLowerCase()] = false;
  };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}

export function normalizeJoystick(dx: number, dy: number): { dx: number; dy: number; active: boolean } {
  const len = Math.hypot(dx, dy);
  if (len < JOYSTICK_DEADZONE) {
    return { dx: 0, dy: 0, active: true };
  }
  const scale = Math.min(len, 1) / len;
  return { dx: dx * scale, dy: dy * scale, active: true };
}
