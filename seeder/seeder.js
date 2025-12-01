const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const AdminModel = require("../models/adminn.schema");
const ServiceModel = require("../models/service.schema");
const { SUPER_ADMIN } = require("../utlits/Constants");

dotenv.config();

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Connection error:", err));

async function seed() {
  console.log("🌱 Starting database seeding...");

  try {
    // --- Admin ---
    const adminPassword = await hashPassword("Secret@123");

    await AdminModel.deleteMany();

    const admin = await AdminModel.create({
      username: "SuperAdmin",
      password: adminPassword,
      email: "hafeezatif124@gmail.com",
      name: "SuperAdmin",
      role: SUPER_ADMIN,
      isSuperAdmin: true,
    });

    console.log("✅ Admin created:", admin.username);

    // --- Services ---
    await ServiceModel.deleteMany();

    const services = [
      { name: "Plumbing", description: "Professional plumbing services for homes and businesses" },
      { name: "Electrical", description: "Expert electrical installation and repair services" },
      { name: "Cleaning", description: "Comprehensive cleaning services for residential and commercial spaces" },
      { name: "Carpentry", description: "Skilled carpentry and woodworking services" },
      { name: "Painting", description: "Interior and exterior painting services" },
      { name: "AC/HVAC", description: "Air conditioning and HVAC installation, repair, and maintenance" },
      { name: "Appliance Repair", description: "Professional repair services for home appliances" },
      { name: "Pest Control", description: "Effective pest control and extermination services" },
      { name: "Gardening", description: "Landscaping and gardening services" },
      { name: "Security", description: "Security system installation and maintenance" },
      { name: "Moving/Shifting", description: "Professional moving and relocation services" },
    ];

    const createdServices = await ServiceModel.insertMany(services);
    console.log(`✅ ${createdServices.length} Services created`);

    console.log("🎉 Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
