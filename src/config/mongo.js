const mongoose = require("mongoose");

const connectMongo = async () => {
  try {
    const mongoURI =
      process.env.MONGO_URI || "mongodb://localhost:27017/postloop";

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      family: 4,
    });

    console.log("✅ MongoDB Connected (Activity Logger)");
  } catch (error) {
    console.error("❌ MongoDB Error:", error.message);
  }
};

module.exports = connectMongo;
