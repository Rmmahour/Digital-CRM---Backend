import express from "express"
import {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  assignUserToBrand,
  removeUserFromBrand,
} from "../controllers/brand.controller.js"
import { authenticate, authorize } from "../middleware/auth.middleware.js"

const router = express.Router()

router.use(authenticate)

router.get("/", getAllBrands)
router.get("/:id", getBrandById)
router.post("/", authorize("SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"), createBrand)
router.put("/:id", authorize("SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"), updateBrand)
router.delete("/:id", authorize("SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"), deleteBrand)
router.post("/:id/users", authorize("SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"), assignUserToBrand)
router.delete("/:id/users/:userId", authorize("SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"), removeUserFromBrand)

export default router
