import express from "express"
import {
  login,
  register,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword,
} from "../controllers/auth.controller.js"
import { authenticate } from "../middleware/auth.middleware.js"

const router = express.Router()

router.post("/login", login)
router.post("/register", register)
router.post("/forgot-password", forgotPassword)
router.post("/reset-password", resetPassword)
router.get("/me", authenticate, getMe)

router.put("/profile", authenticate, updateProfile)
router.put("/change-password", authenticate, changePassword)

export default router
