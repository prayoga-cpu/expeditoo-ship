import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as userService from '../user.service';
import * as usersDAL from '@/server/dal/users.dal';


// Mock dependencies
vi.mock('@/server/dal/users.dal', () => ({
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  assignRole: vi.fn(),
  replaceUserRole: vi.fn(),
  removeRole: vi.fn(),
  userHasRole: vi.fn(),
  getUserRoles: vi.fn(),
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
                roles: [{ role: 'buyer' }], createdAt: new Date(), updatedAt: new Date()
            };
            vi.mocked(usersDAL.getUserById).mockResolvedValue(mockUser as any);

            const result = await userService.getProfile('1');

            expect(result).toEqual(expect.objectContaining({
                id: '1',
                email: 'test@example.com',
                roles: ['buyer']
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

            const result = await userService.assignRole({ userId: 'target', role: 'seller' }, 'admin-id');

            expect(result.success).toBe(true);
            expect(usersDAL.assignRole).toHaveBeenCalledWith('target', 'seller', 'admin-id');
        });

        it('should throw if not admin', async () => {
             vi.mocked(usersDAL.getUserById).mockResolvedValue({ roles: [{ role: 'user' }] } as any);
             
             await expect(userService.assignRole({ userId: 'target', role: 'seller' }, 'user-id'))
                .rejects.toThrow('Unauthorized: Admin role required');
        });
    });
});
