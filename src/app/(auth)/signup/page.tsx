import { signUp } from "@/actions/auth";
import { AuthForm } from "../auth-form";

export default function SignUpPage() {
  return <AuthForm action={signUp} submitLabel="Create account" />;
}
