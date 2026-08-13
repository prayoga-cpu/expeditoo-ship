"use client";

import { Suspense } from "react";
import { JobBoard } from "@/features/app/home/ui";
import { PageLoader } from "@/components/ui/page-loader";

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <JobBoard />
    </Suspense>
  );
}
