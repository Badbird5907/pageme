"use client";

import { useForm, useStore } from "@tanstack/react-form";
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

const PIN_LENGTH = 6;
const PIN_INPUT_PATTERN = "^[A-Z0-9]+$";

const usernameOnlySchema = z
  .string()
  .trim()
  .min(1, "Username is required.");

const loginFormSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  pin: z
    .string()
    .regex(/^[A-Z0-9]{6}$/, "PIN must be 6 uppercase letters or numbers."),
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
  const [usernameStepError, setUsernameStepError] = useState<string | null>(
    null,
  );
  const [step, setStep] = useState<"username" | "pin">("username");

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

  const usernameDisplay = useStore(
    form.store,
    (s) => s.values.username.trim(),
  );

  function proceedToPin() {
    setSubmitError(null);
    const raw = form.store.state.values.username;
    const parsed = usernameOnlySchema.safeParse(raw);
    if (!parsed.success) {
      const msg =
        parsed.error.flatten().formErrors[0] ?? "Username is required.";
      setUsernameStepError(msg);
      return;
    }
    setUsernameStepError(null);
    form.setFieldValue("username", parsed.data);
    setStep("pin");
  }

  function goBackToUsername() {
    setSubmitError(null);
    setUsernameStepError(null);
    form.setFieldValue("pin", "");
    setStep("username");
  }

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
        if (step === "username") {
          proceedToPin();
          return;
        }
        void form.handleSubmit();
      }}
      className="flex w-full flex-col gap-4"
    >
      <FieldGroup>
        {step === "username" ? (
          <form.Field name="username">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              const errors = getErrorMessages(field.state.meta.errors);
              const showStepError = Boolean(usernameStepError);

              return (
                <Field data-invalid={isInvalid || showStepError}>
                  <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    autoComplete="username"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      setSubmitError(null);
                      setUsernameStepError(null);
                      field.handleChange(e.target.value);
                    }}
                    aria-invalid={isInvalid || showStepError}
                  />
                  {isInvalid && errors.length ? (
                    <FieldError>{errors[0]}</FieldError>
                  ) : null}
                  {showStepError ? (
                    <FieldError role="alert">{usernameStepError}</FieldError>
                  ) : null}
                </Field>
              );
            }}
          </form.Field>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Signing in as{" "}
                <span className="font-medium text-foreground">
                  {usernameDisplay || "—"}
                </span>
              </p>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={goBackToUsername}
              >
                Change username
              </Button>
            </div>

            <form.Field name="pin">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                const errors = getErrorMessages(field.state.meta.errors);

                return (
                  <Field data-invalid={isInvalid}>
                    {/* <FieldLabel htmlFor={field.name}>PIN</FieldLabel> */}
                    <InputOTP
                      id={field.name}
                      maxLength={PIN_LENGTH}
                      pattern={PIN_INPUT_PATTERN}
                      inputMode="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(value) => {
                        setSubmitError(null);
                        field.handleChange(value.toUpperCase());
                      }}
                      containerClassName="justify-center"
                      aria-invalid={isInvalid}
                    >
                      <InputOTPGroup
                        className={cn(
                          isInvalid &&
                            "border-destructive ring-3 ring-destructive/20 dark:ring-destructive/40",
                        )}
                      >
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup
                        className={cn(
                          isInvalid &&
                            "border-destructive ring-3 ring-destructive/20 dark:ring-destructive/40",
                        )}
                      >
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                    {/* <FieldDescription>
                      Enter the 6-character PIN for your account.
                    </FieldDescription> */}
                    {isInvalid && errors.length ? (
                      <FieldError>{errors[0]}</FieldError>
                    ) : null}
                  </Field>
                );
              }}
            </form.Field>
          </>
        )}
      </FieldGroup>

      {submitError ? (
        <FieldError role="alert">{submitError}</FieldError>
      ) : null}

      <form.Subscribe
        selector={(state) =>
          [state.canSubmit, state.isSubmitting] as const
        }
      >
        {([canSubmit, isSubmitting]) =>
          step === "username" ? (
            <Button
              type="submit"
              disabled={isLoading || isSubmitting}
              className="mt-1 h-11 w-full"
            >
              Sign in
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isLoading || isSubmitting || !canSubmit}
              className="mt-1 h-11 w-full"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          )
        }
      </form.Subscribe>
    </form>
  );
}
