import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationsService } from '../notifications.service';
import { notificationsDal } from '@/server/dal/notifications.dal';
import { ablyServer } from '@/lib/ably-server';

// Mock dependencies
vi.mock('@/server/dal/notifications.dal', () => ({
  notificationsDal: {
    create: vi.fn(),
    getByUserId: vi.fn(),
    countUnread: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  }
}));

vi.mock('@/lib/ably-server', () => ({
  ablyServer: {
    publishNotification: vi.fn(),
  }
}));

describe('notificationsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createNotification', () => {
        it('should create notification and publish to Ably', async () => {
            vi.mocked(notificationsDal.create).mockResolvedValue({
                id: 'notif-1',
                type: 'INFO',
                title: 'Test',
                message: 'Msg',
                createdAt: new Date(),
                userId: 'user-1'
            } as any);

            const result = await notificationsService.createNotification({
                userId: 'user-1',
                type: 'INFO',
                title: 'Test',
                message: 'Msg'
            });

            expect(result.id).toBe('notif-1');
            expect(ablyServer.publishNotification).toHaveBeenCalledWith('user-1', expect.objectContaining({
                title: 'Test',
                type: 'INFO'
            }));
        });
    });

    describe('getUserNotifications', () => {
        it('should return paginated notifications', async () => {
            vi.mocked(notificationsDal.getByUserId).mockResolvedValue({
                items: [], total: 0
            });
            vi.mocked(notificationsDal.countUnread).mockResolvedValue(5);

            const result = await notificationsService.getUserNotifications('user-1', { limit: 10, offset: 0, filter: 'all' });

            expect(result.meta.unreadCount).toBe(5);
            expect(notificationsDal.getByUserId).toHaveBeenCalled();
        });
    });
});
