const mongoose = require("mongoose");

const IdDocumentType = ["CNIC", "PASSPORT", "DRIVER_LICENSE"];
const OwnershipType = ["owner", "tenant", "rented"];
const ResidentStatus = ["pending", "active", "inactive"];
const ApprovalStatus = ["pending", "approved", "rejected"];

const ResidentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    apartment: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    status: { type: String, enum: ResidentStatus, default: "active" },
    joinDate: { type: Date, default: Date.now },
    familyMembers: { type: Number, default: 1, min: 1 },
    username: { type: String, unique: true, sparse: true },
    password: { type: String, default: null },
    approvalStatus: { type: String, enum: ApprovalStatus, default: "pending" },
    appliedDate: { type: Date, default: Date.now },

    // KYC Information
    cnicNumber: { type: String, default: null },
    passportNumber: { type: String, default: null },
    driverLicenseNumber: { type: String, default: null },
    idDocumentType: { type: String, enum: IdDocumentType, default: "CNIC" },
    ownershipType: { type: String, enum: OwnershipType, default: "OWNER" },
    emergencyContact: { type: String, default: null },
    emergencyContactPhone: { type: String, default: null },
    occupation: { type: String, default: null },
    workAddress: { type: String, default: null },
    profilePhoto: { type: String, default: null }, // Base64 encoded
    monthlyIncome: { type: Number, default: null },
    previousAddress: { type: String, default: null },
    reference1Name: { type: String, default: null },
    reference1Phone: { type: String, default: null },
    reference2Name: { type: String, default: null },
    reference2Phone: { type: String, default: null },
    additionalNotes: { type: String, default: null },
  },
  { 
    timestamps: true, // This creates createdAt and updatedAt automatically
    collection: "residents" // Maps to "residents" collection
  }
);

const ResidentModel = mongoose.model("Resident", ResidentSchema);
module.exports = ResidentModel;

