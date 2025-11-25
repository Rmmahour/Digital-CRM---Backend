import prisma from "../config/prisma.js"

export const getAllActivityLogs = async (req, res, next) => {
  try {
    const { entity, userId, limit = 100 } = req.query

    const where = {}
    if (entity) where.entity = entity
    if (userId) where.userId = userId

    const logs = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Number.parseInt(limit),
    })

    res.json(logs)
  } catch (error) {
    next(error)
  }
}

export const getActivityLogById = async (req, res, next) => {
  try {
    const { id } = req.params

    const log = await prisma.activityLog.findUnique({
      where: { id },
      include: {
        user: {
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

    if (!log) {
      return res.status(404).json({ message: "Activity log not found" })
    }

    res.json(log)
  } catch (error) {
    next(error)
  }
}


export const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.id
    const userRole = req.user.role

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Build where clause based on role
    let taskWhere = { deletedAt: null }
    
    if (!["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
      if (userRole === "ACCOUNT_MANAGER") {
        const userTeam = await prisma.user.findUnique({
          where: { id: userId },
          select: { teamId: true },
        })

        if (userTeam.teamId) {
          taskWhere.OR = [
            { createdById: userId },
            { assignedToId: userId },
            {
              assignedTo: {
                teamId: userTeam.teamId,
              },
            },
          ]
        } else {
          taskWhere.OR = [{ createdById: userId }, { assignedToId: userId }]
        }
      } else {
        taskWhere.OR = [
          { assignedToId: userId },
          { createdById: userId },
        ]
      }
    }

    // Get all counts in parallel
    const [
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      totalBrands,
      activeBrands,
      totalUsers,
      activeUsers,
      recentTasks,
      tasksCompletedToday,
      tasksInReview,
      myTasks,
    ] = await Promise.all([
      prisma.task.count({ where: taskWhere }),
      prisma.task.count({ where: { ...taskWhere, status: "COMPLETED" } }),
      prisma.task.count({ 
        where: { 
          ...taskWhere, 
          status: { in: ["TODO", "IN_PROGRESS"] } 
        } 
      }),
      prisma.task.count({
        where: {
          ...taskWhere,
          dueDate: { lt: new Date() },
          status: { notIn: ["COMPLETED", "APPROVED"] },
        },
      }),
      prisma.brand.count({ where: { deletedAt: null } }),
      prisma.brand.count({ where: { isActive: true, deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { isActive: true, deletedAt: null } }),
      prisma.task.findMany({
        where: taskWhere,
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          brand: { select: { name: true } },
          assignedTo: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      // Tasks completed today
      prisma.task.count({
        where: {
          ...taskWhere,
          status: "COMPLETED",
          updatedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      // Tasks in review
      prisma.task.count({
        where: {
          ...taskWhere,
          status: "IN_REVIEW",
        },
      }),
      // My tasks (for current user)
      prisma.task.count({
        where: {
          assignedToId: userId,
          deletedAt: null,
          status: { notIn: ["COMPLETED"] },
        },
      }),
    ])

    res.json({
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        pending: pendingTasks,
        overdue: overdueTasks,
        myTasks,
      },
      brands: {
        total: totalBrands,
        active: activeBrands,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      teamActivity: {
        completedToday: tasksCompletedToday,
        inReview: tasksInReview,
        activeMembers: activeUsers,
      },
      recentTasks,
    })
  } catch (error) {
    console.error("[v0] Dashboard stats error:", error)
    next(error)
  }
}