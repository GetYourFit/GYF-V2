import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { OfflinePill } from "@/components/layout/offline-pill";
import { ToastProvider } from "@/components/ui/toast";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
      <OfflinePill />
    </ToastProvider>
  );
}
