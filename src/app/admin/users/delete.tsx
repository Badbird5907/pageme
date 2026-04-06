"use client";

import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TrashIcon } from "lucide-react";
import { toast } from "sonner";

type DeleteUserDialogProps = {
  userId: Id<"users">;
};

export function DeleteUserDialog({ userId }: DeleteUserDialogProps) {
  const deleteUser = useMutation(api.admin.deleteUser);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" />}>
        <TrashIcon className="size-4" />
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Are you sure you want to delete this user?
        </DialogDescription>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => deleteUser({ userId }).then(() => {
              toast.success(`Deleted user ${userId}.`);
            }).catch((error) => {
              const message = error instanceof Error ? error.message : "Unknown error";
              toast.error(`Failed to delete user ${userId}.`, {
                description: message,
              });
            })}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
