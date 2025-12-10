const mongoose = require("mongoose");

const ComplaintStatus = ["open", "in_progress", "resolved", "closed"];
const Priority = ["low", "medium", "high", "urgent"];

const ComplaintSchema = new mongoose.Schema(
  {
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resident",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ComplaintStatus,
      default: "open",
    },
    priority: {
      type: String,
      enum: Priority,
      default: "medium",
    },
    description: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    adminResponse: {
      type: String,
      default: null,
    },
    responseDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // This creates createdAt and updatedAt automatically
  }
);

const ComplaintModel = mongoose.model("Complaint", ComplaintSchema);
module.exports = ComplaintModel;

