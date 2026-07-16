import { useRef } from 'react';
import { useEditorRenderer, EDITOR_WIDTH, EDITOR_HEIGHT } from '@/hooks/useEditorRenderer';

interface EditorCanvasProps {
  worldText: string;
}

export function EditorCanvas({ worldText }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handlers = useEditorRenderer(canvasRef, worldText);

  return (
    <div
      className="editor-canvas-wrap"
      style={{
        aspectRatio: `${EDITOR_WIDTH} / ${EDITOR_HEIGHT}`,
      }}
    >
      <canvas
        ref={canvasRef}
        className="editor-canvas"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: '12px',
        }}
        {...handlers}
      />
    </div>
  );
}
