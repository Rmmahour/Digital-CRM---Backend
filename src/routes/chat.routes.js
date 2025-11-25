import express from "express"
import { authenticate } from "../middleware/auth.middleware.js"
import * as chatController from "../controllers/chat.controller.js"
import multer from "multer"
import path from "path"
import { fileURLToPath } from "url"
import prisma from "../config/prisma.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Configure multer for chat media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads/chat"))
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/webp",
      "image/svg",
      "image/png",
      "image/gif",
      "video/mp4",
      "audio/mpeg",
      "application/pdf",
      "application/msword",
    ]
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Invalid file type"))
    }
  },
})

const router = express.Router()

// In your chat.routes.js - ADD THIS TEMPORARILY
router.get("/debug-users", async (req, res) => {
  const users = await prisma.user.findMany({
    take: 3,
    select: {
      id: true,
      firstName: true,
      lastName: true
    }
  })
  res.json({
    users,
    sampleIdType: typeof users[0]?.id,
    currentUserId: req.user.id,
    currentUserIdType: typeof req.user.id
  })
})


// All routes require authentication
router.use(authenticate)

// Get all chat rooms for current user (for ChatPage)
router.get("/rooms", chatController.getMyChatRooms)

// Get or create one-to-one chat room (for ChatPage socket implementation)
router.post("/rooms", chatController.getOrCreateChatRoom)

// Create group chat (for ChatPage)
router.post("/rooms/group", chatController.createGroupChat)

router.delete("/rooms/:roomId", chatController.deleteChatRoom)

// Get messages for a chat room (for ChatPage)
router.get("/rooms/:roomId/messages", chatController.getChatMessages)

// Send message to a chat room (for ChatPage)
router.post("/rooms/:roomId/messages", chatController.sendMessage)

// delete single message (soft delete)
router.delete("/rooms/:roomId/messages/:messageId", chatController.deleteMessage)

// Mark message as read
router.post("/messages/:messageId/read", chatController.markAsRead)

// Update typing status
router.put("/rooms/:roomId/typing", chatController.updateTypingStatus)

router.post("/rooms/:roomId/messages/:messageId/media", upload.single("file"), chatController.uploadChatMedia)

router.post("/messages/:messageId/reactions", chatController.addReaction)
router.delete("/messages/:messageId/reactions", chatController.removeReaction)

router.get("/conversations", chatController.getMyChatRooms)
router.post("/conversations", chatController.getOrCreateChatRoom)
router.get("/conversations/:conversationId/messages", chatController.getChatMessages)
router.post("/conversations/:conversationId/messages", chatController.sendMessage)
router.put("/conversations/:conversationId/read", async (req, res) => {
  // Mark all messages in conversation as read
  try {
    const { conversationId } = req.params
    const currentUserId = req.user.id

    await prisma.readReceipt.createMany({
      data: (
        await prisma.chatMessage.findMany({
          where: { chatRoomId: conversationId },
          select: { id: true },
        })
      ).map((msg) => ({
        messageId: msg.id,
        userId: currentUserId,
      })),
      skipDuplicates: true,
    })

    res.json({ message: "Conversation marked as read" })
  } catch (error) {
    console.error("[v0] Mark conversation as read error:", error)
    res.status(500).json({ message: "Failed to mark conversation as read" })
  }
})

export default router
