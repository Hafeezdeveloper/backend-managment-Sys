const express = require("express");
const ResidentModel = require("../models/resident.schema");
const { authenticateToken, adminOnly } = require("../middlewear/verifycommonMiddlewaer");
const { successHandler, failureHandler } = require("../utlits/helper/helper");

const ResidentRouter = express.Router();

/**
 * @route GET /resident
 * @summary Get all residents with pagination, search, and filtering
 * @description Get all residents with pagination, search, and filtering (Admin only). Supports searching by name, email, apartment, or phone. Can filter by status and sort by any field.
 * @group Residents - Resident management endpoints
 * @param {number} page.query - Page number for pagination (default: 1)
 * @param {number} limit.query - Number of items per page (default: 10)
 * @param {string} search.query - Search term for name, email, apartment, or phone
 * @param {string} status.query - Filter by status (e.g., "Active", "Pending")
 * @param {string} sort.query - Field to sort by (default: "createdAt")
 * @param {string} order.query - Sort order: "asc" or "desc" (default: "desc")
 * @param {string} Authorization.header.required - Bearer token for authentication
 * @response 200 - Success response with residents list and pagination info
 * @response 401 - Unauthorized - Invalid or missing token
 * @response 403 - Forbidden - Not an admin user
 * @response 500 - Internal server error
 */
// Get all residents (Admin only)
ResidentRouter.get("/", authenticateToken, adminOnly, async (req, res) => {
  try {
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status;
    const sort = req.query.sort || "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { apartment: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Build sort object
    const sortObj = {};
    sortObj[sort] = order;

    // Fetch residents with pagination
    const [residents, total] = await Promise.all([
      ResidentModel.find(query)
        .select(
          "name apartment phone email status approvalStatus familyMembers joinDate occupation ownershipType emergencyContact emergencyContactPhone createdAt"
        )
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      ResidentModel.countDocuments(query),
    ]);

    // Add counts for related data (if models exist, otherwise return 0)
    const residentsWithCounts = residents.map((resident) => ({
      id: resident._id,
      name: resident.name,
      apartment: resident.apartment,
      phone: resident.phone,
      email: resident.email,
      status: resident.status,
      approvalStatus: resident.approvalStatus,
      familyMembers: resident.familyMembers,
      joinDate: resident.joinDate,
      occupation: resident.occupation,
      ownershipType: resident.ownershipType,
      emergencyContact: resident.emergencyContact,
      emergencyContactPhone: resident.emergencyContactPhone,
      createdAt: resident.createdAt,
      _count: {
        vehicles: 0, // Will be updated when Vehicle model is created
        complaints: 0, // Will be updated when Complaint model is created
        serviceBookings: 0, // Will be updated when ServiceBooking model is created
      },
    }));

    return res.json(
      successHandler(200, {
        residents: residentsWithCounts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }, "Residents fetched successfully")
    );
  } catch (error) {
    console.error("Get residents error:", error);
    return res.status(500).json(
      failureHandler(500, "Failed to fetch residents")
    );
  }
});

module.exports = ResidentRouter;

