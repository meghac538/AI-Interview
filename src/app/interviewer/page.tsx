"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InterviewerPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/admin");
  }, [router]);

  return (
    <main className="surface-grid flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Redirecting to admin...</p>
    </main>
  );
}
