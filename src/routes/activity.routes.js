import express from "express"
import { getAllActivityLogs, getActivityLogById, getDashboardStats } from "../controllers/activity.controller.js"
import { authenticate } from "../middleware/auth.middleware.js"

const router = express.Router()

router.use(authenticate)

// Only Super Admin and Admin can view activity logs
router.use((req, res, next) => {
  if (!["SUPER_ADMIN", "ADMIN","ACCOUNT_MANAGER"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" })
  }
  next()
})

router.get("/", getAllActivityLogs)
router.get("/stats", getDashboardStats)
router.get("/:id", getActivityLogById)

export default router
