import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting database seed...")

  // Create Super Admin
  const hashedPassword = await bcrypt.hash("admin123", 10)

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@abacus.com" },
    update: {},
    create: {
      email: "superadmin@abacus.com",
      password: hashedPassword,
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  })

  const admin = await prisma.user.upsert({
    where: { email: "admin@abacus.com" },
    update: {},
    create: {
      email: "admin@abacus.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
      isActive: true,
    },
  })

  const accountManager = await prisma.user.upsert({
    where: { email: "manager@abacus.com" },
    update: {},
    create: {
      email: "manager@abacus.com",
      password: hashedPassword,
      firstName: "Account",
      lastName: "Manager",
      role: "ACCOUNT_MANAGER",
      isActive: true,
    },
  })

  const writer = await prisma.user.upsert({
    where: { email: "writer@abacus.com" },
    update: {},
    create: {
      email: "writer@abacus.com",
      password: hashedPassword,
      firstName: "Content",
      lastName: "Writer",
      role: "WRITER",
      isActive: true,
    },
  })

  const designer = await prisma.user.upsert({
    where: { email: "designer@abacus.com" },
    update: {},
    create: {
      email: "designer@abacus.com",
      password: hashedPassword,
      firstName: "Creative",
      lastName: "Designer",
      role: "DESIGNER",
      isActive: true,
    },
  })

  // Create sample brands
  const brand1 = await prisma.brand.create({
    data: {
      name: "TechCorp",
      description: "Technology company social media",
      isActive: true,
    },
  })

  const brand2 = await prisma.brand.create({
    data: {
      name: "FashionHub",
      description: "Fashion brand social media",
      isActive: true,
    },
  })

  // Assign users to brands
  await prisma.brandUser.createMany({
    data: [
      { brandId: brand1.id, userId: accountManager.id },
      { brandId: brand1.id, userId: writer.id },
      { brandId: brand1.id, userId: designer.id },
      { brandId: brand2.id, userId: accountManager.id },
      { brandId: brand2.id, userId: writer.id },
    ],
  })

  // Create sample tasks
  await prisma.task.createMany({
    data: [
      {
        title: "Create Instagram post for product launch",
        description: "Design and write copy for new product announcement",
        status: "TODO",
        priority: "HIGH",
        brandId: brand1.id,
        assignedToId: writer.id,
        createdById: admin.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Design Facebook banner",
        description: "Create promotional banner for summer sale",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        brandId: brand2.id,
        assignedToId: designer.id,
        createdById: admin.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    ],
  })

  console.log("Database seeded successfully!")
  console.log("\nTest Accounts:")
  console.log("Super Admin: superadmin@abacus.com / admin123")
  console.log("Admin: admin@abacus.com / admin123")
  console.log("Account Manager: manager@abacus.com / admin123")
  console.log("Writer: writer@abacus.com / admin123")
  console.log("Designer: designer@abacus.com / admin123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
