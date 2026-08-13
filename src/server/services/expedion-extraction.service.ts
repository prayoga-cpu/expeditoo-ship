/**
 * ============================================================================
 * Bordereau extraction — Expedion Phase B
 * ============================================================================
 *
 * A buyer uploads the bordereau they received from the auction house; we read
 * the fields off it so they never type any. Proven against real slips from
 * Yssoire Enchères and Accord Enchères (expedion_encheres ROADMAP.md §3).
 *
 * Primary model is GPT-4.1 Vision with a strict JSON schema, one call, PDF and
 * JPEG handled identically. Gemini 2.5 Pro is the fallback when OpenAI is
 * unavailable or returns something unusable.
 *
 * Extraction is never trusted on its own: the client sees a confirm-details
 * screen and signs off before the quote is priced. That is what turns
 * model-level accuracy into user-verified accuracy — so a low `confidence` is
 * a reason to highlight fields, not to fail the request.
 */

import { getOpenAIClient, isOpenAIAvailable } from "@/lib/ai/openai";
import { z } from "zod";

// ========================================
// Output contract
// ========================================

export const bordereauExtractionSchema = z.object({
  bordereauNumber: z.string().nullable(),
  saleDate: z.string().nullable(),

  buyerName: z.string().nullable(),
  buyerAddress: z.string().nullable(),
  buyerPostalCode: z.string().nullable(),
  buyerCity: z.string().nullable(),
  buyerPhone: z.string().nullable(),
  buyerEmail: z.string().nullable(),

  auctionHouseName: z.string().nullable(),
  pickupAddress: z.string().nullable(),
  pickupPostalCode: z.string().nullable(),
  pickupCity: z.string().nullable(),

  lotDescription: z.string().nullable(),
  lengthCm: z.number().nullable(),
  widthCm: z.number().nullable(),
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),

  declaredValueEur: z.number().nullable(),

  /** 0–1. The client confirms regardless; this only drives what we highlight. */
  confidence: z.number().min(0).max(1),
});

export type BordereauExtraction = z.infer<typeof bordereauExtractionSchema>;

export interface ExtractionOutcome {
  extraction: BordereauExtraction;
  model: string;
  /** Fields the model could not find, for the confirm screen to flag. */
  missingFields: string[];
}

/**
 * The strict JSON schema handed to the model. `strict: true` requires every
 * property to be listed in `required` and forbids extras, so optional values
 * are expressed as nullable rather than absent.
 */
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    bordereauNumber: {
      type: ["string", "null"],
      description: "Bordereau / invoice number, usually in the header",
    },
    saleDate: {
      type: ["string", "null"],
      description: "Sale date in ISO 8601 (YYYY-MM-DD). From 'Vente du …'",
    },
    buyerName: { type: ["string", "null"] },
    buyerAddress: {
      type: ["string", "null"],
      description: "Street line only, without postal code or city",
    },
    buyerPostalCode: { type: ["string", "null"] },
    buyerCity: { type: ["string", "null"] },
    buyerPhone: { type: ["string", "null"] },
    buyerEmail: { type: ["string", "null"] },
    auctionHouseName: {
      type: ["string", "null"],
      description: "The hôtel des ventes, normally in the header or footer",
    },
    pickupAddress: {
      type: ["string", "null"],
      description: "Auction house street address, from the footer",
    },
    pickupPostalCode: { type: ["string", "null"] },
    pickupCity: { type: ["string", "null"] },
    lotDescription: {
      type: ["string", "null"],
      description:
        "The lot description column. Join multiple lots with '; '.",
    },
    lengthCm: {
      type: ["number", "null"],
      description: "Length in centimetres, parsed out of the description text",
    },
    widthCm: { type: ["number", "null"], description: "Width in centimetres" },
    heightCm: { type: ["number", "null"], description: "Height in centimetres" },
    weightKg: { type: ["number", "null"], description: "Weight in kilograms" },
    declaredValueEur: {
      type: ["number", "null"],
      description: "Total TTC in euros",
    },
    confidence: { type: "number" },
  },
  required: [
    "bordereauNumber",
    "saleDate",
    "buyerName",
    "buyerAddress",
    "buyerPostalCode",
    "buyerCity",
    "buyerPhone",
    "buyerEmail",
    "auctionHouseName",
    "pickupAddress",
    "pickupPostalCode",
    "pickupCity",
    "lotDescription",
    "lengthCm",
    "widthCm",
    "heightCm",
    "weightKg",
    "declaredValueEur",
    "confidence",
  ],
} as const;

const SYSTEM_PROMPT = `Tu extrais les informations d'un bordereau d'adjudication d'une maison de ventes française (hôtel des ventes).

Règles:
- Réponds uniquement avec le JSON demandé.
- Ne devine jamais. Si une information est absente, mets null.
- Les dimensions sont presque toujours à l'intérieur du texte de description du lot, par exemple "H. 120 x L. 80 x P. 45 cm" ou "haut. 65 cm". Convertis tout en centimètres (1 m = 100 cm, 1 mm = 0,1 cm).
- H./haut. = hauteur, L./larg. = largeur, P./prof. = profondeur (utilise-la comme largeur si aucune largeur distincte n'est donnée), Diam. = diamètre (utilise-le pour longueur et largeur).
- Le poids est rarement indiqué: laisse null plutôt que d'estimer.
- L'adresse de retrait est celle de la maison de ventes (en-tête ou pied de page), pas celle de l'acheteur.
- La valeur déclarée est le Total TTC.
- Les montants français utilisent la virgule décimale: "1 234,56" vaut 1234.56.
- confidence: ta confiance globale entre 0 et 1.`;

const MODEL = "gpt-4.1";

// ========================================
// Input
// ========================================

export interface ExtractionInput {
  /** Base64 payload, with or without a `data:` prefix. */
  data: string;
  mimeType: string;
  filename?: string;
}

function toDataUrl(input: ExtractionInput): string {
  const raw = input.data.includes(",")
    ? input.data.slice(input.data.indexOf(",") + 1)
    : input.data;
  return `data:${input.mimeType};base64,${raw}`;
}

function isPdf(mimeType: string): boolean {
  return mimeType.toLowerCase().includes("pdf");
}

/**
 * PDFs and images take different content parts, which is the only place the
 * two formats diverge — everything downstream is identical.
 */
function buildContent(input: ExtractionInput) {
  const url = toDataUrl(input);
  if (isPdf(input.mimeType)) {
    return [
      {
        type: "file" as const,
        file: {
          filename: input.filename ?? "bordereau.pdf",
          file_data: url,
        },
      },
      {
        type: "text" as const,
        text: "Extrais les champs de ce bordereau.",
      },
    ];
  }
  return [
    { type: "image_url" as const, image_url: { url, detail: "high" as const } },
    { type: "text" as const, text: "Extrais les champs de ce bordereau." },
  ];
}

// ========================================
// Normalisation
// ========================================

/** Which of the fields that matter came back empty. */
function findMissing(extraction: BordereauExtraction): string[] {
  const important: (keyof BordereauExtraction)[] = [
    "bordereauNumber",
    "auctionHouseName",
    "pickupAddress",
    "pickupCity",
    "lotDescription",
    "lengthCm",
    "widthCm",
    "heightCm",
    "declaredValueEur",
  ];
  return important.filter((k) => extraction[k] === null);
}

/**
 * Models occasionally answer in millimetres or metres despite the prompt. A
 * 4000 "cm" sofa is a millimetre reading; a 1.2 "cm" wardrobe is metres. Both
 * are recoverable, and both are obvious enough to correct without asking.
 */
function normaliseDimensions(e: BordereauExtraction): BordereauExtraction {
  const dims = [e.lengthCm, e.widthCm, e.heightCm].filter(
    (d): d is number => d !== null && d > 0
  );
  if (dims.length === 0) return e;

  const max = Math.max(...dims);
  let factor = 1;
  if (max > 1000) factor = 0.1; // millimetres
  else if (max < 5) factor = 100; // metres
  if (factor === 1) return e;

  const scale = (v: number | null) =>
    v === null ? null : Math.round(v * factor * 10) / 10;
  return {
    ...e,
    lengthCm: scale(e.lengthCm),
    widthCm: scale(e.widthCm),
    heightCm: scale(e.heightCm),
  };
}

// ========================================
// Providers
// ========================================

async function extractWithOpenAI(
  input: ExtractionInput
): Promise<BordereauExtraction | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildContent(input) as never },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bordereau_extraction",
        strict: true,
        schema: JSON_SCHEMA as never,
      },
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) return null;

  const parsed = bordereauExtractionSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

/**
 * Gemini 2.5 Pro fallback over the REST API.
 *
 * Called through `fetch` rather than the Google SDK deliberately: the fallback
 * should not add a dependency that the primary path never touches.
 */
async function extractWithGemini(
  input: ExtractionInput
): Promise<BordereauExtraction | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const raw = input.data.includes(",")
    ? input.data.slice(input.data.indexOf(",") + 1)
    : input.data;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: input.mimeType, data: raw } },
              { text: "Extrais les champs de ce bordereau." },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    console.error("[expedion] Gemini extraction failed", res.status);
    return null;
  }

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  try {
    const parsed = bordereauExtractionSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ========================================
// Service
// ========================================

export class ExtractionUnavailableError extends Error {
  readonly code = "EXTRACTION_UNAVAILABLE";
  readonly status = 503;
}

export const expedionExtractionService = {
  /**
   * Reads a bordereau. Tries GPT-4.1 first, falls back to Gemini, and throws
   * only when both are unavailable — a partial extraction is still useful,
   * because the client is going to confirm it either way.
   */
  async extract(input: ExtractionInput): Promise<ExtractionOutcome> {
    let extraction: BordereauExtraction | null = null;
    let model = MODEL;

    if (isOpenAIAvailable()) {
      try {
        extraction = await extractWithOpenAI(input);
      } catch (error) {
        console.error("[expedion] GPT-4.1 extraction failed", error);
      }
    }

    if (!extraction) {
      try {
        extraction = await extractWithGemini(input);
        if (extraction) model = "gemini-2.5-pro";
      } catch (error) {
        console.error("[expedion] Gemini extraction failed", error);
      }
    }

    if (!extraction) throw new ExtractionUnavailableError();

    const normalised = normaliseDimensions(extraction);
    return {
      extraction: normalised,
      model,
      missingFields: findMissing(normalised),
    };
  },

  /** Maps an extraction onto the quote columns it can populate. */
  toQuotePatch(extraction: BordereauExtraction) {
    const [firstName, ...rest] = (extraction.buyerName ?? "").split(" ");
    const saleDate = extraction.saleDate
      ? new Date(extraction.saleDate)
      : null;

    return {
      bordereauNumber: extraction.bordereauNumber,
      saleDate:
        saleDate && !Number.isNaN(saleDate.getTime()) ? saleDate : null,
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      clientAddress: extraction.buyerAddress,
      clientPostalCode: extraction.buyerPostalCode,
      clientCity: extraction.buyerCity,
      phone: extraction.buyerPhone,
      email: extraction.buyerEmail,
      auctionHouseName: extraction.auctionHouseName,
      pickupAddress: extraction.pickupAddress,
      pickupPostalCode: extraction.pickupPostalCode,
      pickupCity: extraction.pickupCity,
      description: extraction.lotDescription,
      lengthCm: extraction.lengthCm,
      widthCm: extraction.widthCm,
      heightCm: extraction.heightCm,
      weightKg: extraction.weightKg,
      declaredValueCents:
        extraction.declaredValueEur === null
          ? null
          : Math.round(extraction.declaredValueEur * 100),
    };
  },
};
