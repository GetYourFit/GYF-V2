import { useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@/theme/tokens";
import { panLimit } from "./pan-bounds";

const MIN_SCALE = 0.6;
const MAX_SCALE = 3;

/**
 * Explorable viewport: the collection lives on a canvas the user drags in any
 * direction and pinches to zoom. Double-tap resets. Content is centred, so
 * pan is bounded by however much of it overflows the viewport at the current
 * scale — you can always reach every edge, and never drag it off into nothing.
 */
export function PanZoomCanvas({
  children,
  height,
  width,
}: {
  children: React.ReactNode;
  /** Viewport height — how much of the canvas is visible at once. */
  height: number;
  width: number;
}) {
  const [contentHeight, setContentHeight] = useState(height);

  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const limitX = () => {
    "worklet";
    return panLimit(width, width, scale.value);
  };
  const limitY = () => {
    "worklet";
    return panLimit(height, contentHeight, scale.value);
  };

  const pan = Gesture.Pan()
    // The canvas lives inside a vertically scrolling page. Without this the
    // ScrollView claims every vertical drag and the canvas only ever pans
    // sideways — which reads as "it doesn't move". Requiring a small travel
    // before activating keeps a plain flick scrolling the page as before.
    .activeOffsetX([-6, 6])
    .activeOffsetY([-6, 6])
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = clamp(startX.value + e.translationX, -limitX(), limitX());
      y.value = clamp(startY.value + e.translationY, -limitY(), limitY());
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = clamp(startScale.value * e.scale, MIN_SCALE, MAX_SCALE);
      x.value = clamp(x.value, -limitX(), limitX());
      y.value = clamp(y.value, -limitY(), limitY());
    });

  const reset = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const spec = { duration: motion.standard, easing: Easing.out(Easing.cubic) };
      scale.value = withTiming(1, spec);
      x.value = withTiming(0, spec);
      y.value = withTiming(0, spec);
    });

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(Gesture.Exclusive(reset, pan), pinch)}>
      <View
        accessibilityHint="Drag to explore the collection, pinch to zoom, double-tap to reset."
        style={{ height, overflow: "hidden", width }}
      >
        <Animated.View
          onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
          style={[{ width }, canvasStyle]}
        >
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
