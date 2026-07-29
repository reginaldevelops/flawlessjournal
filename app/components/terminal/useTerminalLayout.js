"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePersistentJson } from "../dashboard/hooks";

export const TERMINAL_LAYOUT_KEY = "flawless.terminal.layout";

const DEFAULT_LAYOUT = {
  sidebarWidth: 240,
  rightWidth: 320,
  chartHeight: 520,
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function useTerminalLayout() {
  const [layout, setLayout] = usePersistentJson(TERMINAL_LAYOUT_KEY, DEFAULT_LAYOUT);
  const dragRef = useRef(null);

  const startLeftResize = useCallback(
    (startX) => {
      dragRef.current = {
        kind: "col",
        side: "left",
        startX,
        startSidebar: layout.sidebarWidth ?? DEFAULT_LAYOUT.sidebarWidth,
      };
    },
    [layout.sidebarWidth]
  );

  const startRightResize = useCallback(
    (startX) => {
      dragRef.current = {
        kind: "col",
        side: "right",
        startX,
        startRight: layout.rightWidth ?? DEFAULT_LAYOUT.rightWidth,
      };
    },
    [layout.rightWidth]
  );

  const startChartResize = useCallback(
    (startY) => {
      dragRef.current = {
        kind: "row",
        startY,
        startHeight: layout.chartHeight ?? DEFAULT_LAYOUT.chartHeight,
      };
    },
    [layout.chartHeight]
  );

  useEffect(() => {
    const onMove = (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.kind === "col") {
        const dx = e.clientX - drag.startX;
        if (drag.side === "left") {
          setLayout((prev) => ({
            ...prev,
            sidebarWidth: clamp(drag.startSidebar + dx, 180, 380),
          }));
        } else {
          setLayout((prev) => ({
            ...prev,
            rightWidth: clamp(drag.startRight - dx, 260, 480),
          }));
        }
      } else if (drag.kind === "row") {
        const dy = e.clientY - drag.startY;
        setLayout((prev) => ({
          ...prev,
          chartHeight: clamp(drag.startHeight + dy, 280, 900),
        }));
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setLayout]);

  return {
    sidebarWidth: layout.sidebarWidth ?? DEFAULT_LAYOUT.sidebarWidth,
    rightWidth: layout.rightWidth ?? DEFAULT_LAYOUT.rightWidth,
    chartHeight: layout.chartHeight ?? DEFAULT_LAYOUT.chartHeight,
    startLeftResize,
    startRightResize,
    startChartResize,
  };
}
