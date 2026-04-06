"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { type Doc } from "convex/_generated/dataModel";
import { PencilIcon } from "lucide-react";
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
import { FieldError, FieldGroup } from "@/components/ui/field";
import {
  ActiveUntilField,
  formatActiveUntil,
  getActiveUntilErrorMessages,
} from "@/app/admin/users/active-until-field";

const editUserSchema = z.object({
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

  return "Could not update user.";
}

type EditUserDialogProps = {
  user: Doc<"users">;
};

export function EditUserDialog({ user }: EditUserDialogProps) {
  const updateUserActiveUntil = useMutation(api.admin.updateUserActiveUntil);
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      activeUntil: user.activeUntil ?? null,
    },
    validators: {
      onSubmit: editUserSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        await updateUserActiveUntil({
          userId: user._id,
          activeUntil: value.activeUntil,
        });
        toast.success(`Updated ${user.username}.`, {
          description: `Active until: ${formatActiveUntil(value.activeUntil)}.`,
        });
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
        setSubmitError(null);
        form.reset({
          activeUntil: user.activeUntil ?? null,
        });
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <PencilIcon className="size-4" />
        Edit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update the access expiry for {user.username}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <FieldGroup>
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
                    description="Optional. Leave empty for no expiry, or pick a date to keep access through that day."
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
                    {isSubmitting ? "Saving…" : "Save"}
                  </Button>
                </>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
