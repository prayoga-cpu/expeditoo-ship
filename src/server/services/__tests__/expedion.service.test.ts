import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  expedionService,
  ExpedionError,
  canTransition,
} from '../expedion.service';
import { expedionDal, type QuoteFilters } from '@/server/dal/expedion.dal';
import { expedionPriceSuggestionService } from '@/server/services/expedion-price-suggestion.service';
import { adminUpdateExpedionQuoteSchema } from '@/server/dto/expedion.dto';
import { searchAddress } from '@/lib/geocoding';

// Nominatim is stubbed so the suite never makes a real network call — every
// `createQuote`/`updateQuote` here fires `geocodeMissingCoordinates` in the
// background, and without this the search-address fixtures below would hit
// the real service.
vi.mock('@/lib/geocoding', () => ({ searchAddress: vi.fn() }));

// The DAL is stubbed so the suite never touches a database.
vi.mock('@/server/dal/expedion.dal', () => ({
    expedionDal: {
        list: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        addEvent: vi.fn(),
        listEvents: vi.fn(),
        getByAirtableRecordId: vi.fn(),
        findDueForEscalation: vi.fn(),
    },
}));

vi.mock('@/db', () => ({
    // Runs the callback immediately with a stub tx: the transaction boundary
    // is a database guarantee, so what is asserted here is the patch the DAL
    // is handed inside it.
    db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
}));

vi.mock('@/server/services/expedion-sms.service', () => ({
    expedionSmsService: {
        quoteReady: vi.fn().mockResolvedValue(undefined),
        driverAssigned: vi.fn().mockResolvedValue(undefined),
        deliveryUpdate: vi.fn().mockResolvedValue(undefined),
        storageWarning: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/server/services/expedion-price-suggestion.service', () => ({
    expedionPriceSuggestionService: { suggest: vi.fn() },
}));

const listMock = vi.mocked(expedionDal.list);
const getByIdMock = vi.mocked(expedionDal.getById);
const updateMock = vi.mocked(expedionDal.update);

/** What the DAL was asked for on the most recent call. */
function lastFilters(): QuoteFilters {
    return listMock.mock.calls.at(-1)![0] as QuoteFilters;
}

describe('expedionService.listQuotes — owner scoping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listMock.mockResolvedValue({ rows: [], total: 0 });
    });

    it('passes the owner through for a scoped read', async () => {
        await expedionService.listQuotes({
            owner: { scope: 'mine', ownerId: 'user_abc' },
            page: 1,
            limit: 20,
        });

        expect(lastFilters().owner).toEqual({ scope: 'mine', ownerId: 'user_abc' });
    });

    it('passes an explicit sweep through untouched', async () => {
        await expedionService.listQuotes({
            owner: { scope: 'all' },
            page: 1,
            limit: 20,
        });

        expect(lastFilters().owner).toEqual({ scope: 'all' });
    });

    // The regression this suite exists for. The route used to send
    // `firebaseUid: undefined` for admins, the DAL read that as "no predicate",
    // and the client app was served every row. `owner` is now a required
    // discriminated union, so "no owner" is not a value that can be sent —
    // this asserts the type has not been loosened back.
    it('has no way to express "unspecified owner"', async () => {
        const filters = {
            owner: { scope: 'mine' as const, ownerId: 'user_abc' },
            page: 1,
            limit: 20,
        } satisfies QuoteFilters;

        // @ts-expect-error — omitting `owner` must not compile.
        const withoutOwner: QuoteFilters = { page: 1, limit: 20 };
        void withoutOwner;

        await expedionService.listQuotes(filters);
        expect(lastFilters().owner.scope).toBe('mine');
    });

    it('keeps the other filters alongside the owner', async () => {
        await expedionService.listQuotes({
            owner: { scope: 'mine', ownerId: 'user_abc' },
            status: 'quoted',
            bordereauNumber: 'B-77',
            page: 2,
            limit: 50,
        });

        const filters = lastFilters();
        expect(filters).toMatchObject({
            owner: { scope: 'mine', ownerId: 'user_abc' },
            status: 'quoted',
            bordereauNumber: 'B-77',
            page: 2,
            limit: 50,
        });
    });
});

// ========================================
// Admin patches
// ========================================

const ESCALATE_AFTER = new Date('2026-08-18T00:00:00.000Z');
const STORAGE_FREE_UNTIL = new Date('2026-09-01T00:00:00.000Z');

/** A paid quote waiting for a driver — the state the assign queue serves. */
const paidQuote = (over: Record<string, unknown> = {}) => ({
    id: 'q_1',
    status: 'paid',
    paymentStatus: 'paid',
    // A settled price, because that is what makes the lock meaningful — a paid
    // quote carrying none is the repairable case, and it has its own fixture.
    acceptedPriceCents: 10_000,
    listingId: null,
    assignedCarrierId: null,
    escalateAfter: ESCALATE_AFTER,
    storageFreeUntil: STORAGE_FREE_UNTIL,
    phone: '+33600000000',
    firstName: 'Ada',
    pickupCity: 'Lyon',
    bordereauNumber: 'B-77',
    ...over,
});

/**
 * The same quote before the money landed — the only state in which a price is
 * still the platform's to set. `paidQuote` cannot stand in for it: every price
 * field is refused once `paymentStatus` is `paid`.
 */
const quotedQuote = (over: Record<string, unknown> = {}) =>
    paidQuote({ status: 'quoted', paymentStatus: 'unpaid', ...over });

/**
 * A paid quote the Airtable import brought across with no accepted price. 95 of
 * these are live; they can never escalate (`escalationBlockers` wants
 * `acceptedPriceCents >= 100`) and the price lock would strand them.
 */
const priceless = (over: Record<string, unknown> = {}) =>
    paidQuote({ acceptedPriceCents: null, ...over });

/** The patch the DAL was handed on the most recent write. */
function lastPatch(): Record<string, unknown> {
    return updateMock.mock.calls.at(-1)![1] as Record<string, unknown>;
}

/**
 * Bodies go through the real schema rather than being handed to the service
 * pre-shaped. Absent-versus-null is decided during parsing, so a test that
 * skipped it would assert against a body no route can actually produce.
 */
const body = (raw: Record<string, unknown>) =>
    adminUpdateExpedionQuoteSchema.parse(raw);

describe('expedionService.adminUpdate — absent fields are not writes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockImplementation(
            async (_id, patch) => ({ ...paidQuote(), ...patch }) as never
        );
    });

    // The regression these exist for: `looseDate` used to carry `.nullish()`
    // inside its transform, so an unmentioned date came out of the parser as
    // `null` and the patch cleared the column. Every reprice and every assign
    // wiped the gardiennage deadline and the escalation timer.
    it('leaves the deadlines alone when repricing does not mention them', async () => {
        getByIdMock.mockResolvedValue(quotedQuote() as never);

        await expedionService.adminUpdate(
            'q_1',
            body({ quoteStandardCents: 12_000, quoteInsuredCents: 14_400 })
        );

        expect(lastPatch()).not.toHaveProperty('escalateAfter');
        expect(lastPatch()).not.toHaveProperty('storageFreeUntil');
    });

    it('leaves the deadlines alone when correcting an address', async () => {
        getByIdMock.mockResolvedValue(paidQuote() as never);

        await expedionService.adminUpdate('q_1', body({ deliveryCity: 'Lyon' }));

        expect(lastPatch()).not.toHaveProperty('escalateAfter');
        expect(lastPatch()).not.toHaveProperty('storageFreeUntil');
    });

    it('still clears a deadline the patch names as null', async () => {
        getByIdMock.mockResolvedValue(paidQuote() as never);

        await expedionService.adminUpdate(
            'q_1',
            body({ storageFreeUntil: null, escalateAfter: '2026-10-01T00:00:00.000Z' })
        );

        expect(lastPatch().storageFreeUntil).toBeNull();
        expect(lastPatch().escalateAfter).toEqual(
            new Date('2026-10-01T00:00:00.000Z')
        );
    });

    it('reports only the fields the operator actually sent', async () => {
        getByIdMock.mockResolvedValue(quotedQuote() as never);

        await expedionService.adminUpdate('q_1', body({ quoteAvailable: true }));

        expect(
            vi.mocked(expedionDal.addEvent).mock.calls.at(-1)![0].metadata
        ).toEqual({ changed: ['quoteAvailable'] });
    });

    // A body that names nothing now yields an empty patch, which Drizzle
    // rejects from inside `set()`. It is refused up front so the operator gets
    // an answer instead of a 500.
    it('refuses a patch that changes nothing', async () => {
        getByIdMock.mockResolvedValue(paidQuote() as never);

        await expect(
            expedionService.adminUpdate('q_1', body({ note: 'juste une note' }))
        ).rejects.toMatchObject({ code: 'NO_CHANGES', status: 400 });
        expect(updateMock).not.toHaveBeenCalled();
    });
});

describe('expedionService.adminUpdate — a paid price is settled', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockImplementation(
            async (_id, patch) => ({ ...paidQuote(), ...patch }) as never
        );
    });

    // Every one of these is what Stripe charged, or what the client was shown
    // before they paid it. Editing any after settlement puts the recorded
    // amount and the captured one out of step — and `acceptedPriceCents` is
    // also the marketplace `budgetCents` on escalation, so it would move the
    // bid ceiling off money that exists.
    it.each([
        ['quoteStandardCents', 12_000],
        ['quoteInsuredCents', 14_400],
        ['quoteAvailable', true],
        ['acceptedPriceCents', 9_900],
    ] as const)('refuses %s on a paid quote', async (field, value) => {
        getByIdMock.mockResolvedValue(paidQuote() as never);
        // `paidQuote` carries a settled `acceptedPriceCents`, so the
        // supply-a-missing-price carve-out does not apply to any of the four.

        const rejection = expedionService.adminUpdate(
            'q_1',
            body({ [field]: value })
        );

        await expect(rejection).rejects.toBeInstanceOf(ExpedionError);
        await expect(rejection).rejects.toMatchObject({
            code: 'PRICE_LOCKED',
            status: 409,
        });
        expect(updateMock).not.toHaveBeenCalled();
    });

    it('names every locked field the caller sent, not just the first', async () => {
        getByIdMock.mockResolvedValue(paidQuote() as never);

        await expect(
            expedionService.adminUpdate(
                'q_1',
                body({ quoteStandardCents: 1_000, acceptedPriceCents: 2_000 })
            )
        ).rejects.toMatchObject({
            message: expect.stringContaining('acceptedPriceCents'),
        });
    });

    // Supplying a price the row never had is not changing one it was paid at.
    // Without this the lock strands every imported quote that arrived settled
    // but priceless: they cannot escalate, and the detail dialog — the only
    // surface that could repair them — had just gone read-only.
    it('lets an operator supply an accepted price the quote never had', async () => {
        getByIdMock.mockResolvedValue(priceless() as never);

        await expedionService.adminUpdate('q_1', body({ acceptedPriceCents: 9_900 }));

        expect(lastPatch()).toMatchObject({ acceptedPriceCents: 9_900 });
    });

    it('refuses a supplied price that would still block escalation', async () => {
        getByIdMock.mockResolvedValue(priceless() as never);

        await expect(
            expedionService.adminUpdate('q_1', body({ acceptedPriceCents: 50 }))
        ).rejects.toMatchObject({ code: 'PRICE_LOCKED', status: 409 });
    });

    // The carve-out is for the accepted price only — the two published figures
    // are what the client was shown and stay shut either way.
    it('does not extend the carve-out to the published prices', async () => {
        getByIdMock.mockResolvedValue(priceless() as never);

        await expect(
            expedionService.adminUpdate('q_1', body({ quoteStandardCents: 9_900 }))
        ).rejects.toMatchObject({ code: 'PRICE_LOCKED', status: 409 });
    });

    it('still refuses to overwrite a price that was actually paid', async () => {
        getByIdMock.mockResolvedValue(paidQuote() as never);

        await expect(
            expedionService.adminUpdate('q_1', body({ acceptedPriceCents: 9_900 }))
        ).rejects.toMatchObject({ code: 'PRICE_LOCKED', status: 409 });
    });

    // The lock keys on `paymentStatus`, not `status`. A quote refunded back to
    // `unpaid` has to become editable again, which is the whole basis of the
    // cancel-and-re-quote path.
    it('allows a price on a quote that has not been paid', async () => {
        getByIdMock.mockResolvedValue(quotedQuote() as never);

        await expedionService.adminUpdate(
            'q_1',
            body({ quoteStandardCents: 12_000 })
        );

        expect(lastPatch()).toMatchObject({ quoteStandardCents: 12_000 });
    });

    // What escalation demands — addresses, coordinates, weight — stays open at
    // every status. Locking it too would strand a paid quote that cannot be
    // published because of a missing postal code.
    it.each([
        ['deliveryPostalCode', '69001'],
        ['weightKg', 12],
        ['storageDailyFeeCents', 500],
    ] as const)('still accepts %s on a paid quote', async (field, value) => {
        getByIdMock.mockResolvedValue(paidQuote() as never);

        await expedionService.adminUpdate('q_1', body({ [field]: value }));

        expect(lastPatch()).toMatchObject({ [field]: value });
    });

    // Assignment left this route entirely: it has to create a listing, an
    // offer, a shipment and a payment hold, none of which a field patch does.
    // `expedionEscalationService.assignDirect` is the one way in.
    it('no longer accepts a driver as a field edit', async () => {
        getByIdMock.mockResolvedValue(paidQuote() as never);

        await expect(
            expedionService.adminUpdate(
                'q_1',
                body({ assignedCarrierId: 'car_1' })
            )
        ).rejects.toMatchObject({ code: 'NO_CHANGES', status: 400 });
        expect(updateMock).not.toHaveBeenCalled();
    });

    it('still refuses an illegal status the operator states outright', async () => {
        getByIdMock.mockResolvedValue(paidQuote({ status: 'cancelled' }) as never);

        await expect(
            expedionService.adminUpdate('q_1', body({ status: 'picked_up' }))
        ).rejects.toMatchObject({ code: 'INVALID_TRANSITION', status: 409 });
    });
});

describe('expedionService.cancelAndRequote', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockImplementation(
            async (_id, patch) => ({ ...paidQuote(), ...patch }) as never
        );
        vi.mocked(expedionDal.listEvents).mockResolvedValue([] as never);
    });

    const PAID_EVENT = [
        {
            id: 'e_1',
            quoteId: 'q_1',
            status: 'paid',
            metadata: { reference: 'cs_test_abc', method: 'stripe' },
        },
    ];

    it('returns a paid quote to the client for a new price', async () => {
        getByIdMock.mockResolvedValue(
            paidQuote({ acceptedKind: 'standard', acceptedPriceCents: 10_000 }) as never
        );

        await expedionService.cancelAndRequote('q_1', 'admin_1');

        expect(lastPatch()).toMatchObject({
            paymentStatus: 'unpaid',
            status: 'quoted',
            acceptedKind: null,
            acceptedPriceCents: null,
            escalateAfter: null,
        });
    });

    // `paid -> quoted` is deliberately not in the transition graph: rewinding a
    // settled quote is what that graph stops `adminUpdate` doing by accident.
    // This route is the one place it is legitimate, and it writes directly.
    it('rewinds a status the transition graph refuses', () => {
        expect(canTransition('paid', 'quoted')).toBe(false);
    });

    // The only handle anyone has for issuing the refund — EXPEDITOO never took
    // the money, so this string is what the Expedion side refunds against.
    it('recovers the Stripe reference from the timeline', async () => {
        getByIdMock.mockResolvedValue(paidQuote({ acceptedPriceCents: 10_000 }) as never);
        vi.mocked(expedionDal.listEvents).mockResolvedValue(PAID_EVENT as never);

        const result = await expedionService.cancelAndRequote('q_1', 'admin_1');

        expect(result.paymentReference).toBe('cs_test_abc');
        expect(result.refundedCents).toBe(10_000);
        expect(
            vi.mocked(expedionDal.addEvent).mock.calls.at(-1)![0].metadata
        ).toMatchObject({ paymentReference: 'cs_test_abc', refundIssued: false });
    });

    it('records the unwind even when no reference was ever stored', async () => {
        getByIdMock.mockResolvedValue(paidQuote() as never);

        const result = await expedionService.cancelAndRequote('q_1', 'admin_1');

        expect(result.paymentReference).toBeNull();
        expect(updateMock).toHaveBeenCalled();
    });

    it('refuses a quote that was never paid', async () => {
        getByIdMock.mockResolvedValue(quotedQuote() as never);

        await expect(
            expedionService.cancelAndRequote('q_1', 'admin_1')
        ).rejects.toMatchObject({ code: 'NOT_PAID', status: 409 });
        expect(updateMock).not.toHaveBeenCalled();
    });

    // Once a listing or a driver exists, money is held against a shipment on
    // this side too. Unwinding that is a cancellation, not a re-quote.
    it.each([
        ['already on the marketplace', { listingId: 'lst_1' }],
        ['already with a driver', { assignedCarrierId: 'car_1' }],
    ])('refuses a job %s', async (_label, over) => {
        getByIdMock.mockResolvedValue(paidQuote(over) as never);

        await expect(
            expedionService.cancelAndRequote('q_1', 'admin_1')
        ).rejects.toMatchObject({ code: 'ALREADY_DISPATCHED', status: 409 });
        expect(updateMock).not.toHaveBeenCalled();
    });

    it('is a 404 for a quote that does not exist', async () => {
        getByIdMock.mockResolvedValue(undefined as never);

        await expect(
            expedionService.cancelAndRequote('nope', 'admin_1')
        ).rejects.toMatchObject({ code: 'QUOTE_NOT_FOUND', status: 404 });
    });

    // 1085 imported rows sit at `picked_up` with a settled payment, no carrier
    // and no listing, because the lot was collected outside the system. Gating
    // on `paymentStatus` alone would rewind a job in transit to `quoted` and
    // wipe the price the client paid.
    it.each(['picked_up', 'assigned', 'escalated'] as const)(
        'refuses to rewind a quote that is already at %s',
        async (status) => {
            getByIdMock.mockResolvedValue(paidQuote({ status }) as never);

            await expect(
                expedionService.cancelAndRequote('q_1', 'admin_1')
            ).rejects.toMatchObject({ code: 'NOT_AWAITING_DISPATCH', status: 409 });
            expect(updateMock).not.toHaveBeenCalled();
        }
    );
});

describe('expedionService.autoPrice — a settled price is not the engine\'s to revise', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // `reextractDocument` re-runs this in the background. Without the guard it
    // rewrote the very figures `adminUpdate` refuses to let an operator touch,
    // straight past PRICE_LOCKED.
    it('declines to price a quote the client has already paid for', async () => {
        getByIdMock.mockResolvedValue(
            paidQuote({ lengthCm: 80, widthCm: 60, heightCm: 50, weightKg: 18 }) as never
        );

        await expect(expedionService.autoPrice('q_1')).resolves.toBeNull();
        expect(updateMock).not.toHaveBeenCalled();
    });
});

describe("pricing a quote makes it acceptable", () => {
  // The admin dashboard used to publish a price without a status. The row then
  // left the "to price" queue (quoteAvailable was true) while staying `pending`,
  // and acceptQuote refuses `pending -> accepted` — so the client was shown a
  // price they could never act on, on a quote no queue was watching any more.
  it("allows quoted -> accepted but never pending -> accepted", () => {
    expect(canTransition("pending", "accepted")).toBe(false);
    expect(canTransition("quoted", "accepted")).toBe(true);
  });

  it("lets both to-price states reach quoted", () => {
    // These are the two the dialog gates on; if either stopped being legal the
    // publish action would start throwing INVALID_TRANSITION.
    expect(canTransition("pending", "quoted")).toBe(true);
    expect(canTransition("awaiting_confirmation", "quoted")).toBe(true);
  });

  it("refuses to drag a settled quote back to quoted", () => {
    // Why the dialog sends a status only from the two states above: re-pricing
    // an accepted or paid job must not rewind it.
    expect(canTransition("accepted", "quoted")).toBe(false);
    expect(canTransition("paid", "quoted")).toBe(false);
    expect(canTransition("delivered", "quoted")).toBe(false);
  });
});

// ========================================
// AI price suggestion
// ========================================

/** A pending, unpriced quote — the state the client-facing AI estimate targets. */
const pendingQuote = (over: Record<string, unknown> = {}) => ({
    id: 'q_1',
    firebaseUid: 'user_abc',
    status: 'pending',
    quoteAvailable: false,
    aiSuggestedStandardCents: null,
    aiSuggestedInsuredCents: null,
    aiSuggestionReasoning: null,
    aiSuggestionEstimations: null,
    aiSuggestionConfidence: null,
    aiSuggestionSource: null,
    aiSuggestedAt: null,
    ...over,
});

const OWNER_CALLER = { userId: 'user_abc', isAdmin: false };

describe('expedionService.getPriceSuggestion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockImplementation(
            async (_id, patch) => ({ ...pendingQuote(), ...patch }) as never
        );
    });

    it('returns the cached suggestion without calling the AI service', async () => {
        getByIdMock.mockResolvedValue(
            pendingQuote({
                aiSuggestedStandardCents: 12_000,
                aiSuggestedInsuredCents: 12_500,
                aiSuggestionReasoning: 'Cached reasoning',
                aiSuggestionEstimations: ['weight'],
                aiSuggestionConfidence: 0.7,
                aiSuggestionSource: 'ai',
                aiSuggestedAt: new Date('2026-08-01T00:00:00.000Z'),
            }) as never
        );

        const suggestion = await expedionService.getPriceSuggestion('q_1', OWNER_CALLER);

        expect(suggestion).toEqual({
            standardCents: 12_000,
            insuredCents: 12_500,
            reasoning: 'Cached reasoning',
            estimations: ['weight'],
            confidence: 0.7,
            source: 'ai',
        });
        expect(expedionPriceSuggestionService.suggest).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
    });

    it('computes and persists a fresh suggestion when nothing is cached', async () => {
        getByIdMock.mockResolvedValue(pendingQuote() as never);
        vi.mocked(expedionPriceSuggestionService.suggest).mockResolvedValue({
            standardCents: 15_000,
            insuredCents: 15_500,
            reasoning: 'Fresh reasoning',
            estimations: [],
            confidence: 0.8,
            source: 'ai',
        });

        const suggestion = await expedionService.getPriceSuggestion('q_1', OWNER_CALLER);

        expect(expedionPriceSuggestionService.suggest).toHaveBeenCalledWith('q_1');
        expect(suggestion.standardCents).toBe(15_000);
        expect(lastPatch()).toMatchObject({
            aiSuggestedStandardCents: 15_000,
            aiSuggestedInsuredCents: 15_500,
            aiSuggestionReasoning: 'Fresh reasoning',
            aiSuggestionSource: 'ai',
        });
        expect(lastPatch().aiSuggestedAt).toBeInstanceOf(Date);
    });

    it('refuses once the quote already has a real price', async () => {
        getByIdMock.mockResolvedValue(pendingQuote({ quoteAvailable: true }) as never);

        await expect(
            expedionService.getPriceSuggestion('q_1', OWNER_CALLER)
        ).rejects.toMatchObject({ code: 'QUOTE_ALREADY_PRICED', status: 409 });
        expect(expedionPriceSuggestionService.suggest).not.toHaveBeenCalled();
    });

    it('hides the quote from a non-owner, same as getQuote', async () => {
        getByIdMock.mockResolvedValue(
            pendingQuote({ firebaseUid: 'someone_else' }) as never
        );

        await expect(
            expedionService.getPriceSuggestion('q_1', OWNER_CALLER)
        ).rejects.toMatchObject({ code: 'QUOTE_NOT_FOUND', status: 404 });
        expect(expedionPriceSuggestionService.suggest).not.toHaveBeenCalled();
    });
});

describe('expedionService.updateQuote — AI suggestion cache invalidation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockImplementation(
            async (_id, patch) => ({ ...pendingQuote(), ...patch }) as never
        );
    });

    it('clears the cached AI suggestion when a dimension changes', async () => {
        getByIdMock.mockResolvedValue(
            pendingQuote({
                aiSuggestedAt: new Date('2026-08-01T00:00:00.000Z'),
                aiSuggestedStandardCents: 12_000,
            }) as never
        );

        await expedionService.updateQuote('q_1', OWNER_CALLER, { lengthCm: 50 });

        expect(lastPatch()).toMatchObject({
            aiSuggestedStandardCents: null,
            aiSuggestedInsuredCents: null,
            aiSuggestionReasoning: null,
            aiSuggestionEstimations: null,
            aiSuggestionConfidence: null,
            aiSuggestionSource: null,
            aiSuggestedAt: null,
        });
    });

    it('leaves the cache alone when nothing pricing-relevant changes', async () => {
        getByIdMock.mockResolvedValue(
            pendingQuote({
                aiSuggestedAt: new Date('2026-08-01T00:00:00.000Z'),
                aiSuggestedStandardCents: 12_000,
            }) as never
        );

        await expedionService.updateQuote('q_1', OWNER_CALLER, { comment: 'a note' });

        expect(lastPatch()).not.toHaveProperty('aiSuggestedAt');
    });

    it('does not touch the cache when nothing was ever cached', async () => {
        getByIdMock.mockResolvedValue(pendingQuote() as never);

        await expedionService.updateQuote('q_1', OWNER_CALLER, { weightKg: 10 });

        expect(lastPatch()).not.toHaveProperty('aiSuggestedAt');
    });
});

// ========================================
// Coordinate geocoding — closing the escalation-blocker gap
// ========================================
//
// `escalationBlockers` (expedion-escalation.service.ts) refuses to publish a
// quote with no pickup/delivery lat/lng. `autoPrice` only resolves those as a
// side effect of pricing, which needs dimensions too — so a quote with a
// complete address and no dimensions yet (the common shape right after the
// bordereau flow submits) used to sit blocked until an admin filled
// dimensions by hand. These tests pin `geocodeMissingCoordinates`, the fix.

const searchAddressMock = vi.mocked(searchAddress);
const createMock = vi.mocked(expedionDal.create);

/** Nominatim is called through a fire-and-forget chain the caller never
 * awaits; this lets each test wait for its effect (a DAL write, or none) to
 * either land or have had every chance to. */
async function flushBackgroundWork() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('geocodeMissingCoordinates — filling coordinates from an address alone', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createMock.mockImplementation(async (row) => row as never);
        vi.mocked(expedionDal.addEvent).mockResolvedValue(undefined as never);
        updateMock.mockImplementation(
            async (_id, patch) => ({ ...pendingQuote(), ...patch }) as never
        );
        searchAddressMock.mockResolvedValue([
            {
                id: '1',
                place_name: '10 Rue de Rivoli, 75001 Paris, France',
                center: [2.3522, 48.8566],
            },
        ]);
    });

    it('geocodes a full pickup and delivery address on create, no dimensions needed', async () => {
        getByIdMock.mockResolvedValue(
            pendingQuote({
                pickupAddress: '10 Rue de Rivoli',
                pickupPostalCode: '75001',
                pickupCity: 'Paris',
                pickupLat: null,
                pickupLng: null,
                deliveryAddress: '1 Place Bellecour',
                deliveryPostalCode: '69002',
                deliveryCity: 'Lyon',
                deliveryLat: null,
                deliveryLng: null,
                // No lengthCm/widthCm/heightCm/weightKg: hasDimensions is false,
                // so autoPrice bails out and only geocodeMissingCoordinates writes.
            }) as never
        );

        await expedionService.createQuote('user_abc', {
            pickupAddress: '10 Rue de Rivoli',
            pickupPostalCode: '75001',
            pickupCity: 'Paris',
            deliveryAddress: '1 Place Bellecour',
            deliveryPostalCode: '69002',
            deliveryCity: 'Lyon',
        } as never);
        await vi.waitFor(() => expect(updateMock).toHaveBeenCalled());

        expect(searchAddressMock).toHaveBeenCalledTimes(2);
        expect(lastPatch()).toMatchObject({
            pickupLat: 48.8566,
            pickupLng: 2.3522,
            deliveryLat: 48.8566,
            deliveryLng: 2.3522,
        });
    });

    it('does not re-geocode a side that already has coordinates', async () => {
        getByIdMock.mockResolvedValue(
            pendingQuote({
                pickupAddress: '10 Rue de Rivoli',
                pickupPostalCode: '75001',
                pickupCity: 'Paris',
                pickupLat: 48.85,
                pickupLng: 2.35,
            }) as never
        );

        await expedionService.createQuote('user_abc', {
            pickupAddress: '10 Rue de Rivoli',
            pickupPostalCode: '75001',
            pickupCity: 'Paris',
        } as never);
        await flushBackgroundWork();

        expect(searchAddressMock).not.toHaveBeenCalled();
    });

    it('clears stale coordinates immediately when the pickup address is edited', async () => {
        getByIdMock.mockResolvedValue(
            pendingQuote({
                pickupAddress: '10 Rue de Rivoli',
                pickupPostalCode: '75001',
                pickupCity: 'Paris',
                pickupLat: 48.85,
                pickupLng: 2.35,
            }) as never
        );

        await expedionService.updateQuote('q_1', OWNER_CALLER, {
            pickupAddress: '2 Rue de Rivoli',
        });

        // Synchronous: the stale pin is cleared in the same patch that saves
        // the new address, before the background re-geocode even starts.
        expect(lastPatch()).toMatchObject({ pickupLat: null, pickupLng: null });
    });
});
