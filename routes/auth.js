const express = require("express");
const AdminModel = require("../models/adminn.schema");
const { handleFailure, failureHandler, successHandler } = require("../utlits/helper/helper");
const jwt = require('jsonwebtoken');
const AuthRouter = express.Router();
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const ServiceProviderModel = require("../models/serviceProvider.schema");
const ResidentModel = require("../models/resident.schema");
const { RoleEnum } = require("../utlits/Constants");

dotenv.config();

AuthRouter.post("/login", async (req, res) => {
  try {
    console.log(req.body);

    const { username, password } = req.body;

    const admin = await AdminModel.findOne({
      username,
      isSuperAdmin: true,
    });

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json(failureHandler(401, "Username or password is incorrec t"));
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email, username: admin.username },
      process.env.SECURE_KEY,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: admin._id,
        username: admin.username,
        email: admin.email,
        name: admin.name,
        isSuperAdmin: true,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(400).json(failureHandler(400, error.message || "Invalid input"));
  }
});

AuthRouter.post("/service-provider/register", async (req, res) => {
  try {


    const { email, password } = req.body;
    console.log(req.body);
    const serviceProvider = await ServiceProviderModel.findOne({
      email,
    });
    if (serviceProvider) {
      return res
        .status(400)
        .json(failureHandler(400, "Service Provider with this email already exists"));
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("hashedPassword", hashedPassword);
    let newServiceProvider = new ServiceProviderModel({
      ...req.body,
      password: hashedPassword,
      status: "pending" // default PENDING ko override kar diya

    });
    await newServiceProvider.save();

    const token = jwt.sign(
      {
        id: newServiceProvider._id, email: newServiceProvider.email,
        username: newServiceProvider.username, name: newServiceProvider.name, role: RoleEnum.SERVICE_PROVIDER
      },
      process.env.SECURE_KEY,
      { expiresIn: "7d" }
    );



    return res.status(201).json(
      successHandler(
        201,
        {
          token,
          user: {
            _id: newServiceProvider._id,
            username: newServiceProvider.username,
            email: newServiceProvider.email,
            name: newServiceProvider.name,
            status: newServiceProvider.status,
          },
        },
        "Service Provider registered successfully"
      )
    );
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(400).json(failureHandler(400, error.message || "Invalid input"));
  }
});

// Service Provider login
AuthRouter.post("/service-provider/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Service Provider login attempt:", email);

    const serviceProvider = await ServiceProviderModel.findOne({
      email,
    });

    if (
      !serviceProvider ||
      !(await bcrypt.compare(password, serviceProvider.password))
    ) {
      return res.status(401).json(
        failureHandler(401, "Email or password is incorrect")
      );
    }

    if (serviceProvider.status !== "approved") {
      return res.status(403).json(
        failureHandler(403, "Your account is not active or pending approval")
      );
    }

    const token = jwt.sign(
      {
        id: serviceProvider._id,
        email: serviceProvider.email,
        username: serviceProvider.username,
        name: serviceProvider.name,
        type: "serviceProvider",
      },
      process.env.SECURE_KEY,
      { expiresIn: "7d" }
    );

    return res.json(
      successHandler(200, {
        token,
        user: {
          _id: serviceProvider._id,
          username: serviceProvider.username,
          email: serviceProvider.email,
          name: serviceProvider.name,
          status: serviceProvider.status,
          serviceCategory: serviceProvider.serviceCategory,
          phone: serviceProvider.phone,
          role: RoleEnum.SERVICE_PROVIDER,
        },
      }, "Login successful")
    );
  } catch (error) {
    console.error("Service provider login error:", error);
    return res.status(400).json(
      failureHandler(400, error.message || "Invalid input")
    );
  }
});

// Resident registration
AuthRouter.post("/resident/register", async (req, res) => {
  try {
    const { email, apartment, username, password } = req.body;
    console.log("Resident registration attempt:", email);

    // Check if email, apartment, or username already exists
    const existingResident = await ResidentModel.findOne({
      $or: [
        { email },
        { apartment },
        ...(username ? [{ username }] : []),
      ],
    });

    if (existingResident) {
      let message = "Resident already exists";
      if (existingResident.email === email) {
        message = "Email is already registered";
      } else if (existingResident.apartment === apartment) {
        message = "Apartment is already registered";
      } else if (username && existingResident.username === username) {
        message = "Username is already taken";
      }

      return res.status(400).json(
        failureHandler(400, message)
      );
    }

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Create resident
    const newResident = new ResidentModel({
      ...req.body,
      password: hashedPassword,
      approvalStatus: "PENDING",
      status: "Pending",
    });

    await newResident.save();

    return res.status(201).json(
      successHandler(
        201,
        {
          resident: {
            _id: newResident._id,
            name: newResident.name,
            email: newResident.email,
            apartment: newResident.apartment,
            status: newResident.status,
            approvalStatus: newResident.approvalStatus,
            role: RoleEnum.RESIDENT,
          },
        },
        "Registration successful"
      )
    );
  } catch (error) {
    console.error("Resident registration error:", error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json(
        failureHandler(400, `${field.charAt(0).toUpperCase() + field.slice(1)} is already registered`)
      );
    }

    return res.status(400).json(
      failureHandler(400, error.message || "Invalid input")
    );
  }
});

// Resident login
AuthRouter.post("/resident/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Resident login attempt:", email);

    const resident = await ResidentModel.findOne({
      email,
    });

    if (
      !resident ||
      !resident.password ||
      !(await bcrypt.compare(password, resident.password))
    ) {
      return res.status(401).json(
        failureHandler(401, "Email or password is incorrect")
      );
    }

    console.log("Resident status:", resident.status);

    if (resident.status !== "active") {
      return res.status(403).json(
        failureHandler(403, "Your account is not active")
      );
    }

    if (resident.approvalStatus !== "approved") {
      return res.status(403).json(
        failureHandler(403, "Your account is pending approval")
      );
    }

    const token = jwt.sign(
      {
        id: resident._id,
        type: "resident",
        email: resident.email,
      },
      process.env.SECURE_KEY,
      { expiresIn: "7d" }
    );

    return res.json(
      successHandler(200, {
        token,
        user: {
          _id: resident._id,
          name: resident.name,
          email: resident.email,
          apartment: resident.apartment,
          phone: resident.phone,
          username: resident.username,
          status: resident.status,
          approvalStatus: resident.approvalStatus,
          role: RoleEnum.RESIDENT,
        },
      }, "Login successful")
    );
  } catch (error) {
    console.error("Resident login error:", error);
    return res.status(400).json(
      failureHandler(400, error.message || "Invalid input")
    );
  }
});

module.exports = AuthRouter;
