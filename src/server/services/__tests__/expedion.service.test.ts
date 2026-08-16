import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expedionService } from '../expedion.service';
import { expedionDal, type QuoteFilters } from '@/server/dal/expedion.dal';

// Only `list` is exercised here; the rest of the DAL is stubbed so the suite
// never touches a database.
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

const listMock = vi.mocked(expedionDal.list);

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
