import type { Metadata } from "next";

import { CanvasExplorer } from "@/components/canvas/canvas-explorer";

export const metadata: Metadata = {
  title: "Canvas — GYF",
  description: "Pan the whole collection and dive into similar pieces.",
};

export default function CanvasPage() {
  return <CanvasExplorer />;
}
