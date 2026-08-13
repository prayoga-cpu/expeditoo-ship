import "dotenv/config";
import { db } from "@/db";
import { user } from "@/db/schema/users";
import { messagesService } from "@/server/services/messages.service";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

async function main() {
  console.log("🚀 Starting Chat Verification...");
  
  // 1. Setup Users
  const senderEmail = "sender@test.com";
  const receiverEmail = "receiver@test.com";

  // Clean up previous runs
  await db.delete(user).where(eq(user.email, senderEmail));
  await db.delete(user).where(eq(user.email, receiverEmail));

  const [sender] = await db.insert(user).values({
    id: nanoid(),
    name: "Test Sender",
    email: senderEmail,
    emailVerified: true
  }).returning();

  const [receiver] = await db.insert(user).values({
    id: nanoid(),
    name: "Test Receiver",
    email: receiverEmail,
    emailVerified: true
  }).returning();

  console.log(`✅ Users created: ${sender.name} (${sender.id}) -> ${receiver.name} (${receiver.id})`);

  // 2. Send Message (Sender -> Receiver)
  console.log("📨 Sending message...");
  const sent = await messagesService.sendMessage(sender.id, {
    recipientId: receiver.id,
    content: "Hello verify chat!"
  });

  console.log(`✅ Message sent! Thread ID: ${sent.conversationId}`);

  // 3. Check Receiver Inbox
  console.log("📥 Checking receiver inbox...");
  const inbox = await messagesService.getInbox(receiver.id, { page: 1, limit: 10 });
  const foundConversation = inbox.items.find(c => c.id === sent.conversationId);

  if (!foundConversation) throw new Error("Conversation not found in inbox");
  if (!foundConversation.isUnread) throw new Error("Conversation should be unread");
  console.log("✅ Conversation found and is unread.");

  // 4. Receiver reads thread
  console.log("👀 Receiver opening thread...");
  const thread = await messagesService.getThread(receiver.id, sent.conversationId, { page: 1, limit: 10 });
  
  const msg = thread.messages.find(m => m.id === sent.message.id);
  if (!msg) throw new Error("Message not found in thread");
  console.log("✅ Message found in thread.");

  // 5. Check Sender view for Read Receipt
  // Note: getThread for receiver triggers markAsRead. So sender should see it now.
  console.log("🕵️ Sender checking read receipt...");
  const senderThread = await messagesService.getThread(sender.id, sent.conversationId, { page: 1, limit: 10 });
  const senderMsg = senderThread.messages.find(m => m.id === sent.message.id);

  if (!senderMsg?.readByOther) {
     console.error("DEBUG Info:", {
       senderMsg,
       receiverId: receiver.id,
       senderId: sender.id
     });
     throw new Error("Read receipt check failed");
  }
  console.log("✅ Read receipt verified!");

  // Cleanup
  console.log("🧹 Cleaning up...");
  await db.delete(user).where(eq(user.email, senderEmail));
  await db.delete(user).where(eq(user.email, receiverEmail));
  console.log("✨ Done.");
  
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
