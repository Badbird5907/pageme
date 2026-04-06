"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const loginFormSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  pin: z.string().min(1, "PIN is required."),
});

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

function getErrorMessage(error: unknown): string | null {
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
}

function getErrorMessages(errors: readonly unknown[]) {
  return [...new Set(errors.map(getErrorMessage).filter((error) => !!error))];
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading, isAuthenticated, login } = useAuth();

  const redirectTo = safeRedirectPath(searchParams.get("redirect"));
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isLoading, isAuthenticated, router, redirectTo]);

  const form = useForm({
    defaultValues: {
      username: "",
      pin: "",
    },
    validators: {
      onSubmit: loginFormSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        await login(value.username.trim(), value.pin);
        router.replace(redirectTo);
      } catch {
        setSubmitError("Could not sign in. Check your username and PIN.");
      }
    },
  });

  if (!isLoading && isAuthenticated) {
    return (
      <p className="text-center text-sm text-muted-foreground">Redirecting…</p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="flex w-full flex-col gap-4"
    >
      <FieldGroup>
        <form.Field name="username">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            const errors = getErrorMessages(field.state.meta.errors);

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  autoComplete="username"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    setSubmitError(null);
                    field.handleChange(e.target.value);
                  }}
                  aria-invalid={isInvalid}
                />
                <FieldDescription>
                  Use the username tied to your pager account.
                </FieldDescription>
                {isInvalid && errors.length ? (
                  <FieldError>{errors[0]}</FieldError>
                ) : null}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="pin">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            const errors = getErrorMessages(field.state.meta.errors);

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>PIN</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="current-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    setSubmitError(null);
                    field.handleChange(e.target.value);
                  }}
                  aria-invalid={isInvalid}
                />
                <FieldDescription>
                  Enter the PIN associated with your account.
                </FieldDescription>
                {isInvalid && errors.length ? (
                  <FieldError>{errors[0]}</FieldError>
                ) : null}
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>

      {submitError ? (
        <FieldError role="alert">{submitError}</FieldError>
      ) : null}

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            disabled={isLoading || isSubmitting || !canSubmit}
            className="mt-1 h-11 w-full"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
