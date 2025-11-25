import bcrypt from "bcryptjs"
import prisma from "../config/prisma.js"

export const getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive } = req.query

    const where = { deletedAt: null }
    if (role) where.role = role
    if (isActive !== undefined) where.isActive = isActive === "true"

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        whatsAppNumber: true,
        mobileNumber: true,
        avatar: true,
        joinDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    res.json(users)
  } catch (error) {
    next(error)
  }
}

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        whatsAppNumber: true,
        joinDate: true,
        createdAt: true,
        brandAccess: {
          include: {
            brand: true,
          },
        },
      },
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json(user)
  } catch (error) {
    next(error)
  }
}

export const createUser = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: "All fields are required" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        role: role || "CLIENT_VIEWER",
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "CREATE_USER",
        entity: "User",
        entityId: user.id,
        userId: req.user.id,
      },
    })

    res.status(201).json(user)
  } catch (error) {
    next(error)
  }
}

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params
    const { firstName, lastName, role, isActive, whatsAppNumber, avatar, mobileNumber } = req.body

    // Only Super Admin can change roles
    if (role && !["SUPER_ADMIN", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only Super Admin can change roles" })
    }

    const updateData = {}
    if (firstName) updateData.firstName = firstName
    if (lastName) updateData.lastName = lastName
    if (role) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    if (whatsAppNumber !== undefined) updateData.whatsAppNumber = whatsAppNumber
    if (avatar !== undefined) updateData.avatar = avatar
    if (mobileNumber !== undefined) updateData.mobileNumber = mobileNumber

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        whatsAppNumber: true,
        avatar: true,
        mobileNumber: true,
        joinDate: true,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "UPDATE_USER",
        entity: "User",
        entityId: user.id,
        userId: req.user.id,
      },
    })

    res.json(user)
  } catch (error) {
    next(error)
  }
}

export const uploadProfileImage = async (req, res, next) => {
  try {
    const userId = req.body.userId;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;

    // Save to DB using Prisma
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar: imageUrl },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
    });

    res.json({
      success: true,
      imageUrl,
      user,
    });

  } catch (error) {
    next(error);
  }
};



export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params
    const { permanent } = req.query

    if (id === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own account" })
    }

    // Only SUPER_ADMIN can permanently delete
    if (permanent === 'true') {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ 
          message: 'Only Super Admin can permanently delete users' 
        })
      }

      // Re-assign tasks before deleting
      await prisma.task.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null }
      })

      await prisma.user.delete({
        where: { id }
      })

      await prisma.activityLog.create({
        data: {
          action: 'PERMANENT_DELETE',
          entity: 'User',
          entityId: id,
          userId: req.user.id,
        },
      })

      return res.json({ message: "User permanently deleted" })
    }

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: req.user.id,
        isActive: false,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "DELETE_USER",
        entity: "User",
        entityId: id,
        userId: req.user.id,
        metadata: {
          deletedBy: `${req.user.firstName} ${req.user.lastName}`,
          willBeDeletedOn: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        }
      },
    })

    res.json({ message: "User moved to trash. Will be permanently deleted in 14 days." })
  } catch (error) {
    next(error)
  }
}


export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { isActive } = req.body

    if (id === req.user.id) {
      return res.status(400).json({ message: "Cannot change your own status" })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        whatsAppNumber: true,
        avatar: true,
        mobileNumber: true,
        joinDate: true,
      },
    })

    await prisma.activityLog.create({
      data: {
        action: "UPDATE_USER_STATUS",
        entity: "User",
        entityId: id,
        userId: req.user.id,
        metadata: { newStatus: isActive ? "Active" : "Inactive" },
      },
    })

    res.json(user)
  } catch (error) {
    next(error)
  }
}
