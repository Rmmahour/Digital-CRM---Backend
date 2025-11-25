import multer from "multer"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import { v2 as cloudinary } from "cloudinary"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Local storage configuration
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname))
  },
})

// Memory storage for Cloudinary
const memoryStorage = multer.memoryStorage()

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|mp4|mov|avi|mp3|wav|svg|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (mimetype && extname) {
    return cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only images, documents, videos, and audio files are allowed."))
  }
}

// Determine storage based on environment variable
const storage =
  process.env.UPLOAD_STORAGE === "cloud" && process.env.CLOUDINARY_CLOUD_NAME ? memoryStorage : localStorage

// Multer upload configuration
export const upload = multer({
  storage,
  limits: {
    fileSize: Number.parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 * 1024, // 10GB default
  },
  fileFilter,
})

// Upload to Cloudinary
export const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "abacus-crm",
        resource_type: "auto",
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      },
    )
    uploadStream.end(file.buffer)
  })
}

export { cloudinary }
