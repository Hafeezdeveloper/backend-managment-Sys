const jwt = require("jsonwebtoken");
const AdminModel = require("../models/adminn.schema");
const ServiceProviderModel = require("../models/serviceProvider.schema");
const ResidentModel = require("../models/resident.schema");
const { failureHandler } = require("../utlits/helper/helper");
const { isBlacklisted } = require("../utlits/tokenBlacklist");
const dotenv = require("dotenv");

dotenv.config();

const authenticateToken = async (req, res, next) => {
  try {
    // Check for authorization header in different cases
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    // Debug logging
    console.log("Auth header received:", authHeader ? "Present" : "Missing");
    console.log("Auth header value:", authHeader);
    
    if (!authHeader) {
      return res.status(401).json(
        failureHandler(401, "No authorization header provided")
      );
    }

    // Extract token - handle both "Bearer <token>" and direct token
    let token;
    if (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      // If no Bearer prefix, assume the whole string is the token
      token = authHeader;
    }

    // Trim whitespace
    token = token?.trim();

    if (!token || token === "") {
      console.error("Token is empty or undefined");
      return res.status(401).json(
        failureHandler(401, "No token provided in authorization header")
      );
    }

    // Check if token is blacklisted (logged out)
    if (isBlacklisted(token)) {
      return res.status(401).json(
        failureHandler(401, "Token has been invalidated. Please login again.")
      );
    }

    // Check if SECURE_KEY is set
    if (!process.env.SECURE_KEY) {
      console.error("SECURE_KEY is not set in environment variables");
      return res.status(500).json(
        failureHandler(500, "Server configuration error")
      );
    }

    // Verify token
    console.log("Token length:", token.length);
    console.log("Token preview:", token.substring(0, 20) + "...");
    const decoded = jwt.verify(token, process.env.SECURE_KEY);
    console.log("decoded", decoded);
    
    // Determine user type (admin tokens don't have type field)
    const userType = decoded.type || "admin";
    const userId = decoded.id || decoded._id;
    
    let collection = {
        "serviceProvider": ServiceProviderModel,
        "resident": ResidentModel,
        "admin": AdminModel,
        "superAdmin": AdminModel,
    };
    
    let user = await collection[userType].findById(userId);

    if (!user) {
      return res.status(401).json(
        failureHandler(401, "User not found")
      );
    }

    // Attach user info to request
    req.user = {
      id: user._id.toString(),
      type: userType,
      email: user.email,
      ...(userType === "admin" && { username: user.username, isSuperAdmin: user.isSuperAdmin }),
      ...(userType === "serviceProvider" && { 
        username: user.username, 
        name: user.name,
        status: user.status 
      }),
      ...(userType === "resident" && { 
        name: user.name,
        apartment: user.apartment,
        status: user.status,
        approvalStatus: user.approvalStatus
      }),
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    
    if (error.name === "JsonWebTokenError") {
      if (error.message.includes("malformed")) {
        console.error("Token is malformed. Check if token is sent correctly as 'Bearer <token>'");
        return res.status(403).json(
          failureHandler(403, "Invalid token format. Ensure token is sent as 'Bearer <token>' in Authorization header")
        );
      }
      return res.status(403).json(
        failureHandler(403, "Invalid token: " + error.message)
      );
    }
    if (error.name === "TokenExpiredError") {
      return res.status(403).json(
        failureHandler(403, "Token has expired")
      );
    }
    return res.status(403).json(
      failureHandler(403, "Token is not valid or has expired")
    );
  }
};

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
  if (req.user && req.user.type === "admin") {
    next();
  } else {
    return res.status(403).json(
      failureHandler(403, "Access denied. Admin only.")
    );
  }
};

// Middleware to check if user is service provider
const serviceProviderOnly = (req, res, next) => {
  if (req.user && req.user.type === "serviceProvider") {
    next();
  } else {
    return res.status(403).json(
      failureHandler(403, "Access denied. Service Provider only.")
    );
  }
};

// Middleware to check if user is resident
const residentOnly = (req, res, next) => {
  if (req.user && req.user.type === "resident") {
    next();
  } else {
    return res.status(403).json(
      failureHandler(403, "Access denied. Resident only.")
    );
  }
};

// Middleware to check if user is admin or service provider
const adminOrServiceProvider = (req, res, next) => {
  if (req.user && (req.user.type === "admin" || req.user.type === "serviceProvider")) {
    next();
  } else {
    return res.status(403).json(
      failureHandler(403, "Access denied. Admin or Service Provider only.")
    );
  }
};

// Middleware to check if user is admin or resident
const adminOrResident = (req, res, next) => {
  if (req.user && (req.user.type === "admin" || req.user.type === "resident")) {
    next();
  } else {
    return res.status(403).json(
      failureHandler(403, "Access denied. Admin or Resident only.")
    );
  }
};

module.exports = { 
  authenticateToken,
  adminOnly,
  serviceProviderOnly,
  residentOnly,
  adminOrServiceProvider,
  adminOrResident
};
