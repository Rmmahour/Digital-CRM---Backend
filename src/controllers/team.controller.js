import prisma from "../config/prisma.js"

// Get all teams
export const getAllTeams = async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      where: { isActive: true },
      include: {
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    res.json(teams)
  } catch (error) {
    console.error("[v0] Get teams error:", error)
    res.status(500).json({ message: "Failed to fetch teams" })
  }
}

// Get team by ID
export const getTeamById = async (req, res) => {
  try {
    const { id } = req.params

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            joinDate: true,
          },
        },
      },
    })

    if (!team) {
      return res.status(404).json({ message: "Team not found" })
    }

    res.json(team)
  } catch (error) {
    console.error("[v0] Get team error:", error)
    res.status(500).json({ message: "Failed to fetch team" })
  }
}

// Create team
export const createTeam = async (req, res) => {
  try {
    const { name, description, leaderId } = req.body

    // Validate leader if provided
    if (leaderId) {
      const leader = await prisma.user.findUnique({
        where: { id: leaderId },
      })

      if (!leader) {
        return res.status(404).json({ message: "Leader not found" })
      }

      // Only ADMIN or ACCOUNT_MANAGER can be team leaders
      if (!["ADMIN", "ACCOUNT_MANAGER"].includes(leader.role)) {
        return res.status(400).json({ message: "Only Admins or Account Managers can be team leaders" })
      }
    }

    const team = await prisma.team.create({
      data: {
        name,
        description,
        leaderId,
      },
      include: {
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "CREATE",
        entity: "Team",
        entityId: team.id,
        userId: req.user.id,
        metadata: { teamName: name },
      },
    })

    res.status(201).json(team)
  } catch (error) {
    console.error("[v0] Create team error:", error)
    res.status(500).json({ message: "Failed to create team" })
  }
}

// Update team
export const updateTeam = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, leaderId, isActive } = req.body

    // Validate leader if provided
    if (leaderId) {
      const leader = await prisma.user.findUnique({
        where: { id: leaderId },
      })

      if (!leader) {
        return res.status(404).json({ message: "Leader not found" })
      }

      if (!["ADMIN", "ACCOUNT_MANAGER"].includes(leader.role)) {
        return res.status(400).json({ message: "Only Admins or Account Managers can be team leaders" })
      }
    }

    const team = await prisma.team.update({
      where: { id },
      data: {
        name,
        description,
        leaderId,
        isActive,
      },
      include: {
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "UPDATE",
        entity: "Team",
        entityId: team.id,
        userId: req.user.id,
        metadata: { teamName: name },
      },
    })

    res.json(team)
  } catch (error) {
    console.error("[v0] Update team error:", error)
    res.status(500).json({ message: "Failed to update team" })
  }
}

// Delete team
export const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params

    // Remove team reference from all members
    await prisma.user.updateMany({
      where: { teamId: id },
      data: { teamId: null },
    })

    await prisma.team.delete({
      where: { id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "DELETE",
        entity: "Team",
        entityId: id,
        userId: req.user.id,
        metadata: {},
      },
    })

    res.json({ message: "Team deleted successfully" })
  } catch (error) {
    console.error("[v0] Delete team error:", error)
    res.status(500).json({ message: "Failed to delete team" })
  }
}

// Add member to team
export const addMember = async (req, res) => {
  try {
    const { id } = req.params
    const { userId } = req.body

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id },
    })

    if (!team) {
      return res.status(404).json({ message: "Team not found" })
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Add user to team
    await prisma.user.update({
      where: { id: userId },
      data: { teamId: id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "ADD_MEMBER",
        entity: "Team",
        entityId: id,
        userId: req.user.id,
        metadata: { addedUserId: userId, userName: `${user.firstName} ${user.lastName}` },
      },
    })

    res.json({ message: "Member added successfully" })
  } catch (error) {
    console.error("[v0] Add member error:", error)
    res.status(500).json({ message: "Failed to add member" })
  }
}

// Remove member from team
export const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params

    await prisma.user.update({
      where: { id: userId },
      data: { teamId: null },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "REMOVE_MEMBER",
        entity: "Team",
        entityId: id,
        userId: req.user.id,
        metadata: { removedUserId: userId },
      },
    })

    res.json({ message: "Member removed successfully" })
  } catch (error) {
    console.error("[v0] Remove member error:", error)
    res.status(500).json({ message: "Failed to remove member" })
  }
}

// Get my team (for regular users)
export const getMyTeam = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { teamId: true },
    })

    if (!user.teamId) {
      return res.json(null)
    }

    const team = await prisma.team.findUnique({
      where: { id: user.teamId },
      include: {
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        members: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    })

    res.json(team)
  } catch (error) {
    console.error("[v0] Get my team error:", error)
    res.status(500).json({ message: "Failed to fetch team" })
  }
}
