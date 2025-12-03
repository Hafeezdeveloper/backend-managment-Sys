const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const AuthRouter = require("./routes/auth");
const ResidentRouter = require("./routes/resident");
const app = express();
// Load env variables
dotenv.config();

// App setup

app.use(express.json());
app.use(cors({
  origin: '*', // sab origin allow kare
}));

app.use(morgan("dev"));
const swaggerUi = require("swagger-ui-express");
const swaggerFile = require("./swagger/swagger-output.json");
const serviceProviders = require("./routes/service-providers");

// Override host + basePath dynamically
swaggerFile.host = "localhost:5000";
swaggerFile.basePath = "/api/v1/admin";

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Routes (example)
app.get("/", (req, res) => {
    res.send("Server is running successfully 🚀");
});
app.use("/api/v1/admin", AuthRouter);
app.use("/api/v1/admin/resident", ResidentRouter);
app.use("/api/v1/admin/service-providers", serviceProviders);


// Port setup
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
    .then((succ) => {
        app.listen(process.env.PORT, () => {
            console.log("server is start and Mongo is connected")
        })
    })
    .catch((err) => {
        console.log(err)
    })
