import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthLayout, HIDE_WITH_CODE } from "@/components/auth/auth-layout";
import { CreateAccountForm } from "@/components/auth/create-account-form";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthLayout>
      <Tabs defaultValue="sign-in">
        <TabsList className={`w-full ${HIDE_WITH_CODE}`}>
          <TabsTrigger value="sign-in">Sign in</TabsTrigger>
          <TabsTrigger value="create">Create account</TabsTrigger>
        </TabsList>
        {/* The forms read ?next=, which makes them dynamic; the page around them stays static. */}
        <Suspense>
          <TabsContent value="sign-in" className="pt-4 group-has-[[data-recovery-code]]/auth:pt-0">
            <SignInForm />
          </TabsContent>
          <TabsContent value="create" className="pt-4 group-has-[[data-recovery-code]]/auth:pt-0">
            <CreateAccountForm />
          </TabsContent>
        </Suspense>
      </Tabs>
      <p className={`mt-6 text-center text-sm ${HIDE_WITH_CODE}`}>
        <Link
          href="/reset-password"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Forgot password?
        </Link>
      </p>
      <p className={`mt-3 text-center text-xs ${HIDE_WITH_CODE}`}>
        <Link
          href="/privacy?from=login"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Privacy Policy
        </Link>
      </p>
    </AuthLayout>
  );
}
