import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { createServer } from "http"
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url"
import authRoutes from "./routes/auth.routes.js"
import userRoutes from "./routes/user.routes.js"
import brandRoutes from "./routes/brand.routes.js"
import taskRoutes from "./routes/task.routes.js"
import notificationRoutes from "./routes/notification.routes.js"
import activityRoutes from "./routes/activity.routes.js"
import calendarRoutes from "./routes/calendar.routes.js"
import teamRoutes from "./routes/team.routes.js"
import chatRoutes from "./routes/chat.routes.js"
import recoveryRoutes from "./routes/recovery.routes.js"
import trashRoutes from "./routes/trash.routes.js"
import { startTrashCleanupSchedule } from "./jobs/cleanupTrash.js"
import { errorHandler } from "./middleware/error.middleware.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
})

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use("/uploads", express.static(path.join(__dirname, "../uploads")))

// Make io accessible to routes
app.set("io", io)


startTrashCleanupSchedule()


// Routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/brands", brandRoutes)
app.use("/api/tasks", taskRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/activity", activityRoutes)
app.use("/api/calendars", calendarRoutes)
app.use("/api/teams", teamRoutes)
app.use("/api/chat", chatRoutes)
app.use("/api/recovery", recoveryRoutes)
app.use("/api/trash", trashRoutes)
// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" })
})

// Error handling
app.use(errorHandler)

io.on("connection", (socket) => {
  console.log("[v0] User connected:", socket.id)

  socket.on("join-room", (userId) => {
    socket.join(`user-${userId}`)
    console.log("[v0] User joined room:", userId)
  })

  socket.on("join-chat", (roomId, userId) => {
    socket.join(`chat-${roomId}`)
    console.log("[v0] User joined chat room:", roomId)

    // Broadcast user online status
    socket.broadcast.to(`chat-${roomId}`).emit("user-online", {
      userId,
      status: "online",
      timestamp: new Date(),
    })
  })

  socket.on("typing", (roomId, userId) => {
    socket.broadcast.to(`chat-${roomId}`).emit("user-typing", {
      userId,
      isTyping: true,
    })
  })

  socket.on("stop-typing", (roomId, userId) => {
    socket.broadcast.to(`chat-${roomId}`).emit("user-typing", {
      userId,
      isTyping: false,
    })
  })

  socket.on("message-sent", (roomId, messageId) => {
    socket.broadcast.to(`chat-${roomId}`).emit("message-delivered", {
      messageId,
      deliveredAt: new Date(),
    })
  })

  socket.on("emoji-reaction", (roomId, messageId, userId, emoji) => {
    socket.broadcast.to(`chat-${roomId}`).emit("reaction-added", {
      messageId,
      userId,
      emoji,
    })
  })

  socket.on("remove-emoji-reaction", (roomId, messageId, userId) => {
    socket.broadcast.to(`chat-${roomId}`).emit("reaction-removed", {
      messageId,
      userId,
    })
  })

  socket.on("leave-chat", (roomId, userId) => {
    socket.leave(`chat-${roomId}`)
    console.log("[v0] User left chat room:", roomId)

    // Broadcast user offline status
    socket.broadcast.to(`chat-${roomId}`).emit("user-offline", {
      userId,
      status: "offline",
      timestamp: new Date(),
    })
  })

  socket.on("error", (error) => {
    console.error("[v0] Socket error:", error)
  })

  socket.on("disconnect", () => {
    console.log("[v0] User disconnected:", socket.id)
  })
})

const PORT = process.env.PORT || 5000

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
})
