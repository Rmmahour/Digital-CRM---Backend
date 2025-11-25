import prisma from "../config/prisma.js"
import { format } from "date-fns"

// Helper function to get random weekday dates excluding Saturday and Sunday
const getRandomWeekdayDates = (startDate, endDate, count) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const weekdays = []
  const current = new Date(start)

  while (current <= end) {
    const day = current.getDay()
    // Exclude Sunday(0) and Saturday(6)
    if (day !== 0 && day !== 6) {
      // CRITICAL FIX: Set time to Noon (12:00:00) 
      // This prevents the date from shifting to the previous day due to timezone offsets
      const safeDate = new Date(current)
      safeDate.setHours(12, 0, 0, 0)
      weekdays.push(safeDate)
    }
    current.setDate(current.getDate() + 1)
  }

  // Shuffle and pick random dates
  return weekdays.sort(() => 0.5 - Math.random()).slice(0, count)
}

const calculateBusinessDueDate = (publishDate, daysBefore = 2) => {
  const date = new Date(publishDate);
  // Reset to Noon just in case
  date.setHours(12, 0, 0, 0); 
  
  let count = 0;
  while (count < daysBefore) {
    date.setDate(date.getDate() - 1);
    const day = date.getDay();
    // Only count this as a "day" if it's a weekday
    if (day !== 0 && day !== 6) {
      count++;
    }
  }
  return date;
}

export const getAllCalendars = async (req, res, next) => {
  try {
    const { brandId, year, month } = req.query

    const where = {}
    if (brandId) where.brandId = brandId
    if (year) where.year = Number.parseInt(year)
    if (month) where.month = Number.parseInt(month)

    const calendars = await prisma.calendar.findMany({
      where,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        scopes: true,
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    })

    res.json(calendars)
  } catch (error) {
    next(error)
  }
}

export const getCalendarById = async (req, res, next) => {
  try {
    const { id } = req.params

    const calendar = await prisma.calendar.findUnique({
      where: { id },
      include: {
        brand: true,
        scopes: true,
        tasks: {
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
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
          orderBy: { publishDate: "asc" },  // ✅ Changed from publishDate to publishDate
        },
      },
    })

    if (!calendar) {
      return res.status(404).json({ message: "Calendar not found" })
    }

    res.json(calendar)
  } catch (error) {
    next(error)
  }
}

export const createCalendar = async (req, res, next) => {
  try {
    const { brandId, month, year } = req.body

    if (!brandId || !month || !year) {
      return res.status(400).json({ message: "Brand, month, and year are required" })
    }

    // Check if calendar already exists
    const existing = await prisma.calendar.findUnique({
      where: {
        brandId_month_year: {
          brandId,
          month: Number.parseInt(month),
          year: Number.parseInt(year),
        },
      },
    })

    if (existing) {
      return res.status(400).json({ message: "Calendar already exists for this month" })
    }

    const calendar = await prisma.calendar.create({
      data: {
        brandId,
        month: Number.parseInt(month),
        year: Number.parseInt(year),
        createdById: req.user.id,
      },
      include: {
        brand: true,
        scopes: true,
      },
    })

    await prisma.activityLog.create({
      data: {
        action: "CREATE",
        entity: "Calendar",
        entityId: calendar.id,
        userId: req.user.id,
        metadata: {
          brandId,
          month,
          year,
        },
      },
    })

    res.status(201).json(calendar)
  } catch (error) {
    next(error)
  }
}

export const updateCalendar = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const calendar = await prisma.calendar.update({
      where: { id },
      data: { status },
      include: {
        brand: true,
        scopes: true,
      },
    })

    await prisma.activityLog.create({
      data: {
        action: "UPDATE",
        entity: "Calendar",
        entityId: calendar.id,
        userId: req.user.id,
        metadata: { status },
      },
    })

    res.json(calendar)
  } catch (error) {
    next(error)
  }
}

export const deleteCalendar = async (req, res, next) => {
  try {
    const { id } = req.params

    await prisma.calendar.delete({
      where: { id },
    })

    await prisma.activityLog.create({
      data: {
        action: "DELETE",
        entity: "Calendar",
        entityId: id,
        userId: req.user.id,
        metadata: {},
      },
    })

    res.json({ message: "Calendar deleted successfully" })
  } catch (error) {
    next(error)
  }
}

export const addScope = async (req, res, next) => {
  try {
    const { calendarId } = req.params
    const { contentType, quantity } = req.body

    if (!contentType || !quantity) {
      return res.status(400).json({ message: "Content type and quantity are required" })
    }

    const scope = await prisma.calendarScope.create({
      data: {
        calendarId,
        contentType,
        quantity: Number.parseInt(quantity),
      },
    })

    await prisma.activityLog.create({
      data: {
        action: "CREATE",
        entity: "CalendarScope",
        entityId: scope.id,
        userId: req.user.id,
        metadata: {
          calendarId,
          contentType,
          quantity,
        },
      },
    })

    res.status(201).json(scope)
  } catch (error) {
    next(error)
  }
}

export const updateScope = async (req, res, next) => {
  try {
    const { scopeId } = req.params
    const { quantity, completed, contentType } = req.body

    // 1. Fetch Scope details
    const currentScope = await prisma.calendarScope.findUnique({
      where: { id: scopeId },
      include: {
        calendar: { include: { brand: true } }
      }
    })

    if (!currentScope) {
      return res.status(404).json({ message: "Scope not found" })
    }

    // Determine New Values
    const newQuantity = quantity !== undefined ? Number.parseInt(quantity) : currentScope.quantity
    const newContentType = contentType || currentScope.contentType
    const isTypeChanging = contentType && contentType !== currentScope.contentType
    
    // 2. Update the Scope itself
    const updateData = {}
    if (quantity !== undefined) updateData.quantity = newQuantity
    if (completed !== undefined) updateData.completed = Number.parseInt(completed)
    if (isTypeChanging) updateData.contentType = newContentType

    const scope = await prisma.calendarScope.update({
      where: { id: scopeId },
      data: updateData,
    })

    // 3. TASK MIGRATION (If Type Changed)
    if (isTypeChanging) {
      console.log(`[v0] Migrating tasks from ${currentScope.contentType} to ${newContentType}`)
      
      const tasksToMigrate = await prisma.task.findMany({
        where: {
          calendarId: currentScope.calendarId,
          contentType: currentScope.contentType,
        }
      })

      const oldTypeString = currentScope.contentType.replace("_", " ")
      const newTypeString = newContentType.replace("_", " ")
      const regex = new RegExp(oldTypeString, "gi")

      const updatePromises = tasksToMigrate.map(task => {
        const newTitle = task.title.replace(regex, (match) => {
           if (match[0] === match[0].toUpperCase()) {
             return newTypeString.charAt(0).toUpperCase() + newTypeString.slice(1).toLowerCase();
           }
           return newTypeString.toLowerCase();
        });

        const newDescription = task.description ? task.description.replace(regex, newTypeString.toLowerCase()) : "";

        return prisma.task.update({
          where: { id: task.id },
          data: {
            contentType: newContentType,
            title: newTitle,
            description: newDescription
          }
        })
      })

      await prisma.$transaction(updatePromises)
    }

    // 4. HANDLE QUANTITY CHANGES
    const quantityDiff = newQuantity - currentScope.quantity

    // CASE A: INCREASE (Add new tasks)
    if (quantityDiff > 0) {
      console.log(`[v0] Adding ${quantityDiff} tasks (Unscheduled)...`)
      // const { year, month } = currentScope.calendar
      // const monthStart = new Date(year, month - 1, 1)
      // const monthEnd = new Date(year, month, 0)
      // const randomDates = getRandomWeekdayDates(monthStart, monthEnd, quantityDiff)
      
      const existingCount = await prisma.task.count({
        where: { calendarId: currentScope.calendarId, contentType: newContentType }
      })

      for (let i = 0; i < quantityDiff; i++) {
        await prisma.task.create({
          data: {
            title: `${newContentType.replace("_", " ")} #${existingCount + i + 1}`,
            description: `Create ${newContentType.toLowerCase().replace("_", " ")} for ${currentScope.calendar.brand.name}`,
            status: "TODO",
            priority: "MEDIUM",
            brandId: currentScope.calendar.brandId,
            calendarId: currentScope.calendarId,
            contentType: newContentType, 
            
            // ✅ CHANGE: No automatic dates
            publishDate: null, 
            dueDate: null,
            
            createdById: req.user.id,
          }
        })
      }

      // for (let i = 0; i < randomDates.length; i++) {
      //   const publishDate = randomDates[i]
      //   const dueDate = calculateBusinessDueDate(publishDate, 2)

      //   await prisma.task.create({
      //     data: {
      //       title: `${newContentType.replace("_", " ")} #${existingCount + i + 1}`,
      //       description: `Create ${newContentType.toLowerCase().replace("_", " ")} for ${currentScope.calendar.brand.name}`,
      //       status: "TODO",
      //       priority: "MEDIUM",
      //       brandId: currentScope.calendar.brandId,
      //       calendarId: currentScope.calendarId,
      //       contentType: newContentType, 
      //       publishDate,
      //       dueDate, // ✅ No more weekend due dates
      //       createdById: req.user.id,
      //     }
      //   })
      // }
    } 
    
    // CASE B: DECREASE (Remove excess tasks)
    else if (quantityDiff < 0) {
      const countToRemove = Math.abs(quantityDiff)
      console.log(`[v0] Removing ${countToRemove} excess tasks...`)

      const allTasks = await prisma.task.findMany({
        where: { 
          calendarId: currentScope.calendarId,
          contentType: newContentType 
        },
        orderBy: { publishDate: 'desc' }
      })

      // Sort Priority: TODO first, then IN_PROGRESS, then COMPLETED
      const sortedTasks = allTasks.sort((a, b) => {
        const scoreA = a.status === 'TODO' ? 2 : (a.status === 'IN_PROGRESS' ? 1 : 0);
        const scoreB = b.status === 'TODO' ? 2 : (b.status === 'IN_PROGRESS' ? 1 : 0);
        return scoreB - scoreA;
      })

      const tasksToDelete = sortedTasks.slice(0, countToRemove)
      const idsToDelete = tasksToDelete.map(t => t.id)

      if (idsToDelete.length > 0) {
        await prisma.task.deleteMany({
          where: { id: { in: idsToDelete } }
        })
      }
    }

    res.json(scope)
  } catch (error) {
    if (error.code === 'P2002') {
       return res.status(400).json({ message: "A scope with this content type already exists." })
    }
    next(error)
  }
}

export const deleteScope = async (req, res, next) => {
  try {
    const { scopeId } = req.params

    await prisma.calendarScope.delete({
      where: { id: scopeId },
    })

    res.json({ message: "Scope deleted successfully" })
  } catch (error) {
    next(error)
  }
}

export const generateTasks = async (req, res, next) => {
  try {
    const { calendarId } = req.params
    const { scopes } = req.body 

    if (!scopes || !Array.isArray(scopes)) {
      return res.status(400).json({ message: "Scopes array is required" })
    }

    const calendar = await prisma.calendar.findUnique({
      where: { id: calendarId },
      include: { brand: true, tasks: true },
    })

    if (!calendar) return res.status(404).json({ message: "Calendar not found" })

    const createdTasks = []

    for (const scopeData of scopes) {
      const { contentType, quantity } = scopeData

      const existingTasksOfType = calendar.tasks.filter((t) => t.contentType === contentType).length
      const tasksToCreate = Math.max(0, quantity - existingTasksOfType)

      if (tasksToCreate === 0) continue

      // Update/Create Scope
      await prisma.calendarScope.upsert({
        where: { calendarId_contentType: { calendarId, contentType } },
        create: { calendarId, contentType, quantity: Number.parseInt(quantity) },
        update: { quantity: Number.parseInt(quantity) },
      })

      for (let i = 0; i < tasksToCreate; i++) {
        
        const task = await prisma.task.create({
          data: {
            title: `${contentType.replace("_", " ")} #${existingTasksOfType + i + 1}`,
            description: `Create ${contentType.toLowerCase().replace("_", " ")} for ${calendar.brand.name}`,
            status: "TODO",
            priority: "MEDIUM",
            brandId: calendar.brandId,
            calendarId: calendar.id,
            contentType,
            
            // ✅ CHANGE: Set to null (Unscheduled)
            publishDate: null,
            dueDate: null, 
            
            createdById: req.user.id,
          },
          include: { brand: true },
        })

        createdTasks.push(task)
      }

      // const monthStart = new Date(calendar.year, calendar.month - 1, 1)
      // const monthEnd = new Date(calendar.year, calendar.month, 0)
      
      // const randomDates = getRandomWeekdayDates(monthStart, monthEnd, tasksToCreate)

      // for (let i = 0; i < randomDates.length; i++) {
      //   const publishDate = randomDates[i]
        
      //   // ✅ Use smart due date (no weekends)
      //   const dueDate = calculateBusinessDueDate(publishDate, 2)

      //   const task = await prisma.task.create({
      //     data: {
      //       title: `${contentType.replace("_", " ")} #${existingTasksOfType + i + 1}`,
      //       description: `Create ${contentType.toLowerCase().replace("_", " ")} for ${calendar.brand.name}`,
      //       status: "TODO",
      //       priority: "MEDIUM",
      //       brandId: calendar.brandId,
      //       calendarId: calendar.id,
      //       contentType,
      //       publishDate,
      //       dueDate, // ✅ Corrected
      //       createdById: req.user.id,
      //     },
      //     include: { brand: true },
      //   })

      //   createdTasks.push(task)
      // }
    }

    await prisma.activityLog.create({
      data: {
        action: "GENERATE",
        entity: "CalendarTasks",
        entityId: calendarId,
        userId: req.user.id,
        metadata: { tasksCreated: createdTasks.length, scopes },
      },
    })

    res.status(201).json({
      message: `Generated ${createdTasks.length} new tasks`,
      tasks: createdTasks,
    })
  } catch (error) {
    console.error("[v0] Error generating tasks:", error)
    next(error)
  }
}

// New endpoint to update task dates via drag-and-drop
export const updateTaskDate = async (req, res, next) => {
  try {
    const { taskId } = req.params
    const { publishDate } = req.body

    if (!publishDate) {
      return res.status(400).json({ message: "Posting date is required" })
    }

    const newDate = new Date(publishDate)
    const dayOfWeek = newDate.getDay()

    // Prevent assigning to weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({ message: "Cannot assign tasks to Saturday or Sunday" })
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        publishDate: newDate,
        dueDate: new Date(newDate.getTime() - 2 * 24 * 60 * 60 * 1000), // Update due date accordingly
      },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        action: "UPDATE",
        entity: "Task",
        entityId: task.id,
        userId: req.user.id,
        metadata: {
          field: "publishDate",
          oldValue: null,
          newValue: publishDate,
        },
      },
    })

    res.json(task)
  } catch (error) {
    next(error)
  }
}
