const mongoose = require("mongoose");

const BillStatus = ["pending", "paid", "overdue", "cancelled"]; 

const BillItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const MaintenanceBillSchema = new mongoose.Schema(
  {
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:"Resident",
      required: true,
    },
    month: { type: String, required: true },
    year: { type: Number, required: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: BillStatus, default: "pending" },
    generatedDate: { type: Date, default: Date.now }, 
    paidDate: { type: Date, default: null },
    items: [BillItemSchema],
  },
  {
    timestamps: true,
    collection: "maintenance_bills",
  }
);

// Index for efficient queries
MaintenanceBillSchema.index({ residentId: 1, month: 1, year: 1 });
MaintenanceBillSchema.index({ status: 1 });

const MaintenanceBillModel = mongoose.model("MaintenanceBill", MaintenanceBillSchema);
module.exports = MaintenanceBillModel;

