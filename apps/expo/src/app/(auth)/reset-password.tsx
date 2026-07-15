import { AuthScreen } from "@/components/auth/auth-screen";
import { ResetPasswordForm } from "@/components/auth/password-recovery-form";

export default function ResetPasswordRoute() {
  return (
    <AuthScreen>
      <ResetPasswordForm />
    </AuthScreen>
  );
}
