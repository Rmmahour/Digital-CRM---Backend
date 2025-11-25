import express from "express"
import { authenticate, authorize } from "../middleware/auth.middleware.js"
import {
  getTrashedItems,
  restoreItem,
  permanentlyDelete,
  emptyTrash
} from "../controllers/trash.controller.js"

const router = express.Router()

router.use(authenticate)

// Get all trashed items
router.get("/", authorize("SUPER_ADMIN"), getTrashedItems)

// Restore item from trash
router.post("/restore/:type/:id", authorize("SUPER_ADMIN"), restoreItem)

// Permanently delete (SUPER_ADMIN only)
router.delete("/:type/:id", authorize("SUPER_ADMIN"), permanentlyDelete)

// Empty trash (SUPER_ADMIN only)
router.post("/empty", authorize("SUPER_ADMIN"), emptyTrash)

export default router