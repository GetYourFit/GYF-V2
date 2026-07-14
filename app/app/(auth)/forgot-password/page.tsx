import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/password-recovery";

export const metadata: Metadata = { title: "Reset password · GYF" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
