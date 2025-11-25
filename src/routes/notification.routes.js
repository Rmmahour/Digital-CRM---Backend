import express from "express"
import { getNotifications, markAsRead, markAllAsRead } from "../controllers/notification.controller.js"
import { authenticate } from "../middleware/auth.middleware.js"

const router = express.Router()

router.use(authenticate)

router.get("/", getNotifications)
router.put("/:id/read", markAsRead)
router.put("/read-all", markAllAsRead)

export default router
