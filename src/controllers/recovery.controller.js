import prisma from "../config/prisma.js"

// Get all deleted users
export const getDeletedUsers = async (req, res) => {
  try {
    const deletedUsers = await prisma.user.findMany({
      where: {
        deletedAt: { not: null },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        deletedAt: true,
        createdAt: true,
      },
      orderBy: { deletedAt: "desc" },
    })

    res.json(deletedUsers)
  } catch (error) {
    console.error("[v0] Get deleted users error:", error)
    res.status(500).json({ message: "Failed to fetch deleted users" })
  }
}

// Get all deleted brands
export const getDeletedBrands = async (req, res) => {
  try {
    const deletedBrands = await prisma.brand.findMany({
      where: {
        deletedAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        description: true,
        deletedAt: true,
        createdAt: true,
      },
      orderBy: { deletedAt: "desc" },
    })

    res.json(deletedBrands)
  } catch (error) {
    console.error("[v0] Get deleted brands error:", error)
    res.status(500).json({ message: "Failed to fetch deleted brands" })
  }
}

// Get all deleted tasks
export const getDeletedTasks = async (req, res) => {
  try {
    const deletedTasks = await prisma.task.findMany({
      where: {
        deletedAt: { not: null },
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { deletedAt: "desc" },
    })

    res.json(deletedTasks)
  } catch (error) {
    console.error("[v0] Get deleted tasks error:", error)
    res.status(500).json({ message: "Failed to fetch deleted tasks" })
  }
}

// Recover user
export const recoverUser = async (req, res) => {
  try {
    const { id } = req.params

    const user = await prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "RECOVER",
        entity: "User",
        entityId: id,
        userId: req.user.id,
        metadata: {
          recoveredUser: `${user.firstName} ${user.lastName}`,
        },
      },
    })

    res.json({ message: "User recovered successfully", user })
  } catch (error) {
    console.error("[v0] Recover user error:", error)
    res.status(500).json({ message: "Failed to recover user" })
  }
}

// Recover brand
export const recoverBrand = async (req, res) => {
  try {
    const { id } = req.params

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "RECOVER",
        entity: "Brand",
        entityId: id,
        userId: req.user.id,
        metadata: {
          recoveredBrand: brand.name,
        },
      },
    })

    res.json({ message: "Brand recovered successfully", brand })
  } catch (error) {
    console.error("[v0] Recover brand error:", error)
    res.status(500).json({ message: "Failed to recover brand" })
  }
}

// Recover task
export const recoverTask = async (req, res) => {
  try {
    const { id } = req.params

    const task = await prisma.task.update({
      where: { id },
      data: {
        deletedAt: null,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "RECOVER",
        entity: "Task",
        entityId: id,
        userId: req.user.id,
        metadata: {
          recoveredTask: task.title,
        },
      },
    })

    res.json({ message: "Task recovered successfully", task })
  } catch (error) {
    console.error("[v0] Recover task error:", error)
    res.status(500).json({ message: "Failed to recover task" })
  }
}

// Permanently delete user
export const permanentlyDeleteUser = async (req, res) => {
  try {
    const { id } = req.params

    await prisma.user.delete({
      where: { id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "PERMANENT_DELETE",
        entity: "User",
        entityId: id,
        userId: req.user.id,
        metadata: {},
      },
    })

    res.json({ message: "User permanently deleted" })
  } catch (error) {
    console.error("[v0] Permanently delete user error:", error)
    res.status(500).json({ message: "Failed to permanently delete user" })
  }
}

// Permanently delete brand
export const permanentlyDeleteBrand = async (req, res) => {
  try {
    const { id } = req.params

    await prisma.brand.delete({
      where: { id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "PERMANENT_DELETE",
        entity: "Brand",
        entityId: id,
        userId: req.user.id,
        metadata: {},
      },
    })

    res.json({ message: "Brand permanently deleted" })
  } catch (error) {
    console.error("[v0] Permanently delete brand error:", error)
    res.status(500).json({ message: "Failed to permanently delete brand" })
  }
}

// Permanently delete task
export const permanentlyDeleteTask = async (req, res) => {
  try {
    const { id } = req.params

    await prisma.task.delete({
      where: { id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "PERMANENT_DELETE",
        entity: "Task",
        entityId: id,
        userId: req.user.id,
        metadata: {},
      },
    })

    res.json({ message: "Task permanently deleted" })
  } catch (error) {
    console.error("[v0] Permanently delete task error:", error)
    res.status(500).json({ message: "Failed to permanently delete task" })
  }
}
