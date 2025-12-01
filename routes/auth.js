const express = require("express");
const AdminModel = require("../models/adminn.schema");
const { handleFailure, failureHandler, successHandler } = require("../utlits/helper/helper");
const jwt = require('jsonwebtoken');
const AuthRouter = express.Router();
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const ServiceProviderModel = require("../models/serviceProvider.schema");

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
      return res.status(401).json(failureHandler(401, "Username or password is incorrect"));
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
      { id: newServiceProvider._id, email: newServiceProvider.email, username: newServiceProvider.username, name: newServiceProvider.name },
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

module.exports = AuthRouter;
