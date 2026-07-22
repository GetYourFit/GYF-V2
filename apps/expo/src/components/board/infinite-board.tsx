import { useEffect, useMemo, useRef } from "react";
import { Platform, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  clamp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { MAX_SCALE, MIN_SCALE, zoomByWheel } from "@/components/grid/pan-bounds";
import { motion } from "@/theme/tokens";
import { layoutBoard, wrap, type BoardTile } from "./board-layout";

/**
 * The lattice is 3×3 so a full block always exists beyond every edge of the
 * viewport, in all four directions, at any wrap offset.
 *
 * ponytail: 3×3 mounts nine copies of the block. Keep the block near one
 * screen of tiles and it stays smooth; if low-end Android janks when zoomed
 * out, cull to the cells the viewport actually intersects.
 */
const LATTICE = [-1, 0, 1] as const;

/** How long the user must hold before a tile pops out. */
export const LONG_PRESS_MS = 2000;

export function InfiniteBoard<T extends { id: string }>({
  columns,
  columnWidth,
  gap,
  height,
  items,
  onPressTile,
  onHoldProgress,
  onHoldTile,
  renderTile,
  width,
}: {
  columns: number;
  columnWidth: number;
  gap: number;
  height: number;
  items: readonly T[];
  onPressTile: (item: T) => void;
  /** 0→1 while a hold is building, so the caller can blur/scale in step. */
  onHoldProgress?: (progress: number) => void;
  onHoldTile: (item: T) => void;
  renderTile: (tile: BoardTile<T>) => React.ReactNode;
  width: number;
}) {
  const block = useMemo(
    () => layoutBoard(items, columns, columnWidth, gap),
    [columns, columnWidth, gap, items],
  );

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);

  // Unbounded: there is no edge to hit, so nothing is clamped but the zoom.
  const pan = Gesture.Pan()
    .minDistance(2)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((event) => {
      // Divide by scale so a finger travels the same screen distance whatever
      // the zoom — otherwise zoomed-out drags feel glued and zoomed-in ones fly.
      x.value = startX.value + event.translationX / scale.value;
      y.value = startY.value + event.translationY / scale.value;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = clamp(startScale.value * event.scale, MIN_SCALE, MAX_SCALE);
    });

  const reset = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const spec = { duration: motion.standard, easing: Easing.out(Easing.cubic) };
      scale.value = withTiming(1, spec);
    });

  const viewport = useRef<View>(null);
  useEffect(() => {
    const node = viewport.current as unknown as HTMLElement | null;
    if (Platform.OS !== "web" || !node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      scale.value = zoomByWheel(scale.value, event.deltaY);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [scale]);

  // Zoom pivots on the viewport centre, then the wrapped offset slides the
  // lattice underneath. Order matters: scale first, or the wrap would be
  // measured in unscaled units and drift.
  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: wrap(x.value, block.width) - block.width },
      { translateY: wrap(y.value, block.height) - block.height },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch, reset)}>
      <View
        accessibilityHint="Drag in any direction to explore. Pinch to zoom. Tap a piece for similar, hold it for details."
        ref={viewport}
        style={{ height, overflow: "hidden", width }}
      >
        <Animated.View style={[{ height, width }, canvasStyle]}>
          {LATTICE.map((row) =>
            LATTICE.map((column) => (
              <View
                key={`${row}:${column}`}
                style={{
                  left: (column + 1) * block.width,
                  position: "absolute",
                  top: (row + 1) * block.height,
                }}
              >
                <BoardBlockTiles
                  latticeKey={`${row}:${column}`}
                  onHoldProgress={onHoldProgress}
                  onHoldTile={onHoldTile}
                  onPressTile={onPressTile}
                  renderTile={renderTile}
                  tiles={block.tiles}
                />
              </View>
            )),
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function BoardBlockTiles<T extends { id: string }>({
  latticeKey,
  onHoldProgress,
  onHoldTile,
  onPressTile,
  renderTile,
  tiles,
}: {
  latticeKey: string;
  onHoldProgress?: (progress: number) => void;
  onHoldTile: (item: T) => void;
  onPressTile: (item: T) => void;
  renderTile: (tile: BoardTile<T>) => React.ReactNode;
  tiles: BoardTile<T>[];
}) {
  return (
    <>
      {tiles.map((tile) => (
        <BoardTileView
          key={`${latticeKey}:${tile.item.id}`}
          onHoldProgress={onHoldProgress}
          onHoldTile={onHoldTile}
          onPressTile={onPressTile}
          renderTile={renderTile}
          tile={tile}
        />
      ))}
    </>
  );
}

function BoardTileView<T extends { id: string }>({
  onHoldProgress,
  onHoldTile,
  onPressTile,
  renderTile,
  tile,
}: {
  onHoldProgress?: (progress: number) => void;
  onHoldTile: (item: T) => void;
  onPressTile: (item: T) => void;
  renderTile: (tile: BoardTile<T>) => React.ReactNode;
  tile: BoardTile<T>;
}) {
  const hold = useSharedValue(0);

  // A silent two-second hold reads as a broken tile. The lift starts within a
  // frame or two and runs the full duration, so the gesture is visibly
  // building the whole time it is being held.
  const press = Gesture.LongPress()
    .minDuration(LONG_PRESS_MS)
    .onBegin(() => {
      hold.value = withTiming(1, { duration: LONG_PRESS_MS, easing: Easing.out(Easing.quad) });
      if (onHoldProgress) runOnJS(onHoldProgress)(1);
    })
    .onStart(() => {
      runOnJS(onHoldTile)(tile.item);
    })
    .onFinalize(() => {
      hold.value = withTiming(0, { duration: motion.fast });
      if (onHoldProgress) runOnJS(onHoldProgress)(0);
    });

  const tap = Gesture.Tap()
    .maxDuration(400)
    .onEnd(() => {
      runOnJS(onPressTile)(tile.item);
    });

  const style = useAnimatedStyle(() => ({
    opacity: 1 - hold.value * 0.15,
    transform: [{ scale: 1 + hold.value * 0.06 }],
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(press, tap)}>
      <Animated.View
        style={[
          {
            height: tile.height,
            left: tile.x,
            position: "absolute",
            top: tile.y,
            width: tile.width,
          },
          style,
        ]}
      >
        {renderTile(tile)}
      </Animated.View>
    </GestureDetector>
  );
}
