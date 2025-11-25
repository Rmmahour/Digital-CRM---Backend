// Default time estimates in hours
export const DEFAULT_TIME_ESTIMATES = {
  STATIC: 1.5,
  REEL: 2.5,
  STORY: 1.0,
  CAROUSEL: 2.0,
  BLOG_POST: 1.0,
  VIDEO: 3.0,
  OTHER: 1.0,
}

export const getDefaultTimeEstimate = (contentType) => {
  return DEFAULT_TIME_ESTIMATES[contentType] || 1.0
}

export const formatTime = (hours) => {
  if (!hours) return 'Not set'
  
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export const parseTimeToHours = (timeString) => {
  // Parse formats like "1.5", "1h 30m", "90m"
  if (!timeString) return 0
  
  // If already a number
  if (!isNaN(timeString)) return parseFloat(timeString)
  
  // Parse "1h 30m" format
  const hourMatch = timeString.match(/(\d+)h/)
  const minMatch = timeString.match(/(\d+)m/)
  
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0
  const minutes = minMatch ? parseInt(minMatch[1]) : 0
  
  return hours + (minutes / 60)
}