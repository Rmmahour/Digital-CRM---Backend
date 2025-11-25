import prisma from "../config/prisma.js"
import { uploadToCloudinary } from "../config/upload.js"
import { notifyTaskAssigned, notifyTaskCompleted } from "../services/notificationService.js"
import { getDefaultTimeEstimate } from "../utils/timeEstimates.js"

export const getAllTasks = async (req, res, next) => {
  try {
    const { status, priority, brandId, assignedToId, page = 1, limit = 10 } = req.query

    const where = { deletedAt: null }
    if (status) where.status = status
    if (priority) where.priority = priority
    if (brandId) where.brandId = brandId
    if (assignedToId) where.assignedToId = assignedToId

    if (req.user.role === "ACCOUNT_MANAGER") {
      const userTeam = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { teamId: true },
      })

      if (userTeam.teamId) {
        where.OR = [
          { createdById: req.user.id },
          { assignedToId: req.user.id },
          {
            assignedTo: {
              teamId: userTeam.teamId,
            },
          },
        ]
      } else {
        where.OR = [{ createdById: req.user.id }, { assignedToId: req.user.id }]
      }
    } else if (!["SUPER_ADMIN", "ADMIN"].includes(req.user.role)) {
      where.OR = [
        { assignedToId: req.user.id },
        { createdById: req.user.id },
        {
          brand: {
            users: {
              some: {
                userId: req.user.id,
              },
            },
          },
        },
      ]
    }

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: Number.parseInt(limit),
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              role: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              role: true,
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.count({ where }),
    ])

    res.json({
      tasks,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total,
        pages: Math.ceil(total / Number.parseInt(limit)),
      },
    })
  } catch (error) {
    next(error)
  }
}

// export const getTaskById = async (req, res, next) => {
//   try {
//     const { id } = req.params

//     const task = await prisma.task.findUnique({
//       where: { id },
//       include: {
//         brand: true,
//         assignedTo: {
//           select: {
//             id: true,
//             firstName: true,
//             lastName: true,
//             email: true,
//             role: true,
//             avatar: true,
//           },
//         },
//         createdBy: {
//           select: {
//             id: true,
//             firstName: true,
//             lastName: true,
//             role: true,
//             avatar: true,
//           },
//         },
//         comments: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 firstName: true,
//                 lastName: true,
//                 role: true,
//                 avatar: true,
//               },
//             },
//           },
//           orderBy: { createdAt: "asc" },
//         },
//         attachments: true,
//       },
//     })

//     if (!task) {
//       return res.status(404).json({ message: "Task not found" })
//     }

//     res.json(task)
//   } catch (error) {
//     next(error)
//   }
// }

export const createTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      brandId,
      assignedToId,
      contentType,
      publishDate,
      // referenceUpload,
      notes,
      references,
      estimatedTime,
    } = req.body

    if (!title || !brandId) {
      return res.status(400).json({ message: "Title and brand are required" })
    }

    let finalEstimatedTime = estimatedTime
    if (!finalEstimatedTime && contentType) {
      finalEstimatedTime = getDefaultTimeEstimate(contentType)
    }

    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
      })

      if (!assignedUser) {
        return res.status(400).json({ message: "Assigned user does not exist" })
      }
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand) {
      return res.status(400).json({ message: "Brand does not exist" })
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || "TODO",
        priority: priority || "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
        brandId,
        assignedToId: assignedToId || null,
        createdById: req.user.id,
        contentType: contentType || null,
        publishDate: publishDate ? new Date(publishDate) : null,
        // referenceUpload: referenceUpload || null,
        notes: notes || null,
        references: references || null,
        estimatedTime: finalEstimatedTime,
      },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (assignedToId) {
      await notifyTaskAssigned(task, task.assignedTo)

      const io = req.app.get("io")
      io.to(`user-${assignedToId}`).emit("notification", {
        title: "New Task Assigned",
        message: `You have been assigned to task: ${title}`,
      })
    }

    await prisma.activityLog.create({
      data: {
        action: "CREATE",
        entity: "Task",
        entityId: task.id,
        userId: req.user.id,
        metadata: {
          taskTitle: title,
          brandId,
          assignedToId,
        },
      },
    })

    res.status(201).json(task)
  } catch (error) {
    next(error)
  }
}

export const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assignedToId,
      contentType,
      publishDate,
      // referenceUpload,
      finalUpload,
      notes,
      textContent,
      references,
    } = req.body

    if (status === "COMPLETED") {
      if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"].includes(req.user.role)) {
        return res.status(403).json({ message: "Only Super Admin, Admin, and Manager can mark tasks as completed" })
      }
    }

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: true,
        createdBy: true,
      },
    })

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" })
    }

    if (assignedToId !== undefined && assignedToId !== null) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
      })

      if (!assignedUser) {
        return res.status(400).json({ message: "Assigned user does not exist" })
      }
    }

    const updateData = {}
    if (title) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (status) updateData.status = status
    if (priority) updateData.priority = priority
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId
    if (contentType !== undefined) updateData.contentType = contentType
    if (publishDate !== undefined) updateData.publishDate = publishDate ? new Date(publishDate) : null
    // if (referenceUpload !== undefined) updateData.referenceUpload = referenceUpload
    if (finalUpload !== undefined) updateData.finalUpload = finalUpload
    if (notes !== undefined) updateData.notes = notes
    if (textContent !== undefined) updateData.textContent = textContent
    if (references !== undefined) updateData.references = references

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        createdBy: {  
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    if (status === "COMPLETED" && existingTask.status !== "COMPLETED") {
      await notifyTaskCompleted(task, existingTask.createdBy)
    }

    await prisma.activityLog.create({
      data: {
        action: "UPDATE",
        entity: "Task",
        entityId: task.id,
        userId: req.user.id,
        metadata: {
          changes: updateData,
        },
      },
    })

    const io = req.app.get("io")
    io.emit("task:update", task)

    res.json(task)
  } catch (error) {
    next(error)
  }
}

export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params
    const { permanent } = req.query

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,        // ✅ Make sure this is here
        title: true,
        assignedToId: true,
        createdById: true,
      },
    })

    if (!task) {
      return res.status(404).json({ message: "Task not found" })
    }


    if (permanent === 'true') {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ 
          message: 'Only Super Admin can permanently delete tasks' 
        })
      }

      await prisma.task.delete({
        where: { id }
      })

      await prisma.activityLog.create({
        data: {
          action: 'PERMANENT_DELETE',
          entity: 'Task',
          entityId: id,
          userId: req.user.id,
        },
      })

      return res.json({ message: "Task permanently deleted" })
    }

    await prisma.task.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: req.user.id,
      },
    })

    await prisma.activityLog.create({
      data: {
        action: "DELETE",
        entity: "Task",
        entityId: id,
        userId: req.user.id,
        metadata: {
          taskTitle: task?.title,
          deletedBy: `${req.user.firstName} ${req.user.lastName}`,
          willBeDeletedOn: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        },
      },
    })

    res.json({ message: "Task moved to trash. Will be permanently deleted in 14 days." })
  } catch (error) {
    next(error)
  }
}

export const addComment = async (req, res, next) => {
  try {
    const { taskId } = req.params
    const { content } = req.body

    if (!content) {
      return res.status(400).json({ message: "Comment content is required" })
    }

    const mentionRegex = /@([A-Za-z\s]+)\s+\[([^\]]+)\]$$([^)]+)$$/g
    const mentions = []
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      const userId = match[3].trim()
      if (userId && !mentions.includes(userId)) {
        mentions.push(userId)
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId,
        userId: req.user.id,  // ✅ FIXED
        mentions,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,      // ✅ ADD THIS
        title: true,
        assignedToId: true,
        createdById: true,
      },
    })

    // Notify mentioned users
    for (const userId of mentions) {
      if (userId !== req.user.id) {
        const mentionedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, whatsAppNumber: true, email: true },
        })

        if (mentionedUser) {
          await prisma.notification.create({
            data: {
              userId: userId,
              type: "MENTION",
              title: "You were mentioned",
              message: `${req.user.firstName} ${req.user.lastName} mentioned you in task: ${task.title}`,  // ✅ FIXED
              sentVia: ["IN_APP"],
              metadata: {
                taskId: task.id
              },
              link: `/dashboard/tasks/${task.id}`
            }
          })

          const io = req.app.get("io")
          io.to(`user-${userId}`).emit("notification", {
            type: "MENTION",
            title: "You were mentioned",
            message: `${req.user.firstName} ${req.user.lastName} mentioned you in task: ${task.title}`,
            taskId,
            commentId: comment.id,
          })
        }
      }
    }

    // Notify task assignee and creator
    const notifyUsers = [task.assignedToId, task.createdById].filter(
      (userId) => userId && userId !== req.user.id && !mentions.includes(userId),
    )

    const io = req.app.get("io")
    for (const userId of notifyUsers) {
      await prisma.notification.create({
        data: {
          userId: userId,
          type: "COMMENT",
          title: "New Comment",
          message: `${req.user.firstName} ${req.user.lastName} commented on: ${task.title}`,  // ✅ FIXED
          sentVia: ["IN_APP"],
          metadata: {
            taskId: task.id
          },
          link: `/dashboard/tasks/${task.id}`
        }
      })

      io.to(`user-${userId}`).emit("new-comment", {
        taskId,
        comment,
      })
    }

    res.status(201).json(comment)
  } catch (error) {
    next(error)
  }
}

export const getTaskComments = async (req, res, next) => {
  try {
    const { taskId } = req.params

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    res.json(comments)
  } catch (error) {
    next(error)
  }
}

export const uploadAttachment = async (req, res, next) => {
  try {
    const { taskId } = req.params
    const { description } = req.body

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" })
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    })

    if (!task) {
      return res.status(404).json({ message: "Task not found" })
    }

    let fileUrl = ""
    const fileName = req.file.originalname

    if (process.env.UPLOAD_STORAGE === "cloud" && process.env.CLOUDINARY_CLOUD_NAME) {
      const result = await uploadToCloudinary(req.file)
      fileUrl = result.secure_url
    } else {
      fileUrl = `/uploads/${req.file.filename}`
    }

    const attachment = await prisma.attachment.create({
      data: {
        fileName,
        fileUrl,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        taskId,
        description: description || null,
      },
    })

    await prisma.activityLog.create({
      data: {
        action: "UPLOAD",
        entity: "Attachment",
        entityId: attachment.id,
        userId: req.user.id,
        metadata: {
          taskId,
          fileName,
          fileType: req.file.mimetype,
        },
      },
    })

    const notifyUsers = [task.assignedToId, task.createdById].filter((userId) => userId && userId !== req.user.id)

    const io = req.app.get("io")
    for (const userId of notifyUsers) {
      await prisma.notification.create({
  data: {
    title: "New Attachment",
    message: `${req.user.firstName} uploaded a file to: ${task.title}`,
    userId,
    type: "TASK_UPDATED",  // ✅ ADD THIS
    sentVia: ["IN_APP"],   // ✅ ADD THIS
    metadata: {            // ✅ ADD THIS
      taskId: task.id
    },
    link: `/dashboard/tasks/${task.id}`  // ✅ ADD THIS
  },
})

      io.to(`user-${userId}`).emit("new-attachment", {
        taskId,
        attachment,
      })
    }

    res.status(201).json(attachment)
  } catch (error) {
    next(error)
  }
}

export const getTaskAttachments = async (req, res, next) => {
  try {
    const { taskId } = req.params

    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    })

    res.json(attachments)
  } catch (error) {
    next(error)
  }
}

export const deleteAttachment = async (req, res, next) => {
  try {
    const { attachmentId } = req.params

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" })
    }

    await prisma.attachment.delete({
      where: { id: attachmentId },
    })

    await prisma.activityLog.create({
      data: {
        action: "DELETE",
        entity: "Attachment",
        entityId: attachmentId,
        userId: req.user.id,
        metadata: {
          fileName: attachment.fileName,
          taskId: attachment.taskId,
        },
      },
    })

    res.json({ message: "Attachment deleted successfully" })
  } catch (error) {
    next(error)
  }
}

export const getMyTasks = async (req, res, next) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: req.user.id,
        deletedAt: null,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    res.json(Array.isArray(tasks) ? tasks : [])
  } catch (error) {
    next(error)
  }
}

export const updateTaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (status === "COMPLETED" && !["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only Super Admin, Admin, and Manager can mark tasks as completed" })
    }

    const task = await prisma.task.update({
      where: { id },
      data: { status },
      include: {
        brand: true,
        assignedTo: true,
      createdBy: {  // ✅ ADD THIS
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    const io = req.app.get("io")
    io.emit("task:update", task)

    res.json(task)
  } catch (error) {
    next(error)
  }
}

export const updateTaskPriority = async (req, res, next) => {
  try {
    const { id } = req.params
    const { priority } = req.body

    const task = await prisma.task.update({
      where: { id },
      data: { priority },
      include: {
        brand: true,
        assignedTo: true,
      createdBy: {  // ✅ ADD THIS
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    const io = req.app.get("io")
    io.emit("task:update", task)

    res.json(task)
  } catch (error) {
    next(error)
  }
}

export const updateTaskDueDate = async (req, res, next) => {
  try {
    const { id } = req.params
    const { dueDate } = req.body

    // Get the existing task to check createdAt and publishDate
    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: { createdAt: true, publishDate: true }
    })

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" })
    }

    // Validate dueDate
    if (dueDate) {
      const newDueDate = new Date(dueDate)
      const createdAt = new Date(existingTask.createdAt)
      
      // Reset time to start of day for comparison
      newDueDate.setHours(0, 0, 0, 0)
      createdAt.setHours(0, 0, 0, 0)
      
      // Check if dueDate is in the past
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (newDueDate < today) {
        return res.status(400).json({ 
          message: "Due date cannot be in the past" 
        })
      }

      // Check if dueDate is greater than createdAt
      if (newDueDate <= createdAt) {
        return res.status(400).json({ 
          message: "Due date must be greater than the task creation date" 
        })
      }

      // Check if publishDate exists and is greater than the new dueDate
      if (existingTask.publishDate) {
        const publishDate = new Date(existingTask.publishDate)
        publishDate.setHours(0, 0, 0, 0)
        
        if (publishDate <= newDueDate) {
          return res.status(400).json({ 
            message: "Due date must be less than the publish date" 
          })
        }
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: { dueDate: dueDate ? new Date(dueDate) : null },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        createdBy: {  // ✅ ADD THIS
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    const io = req.app.get("io")
    io.emit("task:update", task)

    res.json(task)
  } catch (error) {
    next(error)
  }
}

export const updateTaskAssignee = async (req, res, next) => {
  try {
    const { id } = req.params
    const { assignedToId } = req.body

    const task = await prisma.task.update({
      where: { id },
      data: { assignedToId },
      include: {
        brand: true,
        assignedTo: true,
      
      createdBy: {  // ✅ ADD THIS
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    if (assignedToId) {
      await notifyTaskAssigned(task, task.assignedTo)

      const io = req.app.get("io")
      io.to(`user-${assignedToId}`).emit("notification", {
        title: "Task Assigned",
        message: `You have been assigned to: ${task.title}`,
      })
    }

    const io = req.app.get("io")
    io.emit("task:update", task)

    res.json(task)
  } catch (error) {
    next(error)
  }
}


// Update Copy Idea
export const updateCopyIdea = async (req, res, next) => {
  try {
    const { id } = req.params
    const { copyIdea } = req.body

    // Only writers, managers, and admins can edit
    if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER", "WRITER"].includes(req.user.role)) {
      return res.status(403).json({ message: "You don't have permission to edit copy" })
    }

    const task = await prisma.task.update({
      where: { id },
      data: { copyIdea },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    res.json(task)
  } catch (error) {
    next(error)
  }
}

// Update Caption
export const updateCaption = async (req, res, next) => {
  try {
    const { id } = req.params
    const { caption } = req.body

    // Only writers, managers, and admins can edit
    if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER", "WRITER"].includes(req.user.role)) {
      return res.status(403).json({ message: "You don't have permission to edit caption" })
    }

    const task = await prisma.task.update({
      where: { id },
      data: { caption },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    res.json(task)
  } catch (error) {
    next(error)
  }
}

// Update Creative Reference
export const updateCreativeRef = async (req, res, next) => {
  try {
    const { id } = req.params
    const { creativeRef } = req.body

    // Writers, managers, and admins can edit
    if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER", "WRITER"].includes(req.user.role)) {
      return res.status(403).json({ message: "You don't have permission to edit creative reference" })
    }

    const task = await prisma.task.update({
      where: { id },
      data: { creativeRef },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    res.json(task)
  } catch (error) {
    next(error)
  }
}

// Update Publish Date
export const updatePublishDate = async (req, res, next) => {
  try {
    const { id } = req.params
    const { publishDate } = req.body

    // Only admins and managers can change publish date
    if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admins and managers can change publish date" })
    }

    // Get the existing task to check dueDate
    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: { dueDate: true, createdAt: true }
    })

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" })
    }

    // Validate publishDate
    if (publishDate) {
      const newPublishDate = new Date(publishDate)
      
      // Reset time to start of day for comparison
      newPublishDate.setHours(0, 0, 0, 0)
      
      // Check if publishDate is in the past
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (newPublishDate < today) {
        return res.status(400).json({ 
          message: "Publish date cannot be in the past" 
        })
      }

      // Check if dueDate exists
      if (!existingTask.dueDate) {
        return res.status(400).json({ 
          message: "Cannot set publish date without a due date. Please set due date first." 
        })
      }

      // Check if publishDate is greater than dueDate
      const dueDate = new Date(existingTask.dueDate)
      dueDate.setHours(0, 0, 0, 0)
      
      if (newPublishDate <= dueDate) {
        return res.status(400).json({ 
          message: "Publish date must be greater than the due date" 
        })
      }

      // Check if publishDate is greater than createdAt
      const createdAt = new Date(existingTask.createdAt)
      createdAt.setHours(0, 0, 0, 0)
      
      if (newPublishDate <= createdAt) {
        return res.status(400).json({ 
          message: "Publish date must be greater than the task creation date" 
        })
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: { publishDate: publishDate ? new Date(publishDate) : null },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    const io = req.app.get("io")
    io.emit("task:update", task)

    res.json(task)
  } catch (error) {
    next(error)
  }
}

// Update Social Status
export const updateSocialStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { socialStatus } = req.body

    // Only admins and managers can change social status
    if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admins and managers can change social status" })
    }

    const task = await prisma.task.update({
      where: { id },
      data: { socialStatus },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    // Send notification if status changed to PUBLISHED
    if (socialStatus === "PUBLISHED" && task.assignedToId) {
      await prisma.notification.create({
        data: {
          userId: task.assignedToId,
          type: "TASK_UPDATED",
          title: "Post Published",
          message: `Your post "${task.title}" has been published`,
          sentVia: ["IN_APP"],
          metadata: { taskId: task.id },
          link: `/dashboard/tasks/${task.id}`,
        },
      })

      const io = req.app.get("io")
      io.to(`user-${task.assignedToId}`).emit("notification", {
        type: "TASK_UPDATED",
        title: "Post Published",
        message: `Your post "${task.title}" has been published`,
      })
    }

    res.json(task)
  } catch (error) {
    next(error)
  }
}

// Upload Final Creative
export const uploadFinalCreative = async (req, res, next) => {
  try {
    const { taskId } = req.params
    const { description } = req.body

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" })
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { assignedToId: true, title: true }
    })

    if (!task) {
      return res.status(404).json({ message: "Task not found" })
    }

    // Only assigned designer can upload final creative
    if (task.assignedToId !== req.user.id && !["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only assigned designer can upload final creative" })
    }

    let fileUrl = ""
    const fileName = req.file.originalname

    if (process.env.UPLOAD_STORAGE === "cloud" && process.env.CLOUDINARY_CLOUD_NAME) {
      const result = await uploadToCloudinary(req.file)
      fileUrl = result.secure_url
    } else {
      fileUrl = `/uploads/${req.file.filename}`
    }

    const finalCreative = await prisma.finalCreative.create({
      data: {
        fileName,
        fileUrl,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        taskId,
        uploadedById: req.user.id,
        description: description || null,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          }
        }
      }
    })

    // Notify managers that final creative is uploaded
    const managers = await prisma.user.findMany({
      where: {
        role: {
          in: ["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"]
        }
      },
      select: { id: true }
    })

    for (const manager of managers) {
      if (manager.id !== req.user.id) {
        await prisma.notification.create({
          data: {
            userId: manager.id,
            type: "TASK_UPDATED",
            title: "Final Creative Uploaded",
            message: `${req.user.firstName} uploaded final creative for: ${task.title}`,
            sentVia: ["IN_APP"],
            metadata: { taskId },
            link: `/dashboard/tasks/${taskId}`,
          },
        })

        const io = req.app.get("io")
        io.to(`user-${manager.id}`).emit("notification", {
          type: "TASK_UPDATED",
          title: "Final Creative Uploaded",
          message: `${req.user.firstName} uploaded final creative for: ${task.title}`,
        })
      }
    }

    res.status(201).json(finalCreative)
  } catch (error) {
    next(error)
  }
}

// Get Final Creatives for a task
export const getFinalCreatives = async (req, res, next) => {
  try {
    const { taskId } = req.params

    const finalCreatives = await prisma.finalCreative.findMany({
      where: { taskId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
    })

    res.json(finalCreatives)
  } catch (error) {
    next(error)
  }
}

// Delete Final Creative
export const deleteFinalCreative = async (req, res, next) => {
  try {
    const { creativeId } = req.params

    const creative = await prisma.finalCreative.findUnique({
      where: { id: creativeId },
      include: { task: true }
    })

    if (!creative) {
      return res.status(404).json({ message: "Creative not found" })
    }

    // Only uploader or managers can delete
    if (creative.uploadedById !== req.user.id && !["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ message: "You don't have permission to delete this creative" })
    }

    await prisma.finalCreative.delete({
      where: { id: creativeId },
    })

    res.json({ message: "Final creative deleted successfully" })
  } catch (error) {
    next(error)
  }
}

// Update getTaskById to include new fields
export const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        attachments: true,
        finalCreatives: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              }
            }
          },
          orderBy: { createdAt: "desc" }
        },
      },
    })

    if (!task) {
      return res.status(404).json({ message: "Task not found" })
    }

    res.json(task)
  } catch (error) {
    console.error('[v0] getTaskById error:', error)
    next(error)
  }
}

export const updateEstimatedTime = async (req, res, next) => {
  try {
    const { id } = req.params
    const { estimatedTime } = req.body

    // Only admins and managers can update estimated time
    if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Only admins and managers can update estimated time" 
      })
    }

    const task = await prisma.task.update({
      where: { id },
      data: { estimatedTime: parseFloat(estimatedTime) },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    res.json(task)
  } catch (error) {
    next(error)
  }
}

// ✅ Add new endpoint to update actual time (by taskers)
export const updateActualTime = async (req, res, next) => {
  try {
    const { id } = req.params
    const { actualTime } = req.body

    const task = await prisma.task.findUnique({
      where: { id },
      select: { assignedToId: true }
    })

    // Only assigned user can update actual time
    if (task.assignedToId !== req.user.id && !["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Only assigned user can update actual time" 
      })
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { actualTime: parseFloat(actualTime) },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "UPDATE",
        entity: "Task",
        entityId: id,
        userId: req.user.id,
        metadata: {
          actualTime: parseFloat(actualTime),
          estimatedTime: updatedTask.estimatedTime,
          timeDifference: parseFloat(actualTime) - (updatedTask.estimatedTime || 0),
        },
      },
    })

    res.json(updatedTask)
  } catch (error) {
    next(error)
  }
}