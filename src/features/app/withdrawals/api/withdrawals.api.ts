import { api, toQuery } from "@/lib/fetcher";

export interface Withdrawal {
  id: string;
  carrierId: string;
  amountCents: number;
  currency: string;
  status: "requested" | "approved" | "paid" | "rejected";
  reference: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  paidAt: string | null;
}

export interface WithdrawalBalance {
  availableCents: number;
  deliveries: number;
  minimumCents: number;
  canRequest: boolean;
  openRequest: Withdrawal | null;
  history: Withdrawal[];
}

export interface ReviewRow extends Withdrawal {
  carrierName: string | null;
  carrierEmail: string;
}

export interface DecideInput {
  action: "approve" | "reject" | "mark_paid";
  reference?: string;
  note?: string;
}

export const withdrawalsApi = {
  balance: () => api.get<WithdrawalBalance>("/api/carrier/withdrawals"),

  /** No body: a request always claims the whole available balance. */
  request: () => api.post<Withdrawal>("/api/carrier/withdrawals"),

  review: (status?: string) =>
    api.get<ReviewRow[]>(`/api/admin/withdrawals${toQuery({ status })}`),

  decide: (id: string, input: DecideInput) =>
    api.post<Withdrawal>(`/api/admin/withdrawals/${id}`, input),
};
