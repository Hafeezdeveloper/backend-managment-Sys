const express = require("express");
const MaintenanceBillModel = require("../models/maintenanceBill.schema");
const ResidentModel = require("../models/resident.schema");
const {
  authenticateToken,
  adminOnly,
  adminOrResident,
} = require("../middlewear/verifycommonMiddlewaer");
const { successHandler, failureHandler } = require("../utlits/helper/helper");

const maintenanceRouter = express.Router();

// GET /api/v1/admin/maintenance
// Bills listing with search + status filter working together
maintenanceRouter.get(
  "/",
  authenticateToken,
  async (req, res) => {
    try {
      // Pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Filters
      const search = req.query.search || "";
      const status = req.query.status;
      const sort = req.query.sort || "createdAt";
      const order = req.query.order === "asc" ? 1 : -1;

      // Base query (AND conditions)
      const query = {};

      // Resident sirf apni bills dekh sakta hai
      if (req.user.type === "resident") {
        query.residentId = req.user.id;
      }

      // Status filter (AND with search)
      if (status) {
        query.status = status;
      }

      // Search filter (month / year / resident name or apartment)
      if (search) {
        const orConditions = [];

        // Month (string) search
        orConditions.push({
          month: { $regex: search, $options: "i" },
        });

        // Year (numeric) search
        const searchNumber = Number(search);
        if (!Number.isNaN(searchNumber)) {
          orConditions.push({ year: searchNumber });
        }

        // Resident name / apartment / email / phone search
        const matchingResidents = await ResidentModel.find({
          $or: [
            { name: { $regex: search, $options: "i" } },
            { apartment: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        })
          .select("_id")
          .lean();

        if (matchingResidents.length > 0) {
          orConditions.push({
            residentId: { $in: matchingResidents.map((r) => r._id) },
          });
        }

        // Sirf tab add karo jab kuch conditions hon
        if (orConditions.length > 0) {
          query.$or = orConditions;
        }
      }

      // Sort object
      const sortObj = {};
      sortObj[sort] = order;

      // Fetch bills + count
      const [bills, total] = await Promise.all([
        MaintenanceBillModel.find(query)
          .populate({
            path: "residentId",
            select: "name apartment phone email",
          })
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        MaintenanceBillModel.countDocuments(query),
      ]);

      return res.json(
        successHandler(
          200,
          {
            bills,
            pagination: {
              page,
              limit,
              total,
              pages: Math.ceil(total / limit),
            },
          },
          "Maintenance bills fetched successfully"
        )
      );
    } catch (error) {
      console.error("Get maintenance bills error:", error);
      return res.status(500).json(
        failureHandler(500, "Failed to fetch bills")
      );
    }
  }
);

maintenanceRouter.post(
  "/generate",
  authenticateToken,
  adminOnly,
  async (req, res) => {
    try {
      const { residentIds, billData } = req.body;

      // Validate required fields
      if (!billData) {
        return res.status(400).json(
          failureHandler(400, "Bill data is required")
        );
      }

      const { month, year, amount, dueDate, items } = billData;

      if (!month || !year || amount === undefined || !dueDate || !items || !Array.isArray(items)) {
        return res.status(400).json(
          failureHandler(400, "Missing required fields: month, year, amount, dueDate, and items are required")
        );
      }

      // Validate items
      if (items.length === 0) {
        return res.status(400).json(
          failureHandler(400, "At least one bill item is required")
        );
      }

      for (const item of items) {
        if (!item.description || item.amount === undefined) {
          return res.status(400).json(
            failureHandler(400, "Each item must have description and amount")
          );
        }
        if (item.amount < 0) {
          return res.status(400).json(
            failureHandler(400, "Item amount cannot be negative")
          );
        }
      }

      // Validate amount
      if (amount < 0) {
        return res.status(400).json(
          failureHandler(400, "Bill amount cannot be negative")
        );
      }

      // Validate dueDate
      const dueDateObj = new Date(dueDate);
      if (isNaN(dueDateObj.getTime())) {
        return res.status(400).json(
          failureHandler(400, "Invalid due date format")
        );
      }

      // Get residents to generate bills for
      let residents;
      if (residentIds && Array.isArray(residentIds) && residentIds.length > 0) {
        residents = await ResidentModel.find({
          _id: { $in: residentIds },
          status: "active",
          approvalStatus: "approved",
        })
          .select("_id name apartment")
          .lean();
      } else {
        // Generate for all active residents
        residents = await ResidentModel.find({
          status: "active",
          approvalStatus: "approved",
        })
          .select("_id name apartment")
          .lean();
      }

      if (residents.length === 0) {
        return res.status(400).json(
          failureHandler(400, "No active residents found to generate bills for")
        );
      }

      // Check for existing bills for the same month/year
      const existingBills = await MaintenanceBillModel.find({
        residentId: { $in: residents.map((r) => r._id) },
        month: month,
        year: year,
      })
        .select("residentId")
        .lean();

      const existingResidentIds = existingBills.map((b) => b.residentId.toString());
      const newResidents = residents.filter(
        (r) => !existingResidentIds.includes(r._id.toString())
      );

      if (newResidents.length === 0) {
        return res.status(400).json(
          failureHandler(400, `Bills for ${month} ${year} already exist for all selected residents`)
        );
      }

      // Create bills with items
      const bills = await Promise.all(
        newResidents.map(async (resident) => {
          const bill = await MaintenanceBillModel.create({
            residentId: resident._id,
            month: month,
            year: year,
            amount: amount,
            dueDate: dueDateObj,
            status: "pending",
            items: items,
          });

          // Populate resident info
          const populatedBill = await MaintenanceBillModel.findById(bill._id)
            .populate("residentId", "name apartment")
            .lean();

          // Format response to match expected structure
          return {
            id: populatedBill._id,
            residentId: populatedBill.residentId._id || populatedBill.residentId,
            month: populatedBill.month,
            year: populatedBill.year,
            amount: populatedBill.amount,
            dueDate: populatedBill.dueDate,
            status: populatedBill.status,
            generatedDate: populatedBill.generatedDate,
            paidDate: populatedBill.paidDate,
            createdAt: populatedBill.createdAt,
            updatedAt: populatedBill.updatedAt,
            resident: {
              id: populatedBill.residentId._id || populatedBill.residentId,
              name: populatedBill.residentId.name || resident.name,
              apartment: populatedBill.residentId.apartment || resident.apartment,
            },
            items: populatedBill.items,
          };
        })
      );

      return res.status(201).json(
        successHandler(201, {
          bills,
          skipped: existingResidentIds.length,
        }, `Successfully generated ${bills.length} maintenance bills`)
      );
    } catch (error) {
      console.error("Generate bills error:", error);
      return res.status(400).json(
        failureHandler(400, error.message || "Failed to generate bills")
      );
    }
  }
);

// Update bill status (Admin only) – schema ke mutabiq, Prisma waale flow jaisa
maintenanceRouter.put(
  "/:id/status",
  authenticateToken,
  adminOnly,
  async (req, res) => {
    try {
      const billId = req.params.id;
      const { status, paidDate } = req.body;
      console.log("status", status, "paidDate", billId);
      const bill = await MaintenanceBillModel.findById(billId);

      if (!bill) {
        return res.status(404).json({
          error: "Bill not found",
          message: "Maintenance bill does not exist",
        });
      }

      // Allowed statuses according to schema enum
      const allowedStatuses = ["pending", "paid", "overdue", "cancelled"];
      const updateData = {};

      if (status) {
        if (!allowedStatuses.includes(status)) {
          return res.status(400).json({
            error: "Invalid status",
            message: `Status must be one of: ${allowedStatuses.join(", ")}`,
          });
        }
        updateData.status = status;
        if (status === "paid") {
          updateData.paidDate = new Date();
        }
      }

      if (paidDate) {
        const paidDateObj = new Date(paidDate);
        if (Number.isNaN(paidDateObj.getTime())) {
          return res.status(400).json({
            error: "Invalid paidDate",
            message: "Invalid paidDate format",
          });
        }
        updateData.paidDate = paidDateObj;
      }

      const updatedBill = await MaintenanceBillModel.findByIdAndUpdate(
        billId,
        updateData,
        { new: true }
      )
        .populate("residentId", "name apartment")
        .lean();

      return res.json({
        message: "Bill status updated successfully",
        bill: updatedBill,
      });
    } catch (error) {
      console.error("Update bill status error:", error);
      return res.status(400).json({
        error: "Failed to update bill status",
        message: error instanceof Error ? error.message : "Invalid input",
      });
    }
  }
);

// Mark bill as paid (Resident can request, Admin confirms)
maintenanceRouter.put(
  "/:id/mark-paid",
  authenticateToken,
  adminOrResident,
  async (req, res) => {
    try {
      const billId = req.params.id;

      const bill = await MaintenanceBillModel.findById(billId)
        .populate("residentId", "name apartment")
        .lean();

      if (!bill) {
        return res.status(404).json(
          failureHandler(404, "Maintenance bill does not exist")
        );
      }

      // Check if resident can mark this bill
      if (
        req.user.type === "resident" &&
        bill.residentId.toString() !== req.user.id
      ) {
        return res.status(403).json(
          failureHandler(
            403,
            "You can only mark your own bills as paid"
          )
        );
      }

      if (bill.status === "PAID") {
        return res.status(400).json(
          failureHandler(
            400,
            "This bill has already been marked as paid"
          )
        );
      }

      const updateData = {};
      let message;

      if (req.user.type === "admin") {
        updateData.status = "PAID";
        updateData.paidDate = new Date();
        message = "Bill marked as paid successfully";
      } else {
        // For residents, treat this as a payment notification
        message =
          "Payment notification sent to admin. Bill will be marked as paid once verified.";
      }

      let updatedBill = bill;

      if (Object.keys(updateData).length > 0) {
        updatedBill = await MaintenanceBillModel.findByIdAndUpdate(
          billId,
          updateData,
          { new: true }
        )
          .populate("residentId", "name apartment")
          .lean();
      }

      return res.json(
        successHandler(
          200,
          {
            bill: {
              id: updatedBill._id,
              month: updatedBill.month,
              year: updatedBill.year,
              amount: updatedBill.amount,
              status: updatedBill.status,
              resident: updatedBill.residentId,
            },
          },
          message
        )
      );
    } catch (error) {
      console.error("Mark bill as paid error:", error);
      return res.status(500).json(
        failureHandler(
          500,
          "Failed to process payment"
        )
      );
    }
  }
);

maintenanceRouter.get(
  "/resident/:residentId",
  authenticateToken,
  async (req, res) => {
    try {
      const residentId = parseInt(req.params.residentId);

      // Check if resident can access these bills
     

      const bills = await MaintenanceBillModel.find({
        where: { residentId },
        include: {
          items: true,
          resident: {
            select: { name: true, apartment: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Calculate statistics
      const totalOutstanding = bills
        .filter((b) => b.status === "pending")
        .reduce((sum, bill) => sum + bill.amount, 0);

      const overdueBills = bills.filter(
        (b) => b.status === "pending" && new Date(b.dueDate) < new Date(),
      );

      const paidThisMonth = bills.filter((b) => {
        if (b.status !== "paid" || !b.paidDate) return false;
        const paidDate = new Date(b.paidDate);
        const now = new Date();
        return (
          paidDate.getMonth() === now.getMonth() &&
          paidDate.getFullYear() === now.getFullYear()
        );
      });
      return res.json(successHandler(200,
        {
          bills,
          statistics: { totalOutstanding, overdueBills: overdueBills.length, paidThisMonth: paidThisMonth.length, totalBills: bills.length },
        }, "Bills fetched successfully"));
    } catch (error) {
      console.error("Get resident bills error:", error);
      return res.status(500).json(failureHandler(500, "Failed to fetch bills"));
    }
  }
);

module.exports = maintenanceRouter;
