"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True while a file is dragged over the page; dropping it calls `onFile`.
 * A depth counter keeps the state steady when the pointer travels between child elements,
 * and the whole thing stays off while `enabled` is false — an open dialog handles its own drop.
 */
export function useFileDrop(enabled: boolean, onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const handler = useRef(onFile);

  useEffect(() => {
    handler.current = onFile;
  });

  useEffect(() => {
    if (!enabled) return;
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const leave = () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) handler.current(file);
    };

    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      depth.current = 0;
      setDragging(false);
    };
  }, [enabled]);

  return dragging;
}
