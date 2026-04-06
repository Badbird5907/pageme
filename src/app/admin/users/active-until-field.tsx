"use client";

import { endOfDay, format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ActiveUntilFieldProps = {
  description: string;
  errors: readonly string[];
  isInvalid: boolean;
  name: string;
  onBlur: () => void;
  onChange: (value: number | null) => void;
  value: number | null;
};

export function getActiveUntilErrorMessages(errors: readonly unknown[]) {
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

export function formatActiveUntil(value: number | null | undefined) {
  if (!value) {
    return "No expiry";
  }

  return format(new Date(value), "PPP");
}

export function ActiveUntilField({
  description,
  errors,
  isInvalid,
  name,
  onBlur,
  onChange,
  value,
}: ActiveUntilFieldProps) {
  const date = value ? new Date(value) : undefined;

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={name}>Active Until</FieldLabel>
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
          aria-label="Clear active until date"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
      <FieldDescription>{description}</FieldDescription>
      {isInvalid && errors.length ? <FieldError>{errors[0]}</FieldError> : null}
    </Field>
  );
}
