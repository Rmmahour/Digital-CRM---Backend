import express from "express"
import { authenticate, authorize } from "../middleware/auth.middleware.js"
import * as recoveryController from "../controllers/recovery.controller.js"

const router = express.Router()

// All routes require Super Admin access
router.use(authenticate, authorize(["SUPER_ADMIN"]))

// Get deleted items
router.get("/users", recoveryController.getDeletedUsers)
router.get("/brands", recoveryController.getDeletedBrands)
router.get("/tasks", recoveryController.getDeletedTasks)

// Recover items
router.put("/users/:id/recover", recoveryController.recoverUser)
router.put("/brands/:id/recover", recoveryController.recoverBrand)
router.put("/tasks/:id/recover", recoveryController.recoverTask)

// Permanently delete items
router.delete("/users/:id", recoveryController.permanentlyDeleteUser)
router.delete("/brands/:id", recoveryController.permanentlyDeleteBrand)
router.delete("/tasks/:id", recoveryController.permanentlyDeleteTask)

export default router
