"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  ActiveUntilField,
  getActiveUntilErrorMessages,
} from "@/app/admin/users/active-until-field";
import { cn } from "@/lib/utils";

const PIN_LENGTH = 6;
const PIN_INPUT_PATTERN = "^[A-Z0-9]+$";
const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateAlphanumericPin(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += ALPHANUMERIC[bytes[i]! % ALPHANUMERIC.length];
  }
  return result;
}

const addUserSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  pin: z
    .string()
    .regex(/^[A-Z0-9]{6}$/, "PIN must be 6 uppercase letters or numbers."),
  activeUntil: z.number().nullable(),
});

function getErrorMessage(error: unknown): string {
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

  return "Could not create user.";
}

function getErrorMessages(errors: readonly unknown[]) {
  return [...new Set(errors.map(getErrorMessage))];
}

export const AddUserDialog = () => {
  const createUser = useMutation(api.admin.createUser);
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      username: "",
      pin: "",
      activeUntil: null as number | null,
    },
    validators: {
      onSubmit: addUserSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        await createUser({
          username: value.username.trim(),
          pin: value.pin,
          activeUntil: value.activeUntil,
        });
        toast.success(`Created ${value.username.trim()}.`);
        form.reset();
        setOpen(false);
      } catch (error) {
        const message = getErrorMessage(error);
        setSubmitError(message);
        toast.error(message);
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSubmitError(null);
          form.reset();
        } else {
          form.setFieldValue("pin", generateAlphanumericPin(PIN_LENGTH));
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon className="size-4" />
        Add User
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>
            Create a new pager account with a username and PIN.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-4"
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
                      This is the username the person will use to sign in.
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
                    <FieldDescription>
                      The user will need this PIN to access the app.
                    </FieldDescription>
                    {isInvalid && errors.length ? (
                      <FieldError>{errors[0]}</FieldError>
                    ) : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="activeUntil">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                const errors = getActiveUntilErrorMessages(
                  field.state.meta.errors,
                );

                return (
                  <ActiveUntilField
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(value) => {
                      setSubmitError(null);
                      field.handleChange(value);
                    }}
                    isInvalid={isInvalid}
                    errors={errors}
                    description="Optional. Access will remain valid through the end of the selected day."
                  />
                );
              }}
            </form.Field>
          </FieldGroup>

          {submitError ? <FieldError role="alert">{submitError}</FieldError> : null}

          <DialogFooter>
            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isPristine, state.isSubmitting] as const
              }
            >
              {([canSubmit, isPristine, isSubmitting]) => (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canSubmit || isPristine || isSubmitting}
                  >
                    {isSubmitting ? "Creating…" : "Create User"}
                  </Button>
                </>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
