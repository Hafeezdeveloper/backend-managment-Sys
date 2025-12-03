const jwt = require("jsonwebtoken");
const AdminModel = require("../models/adminn.schema");
const ServiceProviderModel = require("../models/serviceProvider.schema");
const ResidentModel = require("../models/resident.schema");
const { failureHandler } = require("../utlits/helper/helper");
const dotenv = require("dotenv");

dotenv.config();

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json(
        failureHandler(401, "No token provided")
      );
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.SECURE_KEY);
    
    // Determine user type (admin tokens don't have type field)
    const userType = decoded.type || "admin";
    const userId = decoded.id || decoded._id;
    
    let collection = {
        "serviceProvider": ServiceProviderModel,
        "resident": ResidentModel,
        "admin": AdminModel
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
    if (error.name === "JsonWebTokenError") {
      return res.status(403).json(
        failureHandler(403, "Invalid token")
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
