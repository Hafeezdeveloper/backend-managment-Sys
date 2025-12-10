const express = require("express");
const ResidentModel = require("../models/resident.schema");
const ComplaintModel = require("../models/complaint.schema");
const { authenticateToken, adminOnly, adminOrResident } = require("../middlewear/verifycommonMiddlewaer");
const { successHandler, failureHandler } = require("../utlits/helper/helper");

const ResidentRouter = express.Router();

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
// Approve / Reject Resident (Admin Only)
ResidentRouter.put(
  "/:id/approval",
  authenticateToken,
  adminOnly,
  async (req, res) => {
    try {
      const residentId = req.params.id;
      const { approvalStatus } = req.body;

      // ✅ Validate approval status
      if (!["approved", "rejected"].includes(approvalStatus)) {
        return res.status(400).json(
          failureHandler(400, "Approval status must be approved or rejected")
        );
      }

      // ✅ Find & Update Resident
      const updatedResident = await ResidentModel.findByIdAndUpdate(
        residentId,
        {
          approvalStatus,
          status: approvalStatus === "approved" ? "active" : "rejected",
        },
        { new: true }
      ).select("name apartment email status approvalStatus");

      if (!updatedResident) {
        return res.status(404).json(
          failureHandler(404, "Resident not found")
        );
      }

      return res.json(
        successHandler(
          200,
          updatedResident,
          `Resident ${approvalStatus.toLowerCase()} successfully`
        )
      );
    } catch (error) {
      console.error("Approve resident error:", error);
      return res.status(500).json(
        failureHandler(500, "Failed to update approval status")
      );
    }
  }
);

// Delete Resident (Admin Only)
ResidentRouter.delete(
  "/:id",
  authenticateToken,
  adminOnly,
  async (req, res) => {
    try {
      const residentId = req.params.id;

      // ✅ Check if resident exists
      const resident = await ResidentModel.findById(residentId);

      if (!resident) {
        return res.status(404).json(
          failureHandler(404, "Resident not found")
        );
      }

      // ✅ Delete Resident
      await ResidentModel.findByIdAndDelete(residentId);

      return res.json(
        successHandler(200, null, "Resident deleted successfully")
      );
    } catch (error) {
      console.error("Delete resident error:", error);
      return res.status(500).json(
        failureHandler(500, "Failed to delete resident")
      );
    }
  }
);

// Get all Complaints (Admin sees all, Resident sees only their own)
ResidentRouter.get(
  "/complaints",
  authenticateToken,
  async (req, res) => {
    try {
      // Build query - if resident, only show their complaints
      const where = {};
      if (req.user.type === "resident") {
        where.residentId = req.user.id;
      }

      if(req.query.search) {
        where.$or = [
          { title: { $regex: req.query.search, $options: "i" } },
          { description: { $regex: req.query.search, $options: "i" } },
        ];
      }

      if(req.query.status) {
        where.status = req.query.status;
      }

      // Fetch complaints with resident info
      const complaints = await ComplaintModel.find(where)
        .populate("residentId", "name apartment")
        .sort({ createdAt: -1 })
        .lean();

        const totalComplaints = await ComplaintModel.countDocuments(where);
        const totalOpenComplaints = await ComplaintModel.countDocuments({status: "open"});
        const totalInProgressComplaints = await ComplaintModel.countDocuments({status: "in_progress"});
        const totalResolvedComplaints = await ComplaintModel.countDocuments({status: "resolved"});

      // Format response
      const formattedComplaints = complaints.map((complaint) => ({
        id: complaint._id,
        title: complaint.title,
        category: complaint.category,
        status: complaint.status,
        priority: complaint.priority,
        description: complaint.description,
        images: complaint.images,
        adminResponse: complaint.adminResponse,
        responseDate: complaint.responseDate,
        residentId: complaint.residentId?._id || complaint.residentId,
        resident: complaint.residentId
          ? {
              name: complaint.residentId.name,
              apartment: complaint.residentId.apartment,
            }
          : null,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
      }));

      return res.json(
        successHandler(200, { complaints: formattedComplaints, totalComplaints: totalComplaints, totalOpenComplaints: totalOpenComplaints, totalInProgressComplaints: totalInProgressComplaints, totalResolvedComplaints: totalResolvedComplaints }, "Complaints fetched successfully")
      );
    } catch (error) {
      console.error("Get complaints error:", error);
      return res.status(500).json(
        failureHandler(500, "Failed to fetch complaints")
      );
    }
  }
);

// Create Complaint (Admin or Resident)
ResidentRouter.post(
  "/complaints",
  authenticateToken,
  async (req, res) => {
    try {
      const { title, category, description, priority, images, voiceNote, complaintText } = req.body;
      const residentId = req.user.id;

      // Validate input
      if (!title || !category || !description) {
        return res.status(400).json(
          failureHandler(400, "Title, category, and description are required")
        );
      }

      // Create complaint
      const complaint = await ComplaintModel.create({
        title,
        category,
        description,
        priority: priority ? priority : "medium",
        images: images || [],
        status: "open",
        residentId: residentId,
      });

      // Format response
      const complaintResponse = {
        id: complaint._id,
        title: complaint.title,
        category: complaint.category,
        status: complaint.status,
        priority: complaint.priority,
        description: complaint.description,
        images: complaint.images,
        residentId: complaint.residentId,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
      };

      return res.status(201).json(
        successHandler(201, complaintResponse, "Complaint submitted successfully")
      );
    } catch (error) {
      console.error("Create complaint error:", error);
      return res.status(500).json(
        failureHandler(500, error instanceof Error ? error.message : "Failed to submit complaint")
      );
    }
  }
);

// Update Complaint Status (Admin only)
ResidentRouter.put(
  "/complaints/:id/admin-status-update",
  authenticateToken,
  adminOnly,
  async (req, res) => {
    try {
      const { status } = req.body;
      const complaintId = req.params.id;

      if (!status) {
        return res.status(400).json(
          failureHandler(400, "Status is required")
        );
      }

      // Validate status value
      const validStatuses = ["open", "in_progress", "resolved", "closed"];
      if (!validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json(
          failureHandler(400, `Status must be one of: ${validStatuses.join(", ")}`)
        );
      }

      // Update complaint status - Mongoose handles $set automatically
      const complaint = await ComplaintModel.findByIdAndUpdate(
        complaintId,
        { status: status.toLowerCase() },
        { new: true, runValidators: true }
      );

      if (!complaint) {
        return res.status(404).json(
          failureHandler(404, "Complaint not found")
        );
      }

      // Format response
      const complaintResponse = {
        id: complaint._id,
        title: complaint.title,
        category: complaint.category,
        status: complaint.status,
        priority: complaint.priority,
        description: complaint.description,
        images: complaint.images,
        adminResponse: complaint.adminResponse,
        responseDate: complaint.responseDate,
        residentId: complaint.residentId,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
      };

      return res.json(
        successHandler(200, complaintResponse, "Complaint status updated successfully")
      );
    } catch (error) {
      console.error("Admin status update error:", error);
      return res.status(500).json(
        failureHandler(500, "Failed to update complaint status")
      );
    }
  }
);

module.exports = ResidentRouter;

