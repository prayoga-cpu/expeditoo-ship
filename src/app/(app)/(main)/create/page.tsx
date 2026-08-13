"use client";

import { Suspense } from "react";
import { Create } from "@/features/app/create/ui";
import { useCreateForm } from "@/features/app/create/hooks";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * Create listing page - Orchestration layer
 * Follows SOLID principle - uses hooks for business logic, passes data to UI components
 */
function CreateContent() {
  const {
    currentStep,
    steps,
    photos,
    form,
    isFirstStep,
    isLastStep,
    isEditMode,
    isLoadingData,
    handlePhotosChange,
    handleNext,
    handlePrev,
    handleSubmit,
  } = useCreateForm();

  if (isLoadingData) {
    return <PageLoader />;
  }

  return (
    <Create
      currentStep={currentStep}
      steps={steps}
      photos={photos}
      form={form}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      isEditMode={isEditMode}
      isLoadingData={isLoadingData}
      onPhotosChange={handlePhotosChange}
      onNext={handleNext}
      onPrev={handlePrev}
      onSubmit={handleSubmit}
    />
  );
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={<PageLoader />}
    >
      <CreateContent />
    </Suspense>
  );
}
