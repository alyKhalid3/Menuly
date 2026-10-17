import { signIn } from "@/actions/auth";
import { AuthForm } from "../auth-form";

export default function LoginPage() {
  return <AuthForm action={signIn} submitLabel="Log in" />;
}
