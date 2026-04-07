"use client";

import { useAction, useQuery } from "convex/react";
import {
  CheckCircle2Icon,
  Loader2Icon,
  SendHorizontalIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Something went wrong. Try again.";
}

export default function Page() {
  const sendPage = useAction(api.pager.sendPage);
  const amIMuted = useQuery(api.pager.amIMuted);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didSucceed, setDidSucceed] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);

  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && !isSubmitting;

  const submit = useCallback(async () => {
    if (!canSend) return;

    setError(null);
    setDidSucceed(false);
    setIsSubmitting(true);
    setOpenConfirm(false);

    try {
      await sendPage({ message: trimmed });
      setMessage("");
      setDidSucceed(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [canSend, sendPage, trimmed]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:py-16">
      <Card className="shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg tracking-tight">Send a page</CardTitle>
          <CardDescription>
            <span className="text-red-500 font-bold">
              Seriously only use this when you need to get ahold of me RIGHT
              NOW.
            </span>{" "}
            This will make my phone ring{" "}
            <span className="font-bold">VERY LOUDLY</span> and disturb everyone
            in a 100m range.
            {error ? (
              <FieldError id="page-message-error" role="alert" className="mt-4">
                {error}
              </FieldError>
            ) : null}
            {didSucceed ? (
              <div
                role="status"
                className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm"
              >
                <CheckCircle2Icon
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden
                />
                <span>Your page was queued. Please do not spam this</span>
              </div>
            ) : null}
            {amIMuted ? (
              <div
                role="status"
                className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm"
              >
                <span>You are muted. You cannot send pages.</span>
              </div>
            ) : null}
          </CardDescription>
        </CardHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpenConfirm(true);
          }}
        >
          <CardContent>
            <FieldGroup className="gap-1 pb-4">
              <Field>
                <FieldLabel htmlFor="page-message">Message</FieldLabel>
                <Textarea
                  id="page-message"
                  name="message"
                  value={message}
                  rows={5}
                  placeholder="Check discord right now..."
                  disabled={isSubmitting || amIMuted}
                  className="min-h-12 resize-y"
                  onChange={(e) => {
                    setError(null);
                    setDidSucceed(false);
                    setMessage(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.metaKey || e.ctrlKey) &&
                      canSend
                    ) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  aria-invalid={!!error}
                  aria-describedby={
                    error
                      ? "page-message-hint page-message-error"
                      : "page-message-hint"
                  }
                />
              </Field>
              <FieldDescription>Keep this short</FieldDescription>
            </FieldGroup>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              disabled={!canSend || amIMuted}
              size="lg"
              className="w-full gap-2"
              type="submit"
            >
              {amIMuted ? "You are muted" : (
                isSubmitting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  <>
                    <SendHorizontalIcon className="size-4" aria-hidden />
                    Send page
                  </>
                )
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>Like 10000% sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()}>Yes I am 10000% sure</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
