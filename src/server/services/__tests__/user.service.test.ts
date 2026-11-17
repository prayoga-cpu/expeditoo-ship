import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as userService from '../user.service';
import * as usersDAL from '@/server/dal/users.dal';
import { carriersDal } from '@/server/dal/carriers.dal';
import { carrierService, CarrierError } from '@/server/services/carrier.service';


// Mock dependencies
vi.mock('@/server/dal/users.dal', () => ({
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  assignRole: vi.fn(),
  replaceUserRole: vi.fn(),
  removeRole: vi.fn(),
  userHasRole: vi.fn(),
  getUserRoles: vi.fn(),
  getUsers: vi.fn(),
}));

vi.mock('@/server/services/carrier.service', () => {
  class CarrierError extends Error {
    constructor(readonly code: string, readonly status: number, message?: string) {
      super(message ?? code);
    }
  }
  return { CarrierError, carrierService: { grantRole: vi.fn() } };
});

vi.mock('@/server/dal/carriers.dal', () => ({
  carriersDal: {
    getByUserId: vi.fn(),
    statusesByUserIds: vi.fn(),
  },
}));

describe('userService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getProfile', () => {
        it('should return valid user profile', async () => {
            const mockUser = {
                id: '1', email: 'test@example.com', name: 'Test',
                image: null, emailVerified: true, isVerified: false, banned: false,
                roles: [{ role: 'shipper' }], createdAt: new Date(), updatedAt: new Date()
            };
            vi.mocked(usersDAL.getUserById).mockResolvedValue(mockUser as any);

            const result = await userService.getProfile('1');

            expect(result).toEqual(expect.objectContaining({
                id: '1',
                email: 'test@example.com',
                roles: ['shipper']
            }));
        });

        it('should throw if user not found', async () => {
            vi.mocked(usersDAL.getUserById).mockResolvedValue(undefined);
            await expect(userService.getProfile('1')).rejects.toThrow('User not found');
        });
    });

    describe('updatePreferences', () => {
        it('should merge and update preferences', async () => {
            const mockUser = {
                id: '1', 
                preferences: { notifications: { email: { marketing: true } } }
            };
            vi.mocked(usersDAL.getUserById).mockResolvedValue(mockUser as any);

            await userService.updatePreferences('1', {
                notifications: { email: { marketing: false } } as never,
            });

            expect(usersDAL.updateUser).toHaveBeenCalledWith('1', {
                preferences: expect.objectContaining({
                    notifications: expect.objectContaining({
                        email: expect.objectContaining({ marketing: false })
                    })
                })
            });
        });
    });

    describe('assignRole', () => {
        it('should assign role if admin', async () => {
            // Mock admin check
            vi.mocked(usersDAL.getUserById)
                .mockResolvedValueOnce({ roles: [{ role: 'admin' }] } as any) // Admin query
                .mockResolvedValueOnce({ id: 'target' } as any); // Target query

            const result = await userService.assignRole({ userId: 'target', role: 'operator' }, 'admin-id');

            expect(result.success).toBe(true);
            expect(usersDAL.assignRole).toHaveBeenCalledWith('target', 'operator', 'admin-id');
        });

        it.each(['carrier', 'driver'] as const)(
            'grants %s through the carrier service, which creates or approves the file',
            async (role) => {
                vi.mocked(usersDAL.getUserById)
                    .mockResolvedValueOnce({ roles: [{ role: 'admin' }] } as any)
                    .mockResolvedValueOnce({ id: 'target' } as any);

                const result = await userService.assignRole({ userId: 'target', role }, 'admin-id');

                expect(result.success).toBe(true);
                expect(carrierService.grantRole).toHaveBeenCalledWith('admin-id', 'target', role);
                // The service writes the role with its file; the DAL is not asked to.
                expect(usersDAL.assignRole).not.toHaveBeenCalled();
            }
        );

        it('reports a refusal from the carrier service instead of throwing', async () => {
            vi.mocked(usersDAL.getUserById)
                .mockResolvedValueOnce({ roles: [{ role: 'admin' }] } as any)
                .mockResolvedValueOnce({ id: 'target' } as any);
            vi.mocked(carrierService.grantRole).mockRejectedValueOnce(new CarrierError('CARRIER_SUSPENDED', 409));

            const result = await userService.assignRole({ userId: 'target', role: 'driver' }, 'admin-id');

            expect(result).toEqual({ success: false, message: 'CARRIER_SUSPENDED' });
        });

        it('should throw if not admin', async () => {
             vi.mocked(usersDAL.getUserById).mockResolvedValue({ roles: [{ role: 'user' }] } as any);
             
             await expect(userService.assignRole({ userId: 'target', role: 'carrier' }, 'user-id'))
                .rejects.toThrow('Unauthorized: Admin role required');
        });
    });

    describe('getUsers', () => {
        it('reports where each account stands with its driver application', async () => {
            vi.mocked(usersDAL.getUserById).mockResolvedValue({ roles: [{ role: 'admin' }] } as any);
            const row = (id: string) => ({
                id, email: `${id}@example.com`, name: id, image: null,
                emailVerified: true, isVerified: false, banned: false,
                roles: [], createdAt: new Date(), lastLoginAt: null, alias: null, origin: 'expeditoo',
            });
            vi.mocked(usersDAL.getUsers).mockResolvedValue({
                users: [row('applicant'), row('plain')],
                total: 2, page: 1, pageSize: 50, totalPages: 1,
            } as any);
            vi.mocked(carriersDal.statusesByUserIds).mockResolvedValue(
                new Map([['applicant', 'submitted']]) as any
            );

            const result = await userService.getUsers({}, 'admin-id');

            expect(carriersDal.statusesByUserIds).toHaveBeenCalledWith(['applicant', 'plain']);
            expect(result.users.map((u) => [u.id, u.driverApplication])).toEqual([
                ['applicant', 'submitted'],
                ['plain', null],
            ]);
        });

        it('filters on several roles at once, for the Drivers list', async () => {
            vi.mocked(usersDAL.getUserById).mockResolvedValue({ roles: [{ role: 'admin' }] } as any);
            vi.mocked(usersDAL.getUsers).mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 50, totalPages: 0 } as any);
            vi.mocked(carriersDal.statusesByUserIds).mockResolvedValue(new Map() as any);

            await userService.getUsers({ role: 'carrier,driver' }, 'admin-id');

            expect(usersDAL.getUsers).toHaveBeenCalledWith(
                expect.objectContaining({ roles: ['carrier', 'driver'] })
            );
        });
    });
});
