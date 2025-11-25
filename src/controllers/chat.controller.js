import prisma from "../config/prisma.js"

// Get or create one-to-one chat room
export const getOrCreateChatRoom = async (req, res) => {
  try {
    const { userId } = req.body
    const currentUserId = req.user.id

    console.log("[Chat Controller] Get/create chat room")
    console.log("[Chat Controller] Current user ID:", currentUserId)
    console.log("[Chat Controller] Target user ID:", userId)
    console.log("[Chat Controller] Request body:", req.body)

    // Validation
    if (!userId) {
      return res.status(400).json({ message: "userId is required" })
    }

    if (userId === currentUserId) {
      return res.status(400).json({ message: "Cannot chat with yourself" })
    }

    // IMPORTANT: Don't parse as integer - keep as string for CUID
    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" })
    }

    console.log("[Chat Controller] Target user found:", targetUser.firstName, targetUser.lastName)

    // Check if chat room already exists between these two users
    const existingRoom = await prisma.chatRoom.findFirst({
      where: {
        isGroup: false,
        AND: [
          {
            members: {
              some: {
                userId: currentUserId
              }
            }
          },
          {
            members: {
              some: {
                userId: userId
              }
            }
          }
        ]
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                avatar: true,    // ✅ ADD
                isOnline: true,  // ✅ ADD (if you use this)
                lastSeenAt: true // ✅ ADD
              },
            },
          },
        },
        messages: {
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            readReceipts: true,
          },
        },
      },
    })

    if (existingRoom) {
      console.log("[Chat Controller] Found existing room:", existingRoom.id)

      // Calculate unread count
      const unreadCount = await prisma.chatMessage.count({
        where: {
          chatRoomId: existingRoom.id,
          senderId: { not: currentUserId },
          readReceipts: {
            none: {
              userId: currentUserId,
            },
          },
        },
      })

      return res.json({
        ...existingRoom,
        unreadCount
      })
    }

    console.log("[Chat Controller] Creating new chat room")

    // Create new chat room
    const chatRoom = await prisma.chatRoom.create({
      data: {
        isGroup: false,  // ✅ One-to-one chat
        members: {
          create: [
            { userId: currentUserId },  // ✅ Current user
            { userId: userId }           // ✅ Target user
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                avatar: true,    // ✅ ADD
                isOnline: true,  // ✅ ADD (if you use this)
                lastSeenAt: true // ✅ ADD
              },
            },
          },
        },
        messages: true,
      },
    })

    console.log("[Chat Controller] Chat room created:", chatRoom.id)

    res.status(201).json({
      ...chatRoom,
      unreadCount: 0
    })
  } catch (error) {
    console.error("[Chat Controller] Get/create chat room error:", error)
    console.error("[Chat Controller] Error message:", error.message)
    console.error("[Chat Controller] Error stack:", error.stack)

    res.status(500).json({
      message: "Failed to get or create chat room",
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// Create group chat
export const createGroupChat = async (req, res) => {
  try {
    const { name, memberIds } = req.body
    const currentUserId = req.user.id

    console.log("[Chat Controller] Create group chat")
    console.log("[Chat Controller] Current user:", currentUserId)
    console.log("[Chat Controller] Member IDs:", memberIds)

    if (!memberIds || memberIds.length < 2) {
      return res.status(400).json({ message: "Group chat requires at least 2 other members" })
    }

    // Verify all members exist
    const users = await prisma.user.findMany({
      where: { id: { in: memberIds } }
    })

    if (users.length !== memberIds.length) {
      return res.status(404).json({ message: "Some users not found" })
    }

    // Add current user to members
    const allMemberIds = [currentUserId, ...memberIds]

    const chatRoom = await prisma.chatRoom.create({
      data: {
        name,
        isGroup: true,
        members: {
          create: allMemberIds.map((userId) => ({ userId })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
        messages: true,
      },
    })

    console.log("[Chat Controller] Group chat created:", chatRoom.id)

    res.status(201).json({
      ...chatRoom,
      unreadCount: 0
    })
  } catch (error) {
    console.error("[Chat Controller] Create group chat error:", error)
    res.status(500).json({
      message: "Failed to create group chat",
      error: error.message
    })
  }
}

// Get conversations with unread counts
export const getConversations = async (req, res) => {
  try {
    const currentUserId = req.user.id

    const chatRooms = await prisma.chatRoom.findMany({
      where: {
        members: {
          some: {
            userId: currentUserId,
          },
        },
        isActive: true, // ✅ Only active chats
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                avatar: true,
                isOnline: true, // ✅ Show online status
                lastSeenAt: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            media: true, // ✅ Include media for preview
            readReceipts: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: "desc", // ✅ Sort by most recent
      },
    })

    // ✅ Add unread count for each conversation
    const conversations = chatRooms.map((room) => {
      const currentMember = room.members.find((m) => m.userId === currentUserId)
      return {
        ...room,
        unreadCount: currentMember?.unreadCount || 0,
      }
    })

    res.json(conversations)
  } catch (error) {
    console.error("[Chat Controller] Get conversations error:", error)
    res.status(500).json({
      message: "Failed to get conversations",
      error: error.message
    })
  }
}

// Get all chat rooms for current user
export const getMyChatRooms = async (req, res) => {
  try {
    const currentUserId = req.user.id

    console.log("[Chat Controller] Get my chat rooms for user:", currentUserId)

    const chatRooms = await prisma.chatRoom.findMany({
      where: {
        members: {
          some: {
            userId: currentUserId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                avatar: true,    // ✅
                isOnline: true,  // ✅
                lastSeenAt: true // ✅ (if these fields exist)
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    console.log("[Chat Controller] Found chat rooms:", chatRooms.length)

    const roomsWithUnread = await Promise.all(
      chatRooms.map(async (room) => {
        const unreadMessages = await prisma.chatMessage.count({
          where: {
            chatRoomId: room.id,
            senderId: { not: currentUserId },
            readReceipts: {
              none: {
                userId: currentUserId,
              },
            },
          },
        })

        return {
          ...room,
          unreadCount: unreadMessages,
        }
      }),
    )

    res.json(roomsWithUnread)
  } catch (error) {
    console.error("[Chat Controller] Get chat rooms error:", error)
    res.status(500).json({
      message: "Failed to fetch chat rooms",
      error: error.message
    })
  }
}

// Get messages for a chat room
export const getChatMessages = async (req, res) => {
  try {
    const { roomId, conversationId } = req.params
    const chatRoomId = roomId || conversationId
    const { limit = 50, before } = req.query
    const currentUserId = req.user.id

    console.log("[Chat Controller] Get messages for room:", chatRoomId)

    // Verify user is member of the room
    const member = await prisma.chatRoomMember.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: chatRoomId,
          userId: currentUserId,
        },
      },
    })

    if (!member) {
      return res.status(403).json({ message: "Not a member of this chat room" })
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        chatRoomId: chatRoomId,
        ...(before && {
          createdAt: {
            lt: new Date(before),
          },
        }),
      },
      take: Number.parseInt(limit),
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        media: true, // ✅ ADD THIS - Include media attachments
        reactions: {  // ✅ ADD THIS - Include reactions
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

    console.log("[Chat Controller] Found messages:", messages.length)

    res.json(messages.reverse())
  } catch (error) {
    console.error("[Chat Controller] Get messages error:", error)
    res.status(500).json({
      message: "Failed to fetch messages",
      error: error.message
    })
  }
}

export const sendMessage = async (req, res) => {
  try {
    const { roomId, conversationId } = req.params
    const chatRoomId = roomId || conversationId
    const { content } = req.body
    const currentUserId = req.user.id

    console.log("[Chat Controller] Send message to room:", chatRoomId)
    console.log("[Chat Controller] Content:", content)

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Message content is required" })
    }

    // Verify user is member of chat room
    const member = await prisma.chatRoomMember.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: chatRoomId,
          userId: currentUserId,
        },
      },
    })

    if (!member) {
      return res.status(403).json({ message: "Not a member of this chat room" })
    }

    // Create message with full relations
    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId: chatRoomId,
        senderId: currentUserId,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        media: true, // ✅ Include media attachments
        reactions: true, // ✅ Include reactions
      },
    })

    // ✅ Update chat room's lastMessage and lastMessageAt
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: {
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        lastMessageId: message.id,
      },
    })

    // ✅ Increment unread count for other members
    const otherMembers = await prisma.chatRoomMember.findMany({
      where: {
        chatRoomId,
        userId: { not: currentUserId },
      },
    })

    await Promise.all(
      otherMembers.map((member) =>
        prisma.chatRoomMember.update({
          where: { id: member.id },
          data: {
            unreadCount: { increment: 1 },
          },
        })
      )
    )

    console.log("[Chat Controller] Message created:", message.id)

    // ✅ Emit socket event to room
    const io = req.app.get("io")
    if (io) {
      io.to(`chat-${chatRoomId}`).emit("new-message", message)
      console.log("[Chat Controller] Emitted new-message to room:", chatRoomId)
    }

    // ✅ Create notifications for other members
    for (const member of otherMembers) {
      await prisma.notification.create({
        data: {
          userId: member.userId,
          type: "MESSAGE",
          title: `New message from ${req.user.firstName} ${req.user.lastName}`,
          message: content.trim().substring(0, 100),
          chatRoomId,
          messageId: message.id,
          senderId: currentUserId,
          metadata: {
            chatRoomId,
            messageId: message.id,
            senderName: `${req.user.firstName} ${req.user.lastName}`,
          },
        },
      })

      // ✅ Emit notification to specific user
      if (io) {
        io.to(`user-${member.userId}`).emit("notification", {
          type: "MESSAGE",
          chatRoomId,
          messageId: message.id,
          message,
        })
      }
    }

    res.status(201).json(message)
  } catch (error) {
    console.error("[Chat Controller] Send message error:", error)
    res.status(500).json({
      message: "Failed to send message",
      error: error.message
    })
  }
}

// Mark message as read
export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params
    const currentUserId = req.user.id

    console.log("[Chat Controller] Mark as read - Message:", messageId, "User:", currentUserId)

    // Get message details
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: {
        chatRoomId: true,
        senderId: true,
      },
    })

    if (!message) {
      return res.status(404).json({ message: "Message not found" })
    }

    // Don't create read receipt for own messages
    if (message.senderId === currentUserId) {
      return res.json({ message: "Cannot mark own message as read" })
    }

    // Check if already read
    const existing = await prisma.readReceipt.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId: currentUserId,
        },
      },
    })

    if (existing) {
      return res.json({ message: "Already read" })
    }

    // Create read receipt
    const receipt = await prisma.readReceipt.create({
      data: {
        messageId,
        userId: currentUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    // ✅ Decrement unread count for this user in this room
    const member = await prisma.chatRoomMember.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: message.chatRoomId,
          userId: currentUserId,
        },
      },
    })

    if (member && member.unreadCount > 0) {
      await prisma.chatRoomMember.update({
        where: { id: member.id },
        data: {
          unreadCount: { decrement: 1 },
        },
      })
    }

    // ✅ Emit socket event to room
    const io = req.app.get("io")
    if (io) {
      io.to(`chat-${message.chatRoomId}`).emit("message-read", {
        messageId,
        userId: currentUserId,
        user: receipt.user,
      })
      console.log("[Chat Controller] Emitted message-read event")
    }

    res.json({
      message: "Marked as read",
      receipt,
    })
  } catch (error) {
    console.error("[Chat Controller] Mark as read error:", error)
    res.status(500).json({
      message: "Failed to mark as read",
      error: error.message
    })
  }
}

// ✅ Mark ALL messages in a conversation as read
export const markConversationAsRead = async (req, res) => {
  try {
    const { roomId, conversationId } = req.params
    const chatRoomId = roomId || conversationId
    const currentUserId = req.user.id

    console.log("[Chat Controller] Mark all as read - Room:", chatRoomId, "User:", currentUserId)

    // Get all unread messages in this room
    const unreadMessages = await prisma.chatMessage.findMany({
      where: {
        chatRoomId,
        senderId: { not: currentUserId },
        readReceipts: {
          none: {
            userId: currentUserId,
          },
        },
      },
    })

    // Create read receipts for all unread messages
    await Promise.all(
      unreadMessages.map((message) =>
        prisma.readReceipt.create({
          data: {
            messageId: message.id,
            userId: currentUserId,
          },
        }).catch(() => {
          // Ignore duplicate errors
        })
      )
    )

    // ✅ Reset unread count to 0
    await prisma.chatRoomMember.updateMany({
      where: {
        chatRoomId,
        userId: currentUserId,
      },
      data: {
        unreadCount: 0,
      },
    })

    // ✅ Emit socket event
    const io = req.app.get("io")
    if (io) {
      unreadMessages.forEach((message) => {
        io.to(`chat-${chatRoomId}`).emit("message-read", {
          messageId: message.id,
          userId: currentUserId,
        })
      })
    }

    res.json({
      message: "All messages marked as read",
      count: unreadMessages.length,
    })
  } catch (error) {
    console.error("[Chat Controller] Mark all as read error:", error)
    res.status(500).json({
      message: "Failed to mark all as read",
      error: error.message
    })
  }
}

// Update typing status
export const updateTypingStatus = async (req, res) => {
  try {
    const { roomId } = req.params
    const { isTyping } = req.body
    const currentUserId = req.user.id

    await prisma.chatRoomMember.update({
      where: {
        chatRoomId_userId: {
          chatRoomId: roomId,
          userId: currentUserId,
        },
      },
      data: {
        isTyping,
        lastSeen: new Date(),
      },
    })

    // Emit socket event
    const io = req.app.get("io")
    if (io) {
      io.to(`chat-${roomId}`).emit("typing-status", {
        userId: currentUserId,
        isTyping,
      })
    }

    res.json({ message: "Typing status updated" })
  } catch (error) {
    console.error("[Chat Controller] Update typing status error:", error)
    res.status(500).json({
      message: "Failed to update typing status",
      error: error.message
    })
  }
}

export const uploadChatMedia = async (req, res) => {
  try {
    const { roomId, messageId } = req.params
    const currentUserId = req.user.id

    // Verify user is member of chat room
    const member = await prisma.chatRoomMember.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: roomId,
          userId: currentUserId,
        },
      },
    })

    if (!member) {
      return res.status(403).json({ message: "Not a member of this chat room" })
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file provided" })
    }

    const file = req.file
    const fileType = file.mimetype.split("/")[0].toUpperCase()

    const mediaType =
      {
        image: "IMAGE",
        video: "VIDEO",
        audio: "AUDIO",
      }[fileType.toLowerCase()] || "FILE"

    const media = await prisma.chatMedia.create({
      data: {
        messageId,
        type: mediaType,
        url: `/uploads/chat/${file.filename}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    })

    // Emit socket event
    const io = req.app.get("io")
    if (io) {
      io.to(`chat-${roomId}`).emit("media-uploaded", media)
    }

    res.status(201).json(media)
  } catch (error) {
    console.error("[Chat Controller] Upload media error:", error)
    res.status(500).json({
      message: "Failed to upload media",
      error: error.message
    })
  }
}

export const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params
    const { emoji } = req.body
    const currentUserId = req.user.id

    const reaction = await prisma.messageReaction.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: currentUserId,
        },
      },
      update: {
        emoji,
      },
      create: {
        messageId,
        userId: currentUserId,
        emoji,
      },
    })

    // Get the message to find room ID
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { chatRoomId: true },
    })

    // Emit socket event
    const io = req.app.get("io")
    if (io) {
      io.to(`chat-${message.chatRoomId}`).emit("reaction-added", {
        messageId,
        userId: currentUserId,
        emoji,
      })
    }

    res.status(201).json(reaction)
  } catch (error) {
    console.error("[Chat Controller] Add reaction error:", error)
    res.status(500).json({
      message: "Failed to add reaction",
      error: error.message
    })
  }
}

export const removeReaction = async (req, res) => {
  try {
    const { messageId } = req.params
    const currentUserId = req.user.id

    await prisma.messageReaction.delete({
      where: {
        messageId_userId: {
          messageId,
          userId: currentUserId,
        },
      },
    })

    // Get the message to find room ID
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { chatRoomId: true },
    })

    // Emit socket event
    const io = req.app.get("io")
    if (io) {
      io.to(`chat-${message.chatRoomId}`).emit("reaction-removed", {
        messageId,
        userId: currentUserId,
      })
    }

    res.json({ message: "Reaction removed" })
  } catch (error) {
    console.error("[Chat Controller] Remove reaction error:", error)
    res.status(500).json({
      message: "Failed to remove reaction",
      error: error.message
    })
  }
}

// In your chat.controller.js - UPDATE THIS
export const deleteMessage = async (req, res) => {
  try {
    const { roomId, messageId } = req.params // Get from URL params, not body
    const currentUserId = req.user.id

    // Verify message exists and belongs to current user
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, chatRoomId: true }
    })

    if (!message) {
      return res.status(404).json({ message: "Message not found" })
    }

    if (message.chatRoomId !== roomId) {
      return res.status(400).json({ message: "Message does not belong to this room" })
    }

    if (message.senderId !== currentUserId) {
      return res.status(403).json({ message: "You can only delete your own messages" })
    }

    // Delete all reactions & read receipts first
    await prisma.messageReaction.deleteMany({ where: { messageId } })
    await prisma.readReceipt.deleteMany({ where: { messageId } })

    // Delete media
    await prisma.chatMedia.deleteMany({ where: { messageId } })

    // Now delete the message
    await prisma.chatMessage.delete({ where: { id: messageId } })

    // Notify all users in the room through socket.io
    const io = req.app.get("io")
    if (io) {
      io.to(`chat-${roomId}`).emit("message-deleted", {
        messageId,
        userId: currentUserId,
      })
    }

    res.json({ message: "Message deleted successfully", messageId })

  } catch (error) {
    console.error("[Chat Controller] Delete message error:", error)
    res.status(500).json({
      message: "Failed to delete message",
      error: error.message,
    })
  }
}


export const deleteChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params
    const currentUserId = req.user.id

    console.log("[Chat Controller] Delete chat room:", roomId, "by user:", currentUserId)

    // Verify room exists
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: true,
        messages: {
          include: {
            media: true,
            reactions: true,
            readReceipts: true,
          },
        },
      },
    })

    if (!room) {
      return res.status(404).json({ message: "Chat room not found" })
    }

    // Verify user is a member of this room
    const isMember = room.members.some((m) => m.userId === currentUserId)
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this chat room" })
    }

    // For group chats, check if user is the creator (optional - you can allow any member to delete)
    if (room.isGroup && room.createdById && room.createdById !== currentUserId) {
      return res.status(403).json({
        message: "Only the group creator can delete this chat room"
      })
    }

    // Delete in order (due to foreign key constraints):
    // 1. Reactions
    // 2. Read receipts
    // 3. Media
    // 4. Messages
    // 5. Members
    // 6. Room

    const messageIds = room.messages.map((m) => m.id)

    if (messageIds.length > 0) {
      // Delete all reactions
      await prisma.messageReaction.deleteMany({
        where: { messageId: { in: messageIds } },
      })

      // Delete all read receipts
      await prisma.readReceipt.deleteMany({
        where: { messageId: { in: messageIds } },
      })

      // Delete all media
      await prisma.chatMedia.deleteMany({
        where: { messageId: { in: messageIds } },
      })

      // Delete all messages
      await prisma.chatMessage.deleteMany({
        where: { id: { in: messageIds } },
      })
    }

    // Delete all room members
    await prisma.chatRoomMember.deleteMany({
      where: { chatRoomId: roomId },
    })

    // Finally, delete the room itself
    await prisma.chatRoom.delete({
      where: { id: roomId },
    })

    // Notify all members via socket
    const io = req.app.get("io")
    if (io) {
      room.members.forEach((member) => {
        io.to(`user-${member.userId}`).emit("room-deleted", {
          roomId,
          deletedBy: currentUserId,
        })
      })
    }

    console.log("[Chat Controller] Chat room deleted successfully:", roomId)

    res.json({
      message: "Chat room deleted successfully",
      roomId,
      messagesDeleted: messageIds.length,
    })
  } catch (error) {
    console.error("[Chat Controller] Delete chat room error:", error)
    res.status(500).json({
      message: "Failed to delete chat room",
      error: error.message,
    })
  }
}