import {
  CompanyIdentityPanel,
  CronStatusPanel,
  PlatformSettingsPanel,
  StripeStatusPanel,
} from "@/features/app/platform-settings/ui";

/**
 * Admin/finance settings: the platform fee, whether Stripe is ready to take
 * real money, and the company identity printed on documents
 * (launch_readiness_spec.md §A, §B).
 */
export default function AdminSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <PlatformSettingsPanel />
      <StripeStatusPanel />
      <CronStatusPanel />
      <CompanyIdentityPanel />
    </div>
  );
}
