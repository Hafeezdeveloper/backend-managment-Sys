const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema({
  name: { type: String, required: true, },
  email: { type: String, required: true, unique: true, },

  password: {
    type: String,
    required: true,
  },

  img: {
    type: String,
    default: null,
  },

  username: {
    type: String,
    required: true,
    unique: true,
  },

  status: {
    type: Boolean,
    default: true,
  },

  role: {
    type: String,
    default: "ADMIN",
  },
  isSuperAdmin: {
    type: Boolean,
  },
},
  {
    timestamps: true, // automatically adds createdAt & updatedAt
  }
);

const AdminModel = mongoose.model("Admin", AdminSchema);
module.exports = AdminModel;
