import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addressesService } from '../addresses.service';
import { addressesDal } from '@/server/dal/addresses.dal';

vi.mock('@/server/dal/addresses.dal', () => ({
  addressesDal: {
    create: vi.fn(),
    getByUserId: vi.fn(),
    getDefaultByUserId: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getOwner: vi.fn(),
    clearDefaultForUser: vi.fn(),
    setAsDefault: vi.fn(),
  }
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'nano-id'
}));

describe('addressesService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('create', () => {
        it('should create address', async () => {
            vi.mocked(addressesDal.create).mockResolvedValue({ id: 'addr-1' } as any);

            const input = {
                label: 'Home',
                street: '123 Main St',
                city: 'Paris',
                zip: '75001',
                country: 'France',
                lat: 48.8566,
                lng: 2.3522,
                isDefault: false
            };

            const result = await addressesService.create('user-1', input);
            expect(addressesDal.create).toHaveBeenCalled();
            expect(result.id).toBe('addr-1');
        });

        it('should clear default if new address is default', async () => {
            vi.mocked(addressesDal.create).mockResolvedValue({ id: 'addr-1' } as any);
            const input = {
                label: 'Home',
                street: '123 Main St',
                city: 'Paris',
                zip: '75001',
                country: 'France',
                lat: 48.8566,
                lng: 2.3522,
                isDefault: true
            };

            await addressesService.create('user-1', input);
            expect(addressesDal.clearDefaultForUser).toHaveBeenCalledWith('user-1');
        });
    });

    describe('delete', () => {
        it('should delete own address', async () => {
            vi.mocked(addressesDal.getOwner).mockResolvedValue('user-1');
            vi.mocked(addressesDal.delete).mockResolvedValue({ id: 'addr-1' } as any);

            await addressesService.delete('addr-1', 'user-1');
            expect(addressesDal.delete).toHaveBeenCalledWith('addr-1');
        });

        it('should throw if not owner', async () => {
            vi.mocked(addressesDal.getOwner).mockResolvedValue('other-user');
            
            await expect(addressesService.delete('addr-1', 'user-1'))
                .rejects.toThrow('Not authorized');
        });
    });
});
