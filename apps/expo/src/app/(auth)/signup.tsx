import { AuthForm } from "@/components/auth/auth-form";
import { AuthScreen } from "@/components/auth/auth-screen";

export default function SignupRoute() {
  return (
    <AuthScreen>
      <AuthForm mode="signup" />
    </AuthScreen>
  );
}
