import {
  useCallback,
  useEffect,
  type MutableRefObject,
  type RefObject,
} from "react";

export type ActiveDragPointer = {
  element: SVGGElement;
  pointerId: number;
};

type UseEscapeReleaseInteractionArgs = {
  svgRef: RefObject<SVGSVGElement | null>;
  isDragging: boolean;
  activeDragIdRef: MutableRefObject<string | null>;
  activeDragPointerRef: MutableRefObject<ActiveDragPointer | null>;
  resetDragInteraction: () => void;
};

export function useEscapeReleaseInteraction({
  svgRef,
  isDragging,
  activeDragIdRef,
  activeDragPointerRef,
  resetDragInteraction,
}: UseEscapeReleaseInteractionArgs) {
  const clearRepositionDrag = useCallback(
    (target?: SVGGElement | null, pointerId?: number) => {
      if (
        target &&
        pointerId !== undefined &&
        target.hasPointerCapture(pointerId)
      ) {
        target.releasePointerCapture(pointerId);
      }
      activeDragPointerRef.current = null;
      activeDragIdRef.current = null;
      resetDragInteraction();
    },
    [activeDragIdRef, activeDragPointerRef, resetDragInteraction],
  );

  const releaseHeldInteraction = useCallback(() => {
    const activeDrag = activeDragPointerRef.current;
    const hadActiveInteraction =
      activeDragIdRef.current !== null || activeDrag !== null || isDragging;
    if (!hadActiveInteraction) {
      return false;
    }

    clearRepositionDrag(activeDrag?.element, activeDrag?.pointerId);

    const svg = svgRef.current;
    if (svg) {
      const pointerId = activeDrag?.pointerId ?? 1;
      svg.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          button: 0,
          buttons: 0,
        }),
      );
      svg.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 0,
        }),
      );
    }

    return true;
  }, [
    activeDragIdRef,
    activeDragPointerRef,
    clearRepositionDrag,
    isDragging,
    svgRef,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (!releaseHeldInteraction()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [releaseHeldInteraction]);

  return { clearRepositionDrag, releaseHeldInteraction };
}
