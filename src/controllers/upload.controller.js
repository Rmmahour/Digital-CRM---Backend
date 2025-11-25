import prisma from "../config/prisma.js";

export const uploadProfileImage = async (req, res) => {
  try {
    console.log("[Upload] Request user:", req.user?.id);
    console.log("[Upload] Request file:", req.file);
    console.log("[Upload] Request body:", req.body);

    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    let imageUrl;

    if (process.env.UPLOAD_STORAGE === "cloud") {
      // Assuming you have cloudinary setup
      const uploaded = await uploadToCloudinary(req.file);
      imageUrl = uploaded.secure_url;
    } else {
      // ✅ FIX: Use dynamic base URL based on environment
      let baseUrl;
      
      if (process.env.NODE_ENV === "production") {
        // In production, use your actual domain
        baseUrl = process.env.BASE_URL || "https://digitalcrm.abacusdesk.com";
      } else {
        // In development, use localhost
        baseUrl = process.env.BASE_URL || "http://localhost:5000";
      }
      
      // Store only the relative path in database
      // This makes it more flexible when domain changes
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatar: imageUrl },
      select: { 
        id: true, 
        avatar: true,
        firstName: true,
        lastName: true 
      },
    });

    return res.json({
      success: true,
      message: "Profile photo updated",
      avatar: updated.avatar,
      user: updated
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    return res.status(500).json({ 
      message: "Image upload failed", 
      error: error.message 
    });
  }
};