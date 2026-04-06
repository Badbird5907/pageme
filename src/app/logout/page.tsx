"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

function LogoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();

  const redirectTo = safeRedirectPath(searchParams.get("redirect"));
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await logout();
        if (!cancelled) {
          setStatus("done");
          router.replace(redirectTo);
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Could not sign out. Try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logout, redirectTo, router]);

  return (
    <div className="text-center">
      {status === "error" ? (
        <>
          <p className="text-sm text-destructive" role="alert">
            {message}
          </p>
          <Button
            type="button"
            className="mt-4 w-full"
            onClick={() => {
              setStatus("working");
              void (async () => {
                try {
                  await logout();
                  setStatus("done");
                  router.replace(redirectTo);
                } catch {
                  setStatus("error");
                  setMessage("Could not sign out. Try again.");
                }
              })();
            }}
          >
            Try again
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {status === "done" ? "Redirecting…" : "Signing out…"}
        </p>
      )}
    </div>
  );
}

export default function LogoutPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-muted/30 px-4 py-16 dark:bg-black">
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="text-center">
          <CardTitle>Sign out</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <p className="text-center text-sm text-muted-foreground">
                Loading…
              </p>
            }
          >
            <LogoutContent />
          </Suspense>
        </CardContent>
        <CardFooter className="justify-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className={buttonVariants({ variant: "link" })}>
            Home
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Link href="/login" className={buttonVariants({ variant: "link" })}>
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
