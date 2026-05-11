require("dotenv").config();
const swaggerAutogen = require("swagger-autogen")();

const doc = {
  info: {
    title: "PostLoop API",
    description: "API documentation for PostLoop",
  },
  host: "localhost:8080",
  schemes: ["http"],
  securityDefinitions: {
    BearerAuth: {
      type: "apiKey",
      name: "Authorization",
      in: "header",
      description: "Enter: Bearer <token>",
    },
  },

  security: [
    {
      BearerAuth: [],
    },
  ],
};

const outputFile = "./swagger-output.json";

const endpointsFiles = ["../../app.js"];

swaggerAutogen(outputFile, endpointsFiles, doc);
