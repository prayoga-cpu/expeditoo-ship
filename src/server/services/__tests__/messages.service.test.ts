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
});
