"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { selfEnroll } from "@/features/academics/enrollment-actions";

export function SelfEnrollButton({ classId, className }: { classId: string; className: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      variant="default"
      run={() => selfEnroll({ classId })}
      label="Enroll"
      title={`Enroll in ${className}?`}
      description="You'll get access to the class right away."
      confirmLabel="Enroll"
      onSuccess={() => router.push(`/learn/classes/${classId}`)}
    />
  );
}
