const mongoose = require("mongoose");

const connectMongo = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/postloop",
    );
    console.log("MongoDB Connected (Activity Logger)");
  } catch (error) {
    console.error("MongoDB Error:", error.message);
  }
};

module.exports = connectMongo;
