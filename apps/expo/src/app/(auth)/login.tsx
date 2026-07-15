import { AuthForm } from "@/components/auth/auth-form";
import { AuthScreen } from "@/components/auth/auth-screen";

export default function LoginRoute() {
  return (
    <AuthScreen>
      <AuthForm mode="login" />
    </AuthScreen>
  );
}
