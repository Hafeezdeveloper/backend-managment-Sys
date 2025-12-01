const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const AdminModel = require("../models/adminn.schema");
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

    console.log("🎉 Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
