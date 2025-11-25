import prisma from "../config/prisma.js"

export const getAllBrands = async (req, res, next) => {
  try {
    const { isActive } = req.query

    const where = { deletedAt: null }
    if (isActive !== undefined) where.isActive = isActive === "true"

    // Filter brands based on user role
    if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_MANAGER"].includes(req.user.role)) {
      where.users = {
        some: {
          userId: req.user.id,
        },
      }
    }

    const brands = await prisma.brand.findMany({
      where,
      include: {
        _count: {
          select: {
            tasks: true,
            users: true,
          },
        },
      },
      // orderBy: { createdAt: "desc" },
      orderBy: { order: "asc" },
    })

    res.json(brands)
  } catch (error) {
    next(error)
  }
}

export const getBrandById = async (req, res, next) => {
  try {
    const { id } = req.params

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    })

    if (!brand) {
      return res.status(404).json({ message: "Brand not found" })
    }

    res.json(brand)
  } catch (error) {
    next(error)
  }
}

export const createBrand = async (req, res, next) => {
  try {
    const { name, description, logo } = req.body

    if (!name) {
      return res.status(400).json({ message: "Brand name is required" })
    }

    const brand = await prisma.brand.create({
      data: {
        name,
        description,
        logo,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "CREATE_BRAND",
        entity: "Brand",
        entityId: brand.id,
        userId: req.user.id,
      },
    })

    res.status(201).json(brand)
  } catch (error) {
    next(error)
  }
}

export const updateBrand = async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, description, logo, isActive } = req.body

    const updateData = {}
    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (logo !== undefined) updateData.logo = logo
    if (isActive !== undefined) updateData.isActive = isActive

    const brand = await prisma.brand.update({
      where: { id },
      data: updateData,
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "UPDATE_BRAND",
        entity: "Brand",
        entityId: brand.id,
        userId: req.user.id,
      },
    })

    res.json(brand)
  } catch (error) {
    next(error)
  }
}

export const deleteBrand = async (req, res, next) => {
  try {
    const { id } = req.params
    const { permanent } = req.query

    if (permanent === 'true') {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ 
          message: 'Only Super Admin can permanently delete brands' 
        })
      }

      // Permanently delete
      await prisma.brand.delete({
        where: { id }
      })

      await prisma.activityLog.create({
        data: {
          action: 'PERMANENT_DELETE',
          entity: 'Brand',
          entityId: id,
          userId: req.user.id,
        },
      })

      return res.json({ message: "Brand permanently deleted" })
    }

    await prisma.brand.update({
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
        action: "DELETE_BRAND",
        entity: "Brand",
        entityId: id,
        userId: req.user.id,
        metadata: {
          deletedBy: `${req.user.firstName} ${req.user.lastName}`,
          willBeDeletedOn: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        }
      },
    })

    res.json({ message: "Brand moved to trash. Will be permanently deleted in 14 days." })
  } catch (error) {
    next(error)
  }
}

// backend/controllers/brands.controller.js
export const reorderBrands = async (req, res, next) => {
  console.log("HIT REORDER CONTROLLER"); // 👈 Check your terminal when you drag items
  console.log("Payload:", req.body.items);
  try {
    const { items } = req.body // Expecting array: [{ id: "abc", order: 0 }, { id: "xyz", order: 1 }]

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Items array is required" })
    }

    // Run all updates in a single transaction for safety
    await prisma.$transaction(
      items.map((item) =>
        prisma.brand.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )

    res.json({ message: "Order updated successfully" })
  } catch (error) {
    console.error("Reorder Error:", error);
    next(error)
  }
}

export const assignUserToBrand = async (req, res, next) => {
  try {
    const { id } = req.params
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" })
    }

    const brandUser = await prisma.brandUser.create({
      data: {
        brandId: id,
        userId,
      },
    })

    res.status(201).json(brandUser)
  } catch (error) {
    next(error)
  }
}

export const removeUserFromBrand = async (req, res, next) => {
  try {
    const { id, userId } = req.params

    await prisma.brandUser.delete({
      where: {
        brandId_userId: {
          brandId: id,
          userId,
        },
      },
    })

    res.json({ message: "User removed from brand successfully" })
  } catch (error) {
    next(error)
  }
}
