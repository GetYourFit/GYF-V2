import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/password-recovery";

export const metadata: Metadata = { title: "New password · GYF" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
