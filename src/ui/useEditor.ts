import { useMemo, useReducer, useRef } from 'react';
import {
  type Board,
  blowOverdrivenLeds,
  type Build,
  BuildEditor,
  type Edit,
  type EditResult,
} from '../core/build';
import type { PartAllowance } from '../core/levels';

/** A BuildEditor whose changes re-render the component that holds it. */
export function useEditor(board: Board, tray: readonly PartAllowance[], initial: Build) {
  const editor = useMemo(
    () => new BuildEditor(board, tray, initial, (build) => blowOverdrivenLeds(board, build)),
    [board, tray, initial],
  );
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const nextId = useRef(0);

  return {
    editor,
    build: editor.build,
    newId: (kind: string) => `${kind}-${nextId.current++}`,
    apply: (edit: Edit): EditResult => {
      const result = editor.apply(edit);
      rerender();
      return result;
    },
    setControl: (id: string, on: boolean) => {
      editor.setControl(id, on);
      rerender();
    },
    setLight: (id: string, light: number) => {
      editor.setLight(id, light);
      rerender();
    },
    setVolts: (id: string, volts: number) => {
      editor.setVolts(id, volts);
      rerender();
    },
    undo: () => {
      editor.undo();
      rerender();
    },
    redo: () => {
      editor.redo();
      rerender();
    },
  };
}

export type EditorHandle = ReturnType<typeof useEditor>;
