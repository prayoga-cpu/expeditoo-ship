import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expedionService, ExpedionError } from '../expedion.service';
import { expedionDal, type QuoteFilters } from '@/server/dal/expedion.dal';
import { adminUpdateExpedionQuoteSchema } from '@/server/dto/expedion.dto';

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
    assignedCarrierId: null,
    escalateAfter: ESCALATE_AFTER,
    storageFreeUntil: STORAGE_FREE_UNTIL,
    phone: '+33600000000',
    firstName: 'Ada',
    pickupCity: 'Lyon',
    bordereauNumber: 'B-77',
    ...over,
});

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
        getByIdMock.mockResolvedValue(paidQuote() as never);

        await expedionService.adminUpdate(
            'q_1',
            body({ quoteStandardCents: 12_000, quoteInsuredCents: 14_400 })
        );

        expect(lastPatch()).not.toHaveProperty('escalateAfter');
        expect(lastPatch()).not.toHaveProperty('storageFreeUntil');
    });

    it('leaves the deadlines alone when assigning a driver', async () => {
        getByIdMock.mockResolvedValue(paidQuote() as never);

        await expedionService.adminUpdate('q_1', body({ assignedCarrierId: 'car_1' }));

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
        getByIdMock.mockResolvedValue(paidQuote() as never);

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

describe('expedionService.adminUpdate — assigning answers to the graph', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMock.mockImplementation(
            async (_id, patch) => ({ ...paidQuote(), ...patch }) as never
        );
    });

    it('assigns a paid quote', async () => {
        getByIdMock.mockResolvedValue(paidQuote() as never);

        await expedionService.adminUpdate('q_1', body({ assignedCarrierId: 'car_1' }));

        expect(lastPatch()).toMatchObject({
            assignedCarrierId: 'car_1',
            status: 'assigned',
        });
        expect(lastPatch().assignedAt).toBeInstanceOf(Date);
    });

    it('assigns a quote that has already escalated', async () => {
        getByIdMock.mockResolvedValue(paidQuote({ status: 'escalated' }) as never);

        await expedionService.adminUpdate('q_1', body({ assignedCarrierId: 'car_1' }));

        expect(lastPatch().status).toBe('assigned');
    });

    it('swaps the driver on an already-assigned quote', async () => {
        getByIdMock.mockResolvedValue(
            paidQuote({ status: 'assigned', assignedCarrierId: 'car_0' }) as never
        );

        await expedionService.adminUpdate('q_1', body({ assignedCarrierId: 'car_1' }));

        expect(lastPatch()).toMatchObject({
            assignedCarrierId: 'car_1',
            status: 'assigned',
        });
    });

    // The dashboard offers "assign" on every row, including the finished ones
    // in the recent list, so this is reachable by a single misclick.
    it.each(['cancelled', 'delivered'] as const)(
        'refuses to drag a %s quote back to assigned',
        async (status) => {
            getByIdMock.mockResolvedValue(paidQuote({ status }) as never);

            const rejection = expedionService.adminUpdate(
                'q_1',
                body({ assignedCarrierId: 'car_1' })
            );

            await expect(rejection).rejects.toBeInstanceOf(ExpedionError);
            await expect(rejection).rejects.toMatchObject({
                code: 'INVALID_TRANSITION',
                status: 409,
            });
            expect(updateMock).not.toHaveBeenCalled();
        }
    );

    it('still refuses an illegal status the operator states outright', async () => {
        getByIdMock.mockResolvedValue(paidQuote({ status: 'cancelled' }) as never);

        await expect(
            expedionService.adminUpdate('q_1', body({ status: 'picked_up' }))
        ).rejects.toMatchObject({ code: 'INVALID_TRANSITION', status: 409 });
    });
});
