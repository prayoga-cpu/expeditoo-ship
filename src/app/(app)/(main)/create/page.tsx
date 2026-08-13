"use client";

import { Suspense } from "react";
import { JobForm } from "@/features/app/create/ui";
import { useJobForm } from "@/features/app/create/hooks";
import { PageLoader } from "@/components/ui/page-loader";

function CreateContent() {
  const jobForm = useJobForm();
  return <JobForm {...jobForm} />;
}

export default function CreatePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CreateContent />
    </Suspense>
  );
}
