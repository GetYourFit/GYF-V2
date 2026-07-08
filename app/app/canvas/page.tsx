import type { Metadata } from "next";

import { CanvasExplorer } from "@/components/canvas/canvas-explorer";
import { ToastProvider } from "@/components/ui/toast";

// Deliberately outside the (app) route group: Canvas is a full-bleed,
// chrome-less experience — no top header, no bottom nav. Same URL
// (/canvas), same auth gate (proxy.ts matches by path, not folder), just
// not wrapped in AppShell. ToastProvider is still needed here since
// ItemDetailSheet (rendered by CanvasExplorer) calls useToast().
export const metadata: Metadata = {
  title: "Canvas — GYF",
  description: "Pan the whole collection and dive into similar pieces.",
};

export default function CanvasPage() {
  return (
    <ToastProvider>
      <CanvasExplorer />
    </ToastProvider>
  );
}
