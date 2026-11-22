/**
 * The 2.94.0 driver copy, as the tests see it.
 *
 * Generated from the i18n patch for this release (`i18n-2.94.0-driver.json`):
 * the components read keys that reach `messages/*.json` only when that patch
 * is applied, and these tests have to pass on both sides of it. `withDriverCopy`
 * lays the new copy over whatever the message files hold; once the patch is in,
 * the overlay changes nothing and this file can go.
 */
type Messages = Record<string, unknown>;

export const DRIVER_COPY: Record<"fr" | "en", Record<string, string>> = {
  "fr": {
    "carrier.application.form.siret": "SIRET ou numéro d'entreprise",
    "carrier.application.form.siretHelp": "Société française : votre SIRET (14 chiffres). Société étrangère : votre numéro d'immatriculation.",
    "carrier.application.form.vatNumber": "Numéro de TVA (optionnel)",
    "carrier.application.form.phoneHelp": "Hors de France, commencez par l'indicatif du pays (+32, +49…).",
    "carrier.application.form.errors.siret": "Saisissez un SIRET (14 chiffres) ou un numéro d'entreprise de 5 à 20 lettres ou chiffres",
    "carrier.application.form.errors.vat": "Code pays puis numéro, par ex. FR12345678901 ou BE0123456789",
    "carrier.application.form.errors.phone": "Saisissez un numéro français, ou un numéro international avec son indicatif (+32…)",
    "carrier.application.form.errors.postalCode": "3 à 10 lettres ou chiffres",
    "carrier.application.form.kind.legend": "Vous êtes…",
    "carrier.application.form.kind.private.title": "Particulier — chauffeur interne Expeditop",
    "carrier.application.form.kind.private.body": "Formulaire court : téléphone et adresse. Ni société, ni documents, ni RIB. Expeditop vous attribue vos courses.",
    "carrier.application.form.kind.professional.title": "Professionnel — transporteur",
    "carrier.application.form.kind.professional.body": "Société, numéro d'entreprise, documents et RIB. Vous faites vos offres sur les missions.",
    "carrier.application.form.kind.locked": "Le type ne peut plus changer une fois le dossier approuvé. Pour le modifier, contactez le support.",
    "carrier.application.form.inHouse.description": "Téléphone et adresse suffisent. Expeditop valide ensuite votre dossier à la main et vous prévient par e-mail.",
    "carrier.application.banner.inHouse.submitted.title": "Dossier envoyé — en attente de validation",
    "carrier.application.banner.inHouse.submitted.description": "Expeditop valide chaque chauffeur interne à la main : c'est la seule étape qui reste, et vous n'avez rien d'autre à fournir. Vous recevrez un e-mail dès que votre dossier est validé.",
    "carrier.application.banner.inHouse.under_review.title": "Validation en cours",
    "carrier.application.banner.inHouse.under_review.description": "Expeditop examine votre dossier de chauffeur interne. Vous recevrez un e-mail dès qu'il est validé.",
    "carrier.application.banner.inHouse.approved.title": "Vous êtes chauffeur Expeditop",
    "carrier.application.banner.inHouse.approved.description": "Expeditop vous attribue vos courses : retrouvez-les dans « Livraisons ».",
    "carrier.application.checklist.inHouseTitle": "Avant d'envoyer votre dossier",
    "carrier.application.checklist.inHouseDescription": "Un véhicule suffit : il en faut un pour qu'Expeditop vous attribue une course. Une fois le dossier envoyé, Expeditop le valide à la main et vous prévient par e-mail.",
    "carrier.onboarding.description": "Deux façons de conduire avec Expeditop. Dans les deux cas : un seul formulaire, puis notre équipe valide votre dossier.",
    "carrier.onboarding.kinds.private.title": "Particulier — chauffeur interne Expeditop",
    "carrier.onboarding.kinds.private.body": "Téléphone et adresse, rien d'autre : ni société, ni documents, ni RIB. Expeditop vous attribue vos courses.",
    "carrier.onboarding.kinds.professional.title": "Professionnel — transporteur",
    "carrier.onboarding.kinds.professional.body": "Société, SIRET ou numéro d'entreprise, documents et RIB. Vous répondez aux missions avec vos offres.",
    "carrier.onboarding.review": "Notre équipe valide chaque dossier à la main. Vous recevez un e-mail dès que c'est fait, et le mode Chauffeur apparaît dans votre menu d'accès.",
    "carrier.fleet.form.errors.plate": "4 à 12 lettres ou chiffres, par ex. AB-123-CD",
    "admin.carriers.editor.siret": "SIRET ou numéro d'entreprise",
    "admin.carriers.editor.inHouseHelp": "Particulier (interne) : la personne conduit pour Expeditop — ni société, ni numéro d'entreprise, ni document. Professionnel : transporteur extérieur, dossier complet."
  },
  "en": {
    "carrier.application.form.siret": "SIRET or company number",
    "carrier.application.form.siretHelp": "French company: your 14-digit SIRET. Foreign company: your registration number.",
    "carrier.application.form.vatNumber": "VAT number (optional)",
    "carrier.application.form.phoneHelp": "Outside France, start with the country code (+32, +49…).",
    "carrier.application.form.errors.siret": "Enter a 14-digit SIRET, or a company number of 5 to 20 letters or digits",
    "carrier.application.form.errors.vat": "Country code then number, e.g. FR12345678901 or BE0123456789",
    "carrier.application.form.errors.phone": "Enter a French number, or an international one with its country code (+32…)",
    "carrier.application.form.errors.postalCode": "3 to 10 letters or digits",
    "carrier.application.form.kind.legend": "You are…",
    "carrier.application.form.kind.private.title": "Private — Expeditop in-house driver",
    "carrier.application.form.kind.private.body": "Short form: phone and address. No company, no documents, no bank details. Expeditop assigns your runs.",
    "carrier.application.form.kind.professional.title": "Professional — carrier",
    "carrier.application.form.kind.professional.body": "Company, registration number, documents and bank details. You make offers on jobs.",
    "carrier.application.form.kind.locked": "The type can no longer change once the file is approved. To change it, contact support.",
    "carrier.application.form.inHouse.description": "A phone number and an address are enough. Expeditop then validates your file by hand and emails you.",
    "carrier.application.banner.inHouse.submitted.title": "File submitted — waiting for validation",
    "carrier.application.banner.inHouse.submitted.description": "Expeditop validates every in-house driver by hand: it is the only step left, and there is nothing else for you to provide. You will get an email as soon as your file is validated.",
    "carrier.application.banner.inHouse.under_review.title": "Validation in progress",
    "carrier.application.banner.inHouse.under_review.description": "Expeditop is looking at your in-house driver file. You will get an email as soon as it is validated.",
    "carrier.application.banner.inHouse.approved.title": "You are an Expeditop driver",
    "carrier.application.banner.inHouse.approved.description": "Expeditop assigns your runs: find them under “Deliveries”.",
    "carrier.application.checklist.inHouseTitle": "Before you submit your file",
    "carrier.application.checklist.inHouseDescription": "One vehicle is enough: Expeditop needs one to assign you a run. Once the file is submitted, Expeditop validates it by hand and emails you.",
    "carrier.onboarding.description": "Two ways to drive with Expeditop. Either way: a single form, then our team validates your file.",
    "carrier.onboarding.kinds.private.title": "Private — Expeditop in-house driver",
    "carrier.onboarding.kinds.private.body": "Phone and address, nothing else: no company, no documents, no bank details. Expeditop assigns your runs.",
    "carrier.onboarding.kinds.professional.title": "Professional — carrier",
    "carrier.onboarding.kinds.professional.body": "Company, SIRET or company number, documents and bank details. You answer jobs with your own offers.",
    "carrier.onboarding.review": "Our team validates every file by hand. You get an email as soon as it is done, and Driver mode appears in your access menu.",
    "carrier.fleet.form.errors.plate": "4 to 12 letters or digits, e.g. AB-123-CD",
    "admin.carriers.editor.siret": "SIRET or company number",
    "admin.carriers.editor.inHouseHelp": "Private (in-house): the person drives for Expeditop — no company, no registration number, no documents. Professional: an outside carrier, with the full file."
  }
};

function setPath(target: Messages, path: string, value: string) {
  const keys = path.split(".");
  let node = target;
  for (const key of keys.slice(0, -1)) {
    const next = node[key];
    node[key] = next && typeof next === "object" ? { ...(next as Messages) } : {};
    node = node[key] as Messages;
  }
  node[keys[keys.length - 1]] = value;
}

/** `messages` with this release's driver copy laid over it; the input is not mutated. */
export function withDriverCopy<T extends object>(messages: T, locale: "fr" | "en"): T {
  const copy: Messages = { ...(messages as Messages) };
  for (const [path, value] of Object.entries(DRIVER_COPY[locale])) setPath(copy, path, value);
  return copy as T;
}
