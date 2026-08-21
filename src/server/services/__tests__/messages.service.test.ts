import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messagesService } from '../messages.service';
import { messagesDAL } from '@/server/dal/messages.dal';
import * as userService from '@/server/services/user.service';
import { reviewsService } from '@/server/services/reviews.service';
import { ablyServer } from '@/lib/ably-server';

vi.mock('@/lib/ably-server', () => {
  const ablyServerMock = {
    publishMessage: vi.fn(),
    publishMessageBadge: vi.fn(),
    publishNotification: vi.fn(),
  };
  return {
    ablyServer: ablyServerMock,
    default: { ablyServer: ablyServerMock }
  };
});

vi.mock('@/server/dal/messages.dal', () => ({
  messagesDAL: {
    findConversation: vi.fn(),
    findSupportConversation: vi.fn(),
    createConversation: vi.fn(),
    getConversationById: vi.fn(),
    createMessage: vi.fn(),
    getUnreadCount: vi.fn(),
    getUserConversations: vi.fn(),
    getMessages: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsSeen: vi.fn(),
    softDeleteConversation: vi.fn(),
    addParticipant: vi.fn(),
  }
}));

vi.mock('@/server/services/user.service', () => ({
  hasRole: vi.fn(),
}));

vi.mock('@/server/services/reviews.service', () => ({
  reviewsService: {
    getUserStats: vi.fn(),
  }
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'nano-id',
}));

describe('messagesService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have ablyServer mocked', () => {
        expect(ablyServer).toBeDefined();
        expect(ablyServer.publishMessage).toBeDefined();
    });

    describe('sendMessage', () => {
        it('should create new conversation if not exists', async () => {
            vi.mocked(messagesDAL.findConversation).mockResolvedValue(null);
            vi.mocked(messagesDAL.createConversation).mockResolvedValue({ id: 'conv-1' } as any);
            vi.mocked(messagesDAL.createMessage).mockResolvedValue({ id: 'msg-1', createdAt: new Date() } as any);

            const result = await messagesService.sendMessage('user-1', {
                recipientId: 'user-2',
                content: 'Hello',
                conversationId: undefined
            });

            expect(messagesDAL.createConversation).toHaveBeenCalled();
            expect(result.conversationId).toBe('conv-1');
            // expect(ablyServer.publishMessage).toHaveBeenCalled(); // Disabled in service for now
        });

        it('should use existing conversation', async () => {
             vi.mocked(messagesDAL.findConversation).mockResolvedValue({ id: 'conv-exist' } as any);
             vi.mocked(messagesDAL.createMessage).mockResolvedValue({ id: 'msg-1', createdAt: new Date() } as any);

             const result = await messagesService.sendMessage('user-1', {
                 recipientId: 'user-2',
                 content: 'Hello',
                 conversationId: undefined
             });

             expect(messagesDAL.createConversation).not.toHaveBeenCalled();
             expect(result.conversationId).toBe('conv-exist');
        });

        it('should allow admin to join support chat', async () => {
             vi.mocked(messagesDAL.getConversationById).mockResolvedValue({
                 id: 'support-chat',
                 type: 'SUPPORT',
                 participants: [{ user: { id: 'user-other' } }]
             } as any);
             vi.mocked(userService.hasRole).mockResolvedValue(true);
             vi.mocked(messagesDAL.createMessage).mockResolvedValue({ id: 'msg-1', createdAt: new Date() } as any);

             await messagesService.sendMessage('admin-user', {
                 conversationId: 'support-chat',
                 content: 'Helping out'
             });

             expect(messagesDAL.addParticipant).toHaveBeenCalledWith('support-chat', 'admin-user');
        });
    });

    describe('getOrCreateSupportConversation', () => {
        it('returns the existing thread without creating a new one', async () => {
            vi.mocked(messagesDAL.findSupportConversation).mockResolvedValue({ id: 'support-1' } as any);

            const result = await messagesService.getOrCreateSupportConversation('user-1');

            expect(result).toEqual({ conversationId: 'support-1', created: false });
            expect(messagesDAL.createConversation).not.toHaveBeenCalled();
        });

        it('creates a SUPPORT conversation on first use', async () => {
            vi.mocked(messagesDAL.findSupportConversation).mockResolvedValue(null as never);
            vi.mocked(messagesDAL.createConversation).mockResolvedValue({ id: 'nano-id' } as any);

            const result = await messagesService.getOrCreateSupportConversation('user-1');

            expect(messagesDAL.createConversation).toHaveBeenCalledWith(
                { id: 'nano-id', type: 'SUPPORT', listingId: null },
                ['user-1']
            );
            expect(result).toEqual({ conversationId: 'nano-id', created: true });
        });
    });

    describe('getInbox', () => {
        it('should return transformed conversations', async () => {
            vi.mocked(messagesDAL.getUserConversations).mockResolvedValue([
                {
                    id: 'conv-1',
                    participants: [
                        { user: { id: 'user-1' }, lastReadAt: new Date('2023-01-01') },
                        { user: { id: 'user-2' } }
                    ],
                    lastMessageAt: new Date('2023-01-02'),
                    messages: [{ content: 'Last msg' }]
                }
            ] as any);

            const result = await messagesService.getInbox('user-1', { page: 1, limit: 10 });
            
            expect(result.items[0].isUnread).toBe(true); // lastMessageAt > lastReadAt
            expect(result.items[0].lastMessage).toBe('Last msg');
        });
    });

    describe('getThread read receipts', () => {
        beforeEach(() => {
            vi.mocked(messagesDAL.getConversationById).mockResolvedValue({
                id: 'conv-1',
                participants: [
                    { userId: 'user-1', user: { id: 'user-1' }, lastReadAt: null, lastClearedAt: null },
                    { userId: 'user-2', user: { id: 'user-2' }, lastReadAt: null, lastClearedAt: null },
                ],
            } as any);
            vi.mocked(messagesDAL.getMessages).mockResolvedValue([] as any);
        });

        it('marks the thread read on the first page', async () => {
            await messagesService.getThread('user-1', 'conv-1', { page: 1, limit: 50 });

            expect(messagesDAL.markAsRead).toHaveBeenCalledWith('conv-1', 'user-1');
        });

        it('does not mark it read when an admin is only viewing', async () => {
            // The write is visible to the other party as a read receipt, so an
            // impersonated view would tell them their message had been read by
            // somebody who never read it -- and it cannot be undone.
            await messagesService.getThread(
                'user-1', 'conv-1', { page: 1, limit: 50 }, { markRead: false }
            );

            expect(messagesDAL.markAsRead).not.toHaveBeenCalled();
        });
    });
});
