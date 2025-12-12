// Simple in-memory token blacklist
// For production, consider using Redis or database
const blacklistedTokens = new Set();

const addToBlacklist = (token) => {
  blacklistedTokens.add(token);
};

const isBlacklisted = (token) => {
  return blacklistedTokens.has(token);
};

// Optional: Clean up expired tokens periodically (if needed)
const cleanupBlacklist = () => {
  // This is a simple implementation
  // In production with Redis, you can set TTL on tokens
  // For now, tokens will remain in memory until server restart
};

module.exports = {
  addToBlacklist,
  isBlacklisted,
  cleanupBlacklist,
};


