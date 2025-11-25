import prisma from "../config/prisma.js"

export const cleanupOldTrash = async () => {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

    console.log('[v0] Starting automatic trash cleanup...')

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

    console.log('[v0] Trash cleanup complete:', {
      brands: deletedBrands.count,
      users: deletedUsers.count,
      tasks: deletedTasks.count
    })

    return {
      brands: deletedBrands.count,
      users: deletedUsers.count,
      tasks: deletedTasks.count
    }
  } catch (error) {
    console.error('[v0] Trash cleanup error:', error)
    throw error
  }
}

// Run cleanup daily at midnight
export const startTrashCleanupSchedule = () => {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
  
  // Run immediately on startup (optional)
  // cleanupOldTrash()
  
  // Then run every 24 hours
  setInterval(cleanupOldTrash, TWENTY_FOUR_HOURS)
  
  console.log('[v0] Trash cleanup schedule started')
}