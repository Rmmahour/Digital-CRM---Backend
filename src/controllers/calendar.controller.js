import prisma from "../config/prisma.js"
import { format } from "date-fns"

// Helper function to get random weekday dates excluding Saturday and Sunday
const getRandomWeekdayDates = (startDate, endDate, count) => {
  const dates = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Get all weekdays in the range (Monday=1 to Friday=5)
  const weekdays = []
  const current = new Date(start)

  while (current <= end) {
    const day = current.getDay()
    // 0 = Sunday, 6 = Saturday - exclude both
    if (day !== 0 && day !== 6) {
      weekdays.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }

  console.log(`[v0] Found ${weekdays.length} weekdays in month (excluding Sat/Sun)`)

  // Shuffle and pick random dates
  const shuffled = weekdays.sort(() => 0.5 - Math.random())
  const selected = shuffled.slice(0, Math.min(count, shuffled.length))

  console.log(`[v0] Selected ${selected.length} random weekday dates for tasks`)

  return selected
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
    const { quantity, completed } = req.body

    const updateData = {}
    if (quantity !== undefined) updateData.quantity = Number.parseInt(quantity)
    if (completed !== undefined) updateData.completed = Number.parseInt(completed)

    const scope = await prisma.calendarScope.update({
      where: { id: scopeId },
      data: updateData,
    })

    res.json(scope)
  } catch (error) {
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
    const { scopes } = req.body // Array of { contentType, quantity }

    if (!scopes || !Array.isArray(scopes)) {
      return res.status(400).json({ message: "Scopes array is required" })
    }

    const calendar = await prisma.calendar.findUnique({
      where: { id: calendarId },
      include: { brand: true, tasks: true },
    })

    if (!calendar) {
      return res.status(404).json({ message: "Calendar not found" })
    }

    console.log("[v0] Existing tasks in calendar:", calendar.tasks.length)

    const createdTasks = []

    for (const scopeData of scopes) {
      const { contentType, quantity } = scopeData

      // Check how many tasks already exist for this content type in this calendar
      const existingTasksOfType = calendar.tasks.filter((t) => t.contentType === contentType).length

      console.log(`[v0] Content type ${contentType}: ${existingTasksOfType} existing, ${quantity} requested`)

      // Only create tasks for the difference
      const tasksToCreate = Math.max(0, quantity - existingTasksOfType)

      if (tasksToCreate === 0) {
        console.log(`[v0] Skipping ${contentType} - already has ${existingTasksOfType} tasks`)
        continue
      }

      console.log(`[v0] Will create ${tasksToCreate} new ${contentType} tasks`)

      await prisma.calendarScope.upsert({
        where: {
          calendarId_contentType: {
            calendarId,
            contentType,
          },
        },
        create: {
          calendarId,
          contentType,
          quantity: Number.parseInt(quantity),
        },
        update: {
          quantity: Number.parseInt(quantity),
        },
      })

      const monthStart = new Date(calendar.year, calendar.month - 1, 1)
      const monthEnd = new Date(calendar.year, calendar.month, 0)
      const randomDates = getRandomWeekdayDates(monthStart, monthEnd, tasksToCreate)

      for (let i = 0; i < randomDates.length; i++) {
        const publishDate = randomDates[i]
        const dayOfWeek = publishDate.getDay()

        if (dayOfWeek === 0 || dayOfWeek === 6) {
          console.error(`[v0] ERROR: Generated date ${publishDate} is a weekend!`)
          continue
        }

        const task = await prisma.task.create({
          data: {
            title: `${contentType.replace("_", " ")} #${existingTasksOfType + i + 1}`,
            description: `Create ${contentType.toLowerCase().replace("_", " ")} for ${calendar.brand.name}`,
            status: "TODO", // Always start with TODO
            priority: "MEDIUM",
            brandId: calendar.brandId,
            calendarId: calendar.id,
            contentType,
            publishDate,
            dueDate: new Date(publishDate.getTime() - 2 * 24 * 60 * 60 * 1000),
            createdById: req.user.id,
          },
          include: {
            brand: true,
          },
        })

        createdTasks.push(task)
        console.log(`[v0] Created task #${existingTasksOfType + i + 1} for ${format(publishDate, "EEEE, MMM d")}`)
      }
    }

    await prisma.activityLog.create({
      data: {
        action: "GENERATE",
        entity: "CalendarTasks",
        entityId: calendarId,
        userId: req.user.id,
        metadata: {
          tasksCreated: createdTasks.length,
          scopes,
        },
      },
    })

    console.log(`[v0] Successfully generated ${createdTasks.length} new tasks (status: TODO)`)

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
