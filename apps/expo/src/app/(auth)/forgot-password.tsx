import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { AuthScreen } from "@/components/auth/auth-screen";

export default function ForgotPasswordRoute() {
  return (
    <AuthScreen>
      <PasswordRecoveryForm />
    </AuthScreen>
  );
}
