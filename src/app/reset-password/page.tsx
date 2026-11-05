import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout, HIDE_WITH_CODE } from "@/components/auth/auth-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <h1 className={`mb-4 text-xl font-semibold ${HIDE_WITH_CODE}`}>Reset password</h1>
      <ResetPasswordForm />
      <p className={`mt-6 text-center text-sm ${HIDE_WITH_CODE}`}>
        <Link
          href="/login"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
