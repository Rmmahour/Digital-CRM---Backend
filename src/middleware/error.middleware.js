export const errorHandler = (err, req, res, next) => {
  console.error("[v0] Error:", err)

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation error",
      errors: err.errors,
    })
  }

  if (err.code === "P2002") {
    return res.status(409).json({
      message: "A record with this value already exists",
    })
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    })
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  })
}
