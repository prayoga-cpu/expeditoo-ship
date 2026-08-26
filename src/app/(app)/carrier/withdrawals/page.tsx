import { WithdrawalPanel } from "@/features/app/withdrawals/ui";

/** What the driver has earned, and the request that asks for it. */
export default function CarrierWithdrawalsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <WithdrawalPanel />
    </div>
  );
}
