const swaggerAutogen = require("swagger-autogen")();

const doc = {
  info: { title: "Management API", description: "Auto-generated Swagger docs" },
  host: "localhost:5000", // backend ke port se match kare
  schemes: ["http"],
};

const outputFile = "./swagger/swagger-output.json";
const endpointsFiles = ["./routes/auth.js", "./routes/resident.js"];

swaggerAutogen(outputFile, endpointsFiles).then(() => {
  require("../index.js"); // start server
});
