const mongoose = require("mongoose");

const IdDocumentType = ["CNIC", "PASSPORT", "DRIVER_LICENSE"];
const ServiceProviderStatus = ["pending", "approved", "rejected"];

const ServiceProviderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },

    // KYC
    idDocumentType: { type: String, enum: IdDocumentType, default: "CNIC" },
    cnicNumber: { type: String, default: null },
    passportNumber: { type: String, default: null },
    driverLicenseNumber: { type: String, default: null },

    // Service Info
    serviceCategory: { type: String, required: true },
    keywords: { type: String, required: true },
    shortIntro: { type: String, required: true },
    experience: { type: String, required: true },
    previousWork: { type: String, required: true },
    certifications: { type: String, required: true },
    availability: { type: String, required: true },
    serviceArea: { type: String, required: true },
    profilePhoto: { type: String, default: null },
    additionalNotes: { type: String, required: true },

    // Stats
    registrationDate: { type: Date, default: Date.now },
    status: { type: String, enum: ServiceProviderStatus, default: "pending" },
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },

    // Relations
    vehicles: [{ type: mongoose.Schema.Types.ObjectId, ref: "ServiceProviderVehicle" }],
    serviceBookings: [{ type: mongoose.Schema.Types.ObjectId, ref: "ServiceBooking" }],
    serviceReviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "ServiceReview" }],
  },
  { timestamps: true }
);
const ServiceProviderModel = mongoose.model("ServiceProvider", ServiceProviderSchema);
module.exports = ServiceProviderModel;