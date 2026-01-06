import express from "express"
import { authenticate, authorize } from "../middleware/auth.middleware.js"
import {
  getAllCalendars,
  getCalendarById,
  getCalendarsByBrand,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  addScope,
  updateScope,
  deleteScope,
  generateTasks,
  updateTaskDate,
} from "../controllers/calendar.controller.js"

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Calendar routes
router.get("/", getAllCalendars)
router.get("/brand/:brandId", (req, res, next) => {
  console.log("✅ /brand/:brandId route hit! brandId:", req.params.brandId)
  next()
}, getCalendarsByBrand)
router.get("/:id", getCalendarById)

router.post("/", authorize(["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]), createCalendar)
router.put("/:id", authorize(["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]), updateCalendar)
router.delete("/:id", authorize(["SUPER_ADMIN", "ADMIN"]), deleteCalendar)

// Scope routes
router.post("/:calendarId/scopes", authorize(["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]), addScope)
router.put("/scopes/:scopeId", authorize(["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]), updateScope)
router.delete("/scopes/:scopeId", authorize(["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]), deleteScope)

// Task generation
router.post("/:calendarId/generate-tasks", authorize(["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]), generateTasks)

router.put("/tasks/:taskId/date", authorize(["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]), updateTaskDate)

export default router
