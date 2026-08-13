import { describe, it, expect, vi, beforeEach } from 'vitest';
import { driverService } from '../driver.service';
import { driverApplicationDal } from '@/server/dal/driver.dal';
import { db } from '@/db';

vi.mock('@/server/dal/driver.dal', () => ({
  driverApplicationDal: {
    getByUserId: vi.fn(),
    create: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    updateStatus: vi.fn(),
  }
}));

vi.mock('@/db', () => ({
  db: {
    query: {
        userRoles: {
            findFirst: vi.fn()
        }
    },
    insert: vi.fn().mockReturnValue({ values: vi.fn() })
  }
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'nano-id'
}));

describe('driverService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('submitApplication', () => {
        it('should submit new application', async () => {
            vi.mocked(driverApplicationDal.getByUserId).mockResolvedValue(null);
            vi.mocked(driverApplicationDal.create).mockResolvedValue({ id: 'app-1' } as any);

            const result = await driverService.submitApplication('user-1', {
                vehicleType: 'VAN',
                licenseNumber: 'ABC'
            } as any);

            expect(driverApplicationDal.create).toHaveBeenCalled();
            expect(result.id).toBe('app-1');
        });

        it('should throw if application exists', async () => {
            vi.mocked(driverApplicationDal.getByUserId).mockResolvedValue({ id: 'app-exist' } as any);

            await expect(driverService.submitApplication('user-1', {} as any))
                .rejects.toThrow('Une candidature existe déjà');
        });
    });

    describe('isUserDriver', () => {
        it('should return true if user has transporter role', async () => {
            vi.mocked(db.query.userRoles.findFirst).mockResolvedValue({ role: 'transporter' } as any);
            const isDriver = await driverService.isUserDriver('user-1');
            expect(isDriver).toBe(true);
        });
    });
});
