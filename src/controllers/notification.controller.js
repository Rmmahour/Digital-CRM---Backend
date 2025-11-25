import prisma from "../config/prisma.js"

export const getNotifications = async (req, res, next) => {
  try {
    const { isRead } = req.query

    const where = { userId: req.user.id }
    if (isRead !== undefined) where.isRead = isRead === "true"

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    res.json(notifications)
  } catch (error) {
    next(error)
  }
}

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })

    res.json(notification)
  } catch (error) {
    next(error)
  }
}

export const markAllAsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false,
      },
      data: { isRead: true },
    })

    res.json({ message: "All notifications marked as read" })
  } catch (error) {
    next(error)
  }
}
