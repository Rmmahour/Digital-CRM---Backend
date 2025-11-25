import express from "express"
import { authenticate, authorize } from "../middleware/auth.middleware.js"
import * as teamController from "../controllers/team.controller.js"

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Get my team (for all users)
router.get("/my-team", teamController.getMyTeam)


// Get all teams (admins only)
router.get("/", authorize(["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]), teamController.getAllTeams)

// Get team by ID
router.get("/:id", teamController.getTeamById)

// Create team (admins only)
router.post("/", authorize(["SUPER_ADMIN", "ADMIN"]), teamController.createTeam)

// Update team (admins only)
router.put("/:id", authorize(["SUPER_ADMIN", "ADMIN"]), teamController.updateTeam)

// Delete team (super admin only)
router.delete("/:id", authorize(["SUPER_ADMIN"]), teamController.deleteTeam)

// Add member to team
router.post("/:id/members", authorize(["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]), teamController.addMember)

// Remove member from team
router.delete(
  "/:id/members/:userId",
  authorize(["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]),
  teamController.removeMember,
)

export default router
