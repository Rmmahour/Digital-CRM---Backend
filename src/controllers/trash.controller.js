import prisma from "../config/prisma.js"

// Get all trashed items
export const getTrashedItems = async (req, res, next) => {
  try {
    const { type } = req.query // 'brand', 'user', 'task', 'all'

    const now = new Date()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    let trashedItems = {}

    if (!type || type === 'all' || type === 'brand') {
      const brands = await prisma.brand.findMany({
        where: {
          deletedAt: {
            not: null,
            gte: fourteenDaysAgo // Only show items deleted within 14 days
          }
        },
        include: {
          deleter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          },
          _count: {
            select: { tasks: true }
          }
        },
        orderBy: { deletedAt: 'desc' }
      })
      trashedItems.brands = brands
    }

    if (!type || type === 'all' || type === 'user') {
      const users = await prisma.user.findMany({
        where: {
          deletedAt: {
            not: null,
            gte: fourteenDaysAgo
          }
        },
        include: {
          deleter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          }
        },
        orderBy: { deletedAt: 'desc' }
      })
      trashedItems.users = users
    }

    if (!type || type === 'all' || type === 'task') {
      const tasks = await prisma.task.findMany({
        where: {
          deletedAt: {
            not: null,
            gte: fourteenDaysAgo
          }
        },
        include: {
          brand: {
            select: { id: true, name: true }
          },
          deleter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          }
        },
        orderBy: { deletedAt: 'desc' }
      })
      trashedItems.tasks = tasks
    }

    res.json(trashedItems)
  } catch (error) {
    next(error)
  }
}

// Restore an item from trash
export const restoreItem = async (req, res, next) => {
  try {
    const { type, id } = req.params // type: 'brand', 'user', 'task'

    let restored

    switch (type) {
      case 'brand':
        restored = await prisma.brand.update({
          where: { id },
          data: {
            deletedAt: null,
            deletedBy: null,
            isActive: true
          }
        })
        break

      case 'user':
        restored = await prisma.user.update({
          where: { id },
          data: {
            deletedAt: null,
            deletedBy: null,
            isActive: true
          }
        })
        break

      case 'task':
        restored = await prisma.task.update({
          where: { id },
          data: {
            deletedAt: null,
            deletedBy: null
          }
        })
        break

      default:
        return res.status(400).json({ message: 'Invalid item type' })
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'RESTORE',
        entity: type.toUpperCase(),
        entityId: id,
        userId: req.user.id,
        metadata: {
          restoredAt: new Date()
        }
      }
    })

    res.json({ message: `${type} restored successfully`, data: restored })
  } catch (error) {
    next(error)
  }
}

// Permanently delete an item (SUPER_ADMIN only)
export const permanentlyDelete = async (req, res, next) => {
  try {
    const { type, id } = req.params

    // Only SUPER_ADMIN can permanently delete
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        message: 'Only Super Admin can permanently delete items' 
      })
    }

    switch (type) {
      case 'brand':
        // This will cascade delete all related tasks, attachments, etc.
        await prisma.brand.delete({
          where: { id }
        })
        break

      case 'user':
        // Re-assign or delete user's tasks first
        await prisma.task.updateMany({
          where: { assignedToId: id },
          data: { assignedToId: null }
        })
        
        await prisma.user.delete({
          where: { id }
        })
        break

      case 'task':
        // Will cascade delete comments, attachments, finalCreatives
        await prisma.task.delete({
          where: { id }
        })
        break

      default:
        return res.status(400).json({ message: 'Invalid item type' })
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'PERMANENT_DELETE',
        entity: type.toUpperCase(),
        entityId: id,
        userId: req.user.id,
        metadata: {
          permanentlyDeletedAt: new Date()
        }
      }
    })

    res.json({ message: `${type} permanently deleted successfully` })
  } catch (error) {
    next(error)
  }
}

// Empty trash (delete all items older than 14 days) - SUPER_ADMIN only
export const emptyTrash = async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        message: 'Only Super Admin can empty trash' 
      })
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

    // Delete brands older than 14 days
    const deletedBrands = await prisma.brand.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: fourteenDaysAgo
        }
      }
    })

    // Delete users older than 14 days
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: fourteenDaysAgo
        }
      }
    })

    // Delete tasks older than 14 days
    const deletedTasks = await prisma.task.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: fourteenDaysAgo
        }
      }
    })

    res.json({
      message: 'Trash emptied successfully',
      deleted: {
        brands: deletedBrands.count,
        users: deletedUsers.count,
        tasks: deletedTasks.count
      }
    })
  } catch (error) {
    next(error)
  }
}