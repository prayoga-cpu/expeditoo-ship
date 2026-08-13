import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '../auth.service';
import * as usersDAL from '@/server/dal/users.dal';

const mocks = vi.hoisted(() => {
  return {
    send: vi.fn().mockResolvedValue({ id: 'email-id' }),
  }
})

// Mock dependencies
vi.mock('resend', () => {
  return {
    Resend: class {
      emails = {
        send: mocks.send
      }
    }
  };
});

vi.mock('@/server/dal/users.dal', () => ({
  assignDefaultRole: vi.fn(),
  getUserByEmail: vi.fn(),
}));

describe('authService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handlePostSignup', () => {
        it('should assign default role', async () => {
            await authService.handlePostSignup('user-1', 'test@mail.com');
            expect(usersDAL.assignDefaultRole).toHaveBeenCalledWith('user-1');
        });
    });

    describe('sendVerificationEmail', () => {
        it('should send email using Resend', async () => {
            vi.mocked(usersDAL.getUserByEmail).mockResolvedValue({ name: 'Test User' } as any);

            await authService.sendVerificationEmail('test@mail.com');

            expect(usersDAL.getUserByEmail).toHaveBeenCalledWith('test@mail.com');
            expect(mocks.send).toHaveBeenCalled();
        });
    });
});

