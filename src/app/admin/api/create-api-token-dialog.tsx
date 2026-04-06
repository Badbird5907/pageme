"use client";

import { useState } from "react";
import { endOfDay, format } from "date-fns";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { z } from "zod";
import { CalendarIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const createApiTokenSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  expiresAt: z.number().nullable(),
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

  return "Could not create API token.";
}

function getErrorMessages(errors: readonly unknown[]) {
  return [...new Set(errors.map(getErrorMessage))];
}

function getExpiresAtErrorMessages(errors: readonly unknown[]) {
  return errors
    .map((error) => {
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
    })
    .filter((message, index, messages): message is string => {
      return message !== null && messages.indexOf(message) === index;
    });
}

type ExpiresAtFieldProps = {
  description: string;
  errors: readonly string[];
  isInvalid: boolean;
  name: string;
  onBlur: () => void;
  onChange: (value: number | null) => void;
  value: number | null;
};

function ExpiresAtField({
  description,
  errors,
  isInvalid,
  name,
  onBlur,
  onChange,
  value,
}: ExpiresAtFieldProps) {
  const date = value ? new Date(value) : undefined;

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={name}>Expires At</FieldLabel>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                id={name}
                variant="outline"
                type="button"
                className={cn(
                  "w-full justify-between text-left font-normal",
                  !date && "text-muted-foreground",
                  isInvalid &&
                    "border-destructive ring-3 ring-destructive/20 dark:ring-destructive/40",
                )}
                aria-invalid={isInvalid}
              />
            }
            onBlur={onBlur}
          >
            <span>{date ? format(date, "PPP") : "No expiry"}</span>
            <CalendarIcon className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              defaultMonth={date}
              onSelect={(nextDate) => {
                onChange(nextDate ? endOfDay(nextDate).getTime() : null);
              }}
            />
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(null)}
          disabled={value === null}
          aria-label="Clear expiry date"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
      <FieldDescription>{description}</FieldDescription>
      {isInvalid && errors.length ? <FieldError>{errors[0]}</FieldError> : null}
    </Field>
  );
}

export function CreateAPITokenDialog() {
  const createToken = useMutation(api.apitokens.createAPIToken);
  const [open, setOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const copyTokenToClipboard = async (token: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(token);
      return true;
    } catch {
      return false;
    }
  };

  const form = useForm({
    defaultValues: {
      name: "",
      expiresAt: null as number | null,
    },
    validators: {
      onSubmit: createApiTokenSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        const result = await createToken({
          name: value.name.trim(),
          ...(value.expiresAt === null ? {} : { expiresAt: value.expiresAt }),
        });

        const copied = await copyTokenToClipboard(result.token);
        setCreatedToken(result.token);

        toast.success(`Created ${value.name.trim()}.`, {
          description: copied
            ? "API token copied to clipboard."
            : "Copy and store the token now. You will not be able to see it again.",
        });
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
          setCreatedToken(null);
          setSubmitError(null);
          form.reset();
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon className="size-4" />
        Create API Token
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Token</DialogTitle>
          <DialogDescription>
            {createdToken
              ? "Store this token now. It will not be shown again."
              : "Create a named API token for external integrations."}
          </DialogDescription>
        </DialogHeader>

        {createdToken ? (
          <>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="created-api-token">API Token</FieldLabel>
                <Input id="created-api-token" value={createdToken} readOnly />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void copyTokenToClipboard(createdToken).then((copied) => {
                    if (copied) {
                      toast.success("API token copied to clipboard.");
                    } else {
                      toast.error("Could not copy API token.");
                    }
                  });
                }}
              >
                Copy Token
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setCreatedToken(null);
                  setSubmitError(null);
                  form.reset();
                  setOpen(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
            className="space-y-4"
          >
            <FieldGroup>
              <form.Field name="name">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  const errors = getErrorMessages(field.state.meta.errors);

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          setSubmitError(null);
                          field.handleChange(event.target.value);
                        }}
                        aria-invalid={isInvalid}
                      />
                      <FieldDescription>
                        Use a descriptive name so you can identify this token later.
                      </FieldDescription>
                      {isInvalid && errors.length ? (
                        <FieldError>{errors[0]}</FieldError>
                      ) : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="expiresAt">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  const errors = getExpiresAtErrorMessages(field.state.meta.errors);

                  return (
                    <ExpiresAtField
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(value) => {
                        setSubmitError(null);
                        field.handleChange(value);
                      }}
                      isInvalid={isInvalid}
                      errors={errors}
                      description="Optional. The token will remain valid through the end of the selected day."
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
                      {isSubmitting ? "Creating…" : "Create API Token"}
                    </Button>
                  </>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
