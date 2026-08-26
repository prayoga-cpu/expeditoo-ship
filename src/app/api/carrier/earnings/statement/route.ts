import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { earningsService } from "@/server/services/earnings.service";
import { EarningsStatementPDF } from "@/server/pdf/EarningsStatementPDF";
import {
  statementPeriodSchema,
  periodLabel,
  periodSlug,
} from "@/lib/statement-period";
import { unauthorised, handleError } from "@/lib/api-response";

/**
 * GET /api/carrier/earnings/statement
 * One PDF covering a period — the carrier-side answer to Cocolis's
 * "Télécharger toutes les factures de la période".
 *
 * An empty period still renders: an empty statement is a meaningful accounting
 * artefact, not a 404 (billing_documents_spec.md §6.4).
 */
export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const period = statementPeriodSchema.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    const { carrier, items, summary, commissionRetainsAll } =
      await earningsService.getStatementRows(session.user.id, period);

    const buffer = await renderToBuffer(
      EarningsStatementPDF({
        companyName: carrier.companyName,
        siret: carrier.siret,
        periodLabel: periodLabel(period, "Toutes périodes"),
        generatedAt: new Date().toLocaleDateString("fr-FR"),
        currency: "EUR",
        lines: items.map((item) => ({
          deliveredAt: item.deliveredAt,
          reference: item.reference,
          listingTitle: item.listingTitle,
          pickupCity: item.pickupCity,
          dropoffCity: item.dropoffCity,
          grossCents: item.grossCents,
          commissionCents: item.commissionCents,
          netCents: item.netCents,
        })),
        totals: summary,
        commissionRetainsAll,
        emptyLabel: "Aucune livraison sur cette période.",
      })
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="releve-${periodSlug(period)}.pdf"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    return handleError(error, "Carrier earnings statement");
  }
}
