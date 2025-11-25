import nodemailer from "nodemailer"
import twilio from "twilio"
import prisma from "../config/prisma.js"

// Email transporter setup
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

// Twilio client setup
let twilioClient = null
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
}

export const sendNotification = async ({ userId, title, message, type = "GENERAL", channels = ["IN_APP"] , metadata, link}) => {
  try {
    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        whatsAppNumber: true,
        firstName: true,
        lastName: true,
      },
    })

    if (!user) {
      throw new Error("User not found")
    }

    const sentVia = ["IN_APP"]

    // Send email notification
    if (channels.includes("EMAIL") && process.env.EMAIL_USER) {
      try {
        await emailTransporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: user.email,
          subject: title,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${title}</h2>
              <p style="color: #666; line-height: 1.6;">${message}</p>
              <hr style="border: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #999; font-size: 12px;">
                This is an automated message from Abacus CRM. Please do not reply to this email.
              </p>
            </div>
          `,
        })
        sentVia.push("EMAIL")
        console.log(`[v0] Email notification sent to ${user.email}`)
      } catch (error) {
        console.error("[v0] Failed to send email:", error.message)
      }
    }

    // Send WhatsApp notification
    if (channels.includes("WHATSAPP") && user.whatsAppNumber && twilioClient && process.env.TWILIO_WHATSAPP_FROM) {
      try {
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM,
          to: user.whatsAppNumber,
          body: `${title}\n\n${message}`,
        })
        sentVia.push("WHATSAPP")
        console.log(`[v0] WhatsApp notification sent to ${user.whatsAppNumber}`)
      } catch (error) {
        console.error("[v0] Failed to send WhatsApp:", error.message)
      }
    }

    // Create in-app notification
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        userId,
        type,
        sentVia,
        metadata,  
        link,      
      },
    })

    return notification
  } catch (error) {
    console.error("[v0] Notification service error:", error)
    throw error
  }
}

export const notifyTaskAssigned = async (task, assignedUser) => {
  await sendNotification({
    userId: assignedUser.id,
    title: "New Task Assigned",
    message: `You have been assigned to task: ${task.title}`,
    type: "TASK_ASSIGNED",
    channels: ["IN_APP", "EMAIL", "WHATSAPP"],
    metadata: { taskId: task.id },  // ✅ ADD THIS
    link: `/dashboard/tasks/${task.id}`  // ✅ ADD THIS
  })
}

export const notifyTaskCompleted = async (task, assignerUser) => {
  await sendNotification({
    userId: assignerUser.id,
    title: "Task Completed",
    message: `Task "${task.title}" has been marked as completed`,
    type: "TASK_COMPLETED",
    channels: ["IN_APP", "EMAIL"],
    metadata: { taskId: task.id },  // ✅ ADD THIS
    link: `/dashboard/tasks/${task.id}`  // ✅ ADD THIS
  })
}

export const notifyMention = async (mentionedUserId, mentionerName, taskTitle) => {
  await sendNotification({
    userId: mentionedUserId,
    title: "You were mentioned",
    message: `${mentionerName} mentioned you in task: ${taskTitle}`,
    type: "MENTION",
    channels: ["IN_APP", "EMAIL"],
  })
}
