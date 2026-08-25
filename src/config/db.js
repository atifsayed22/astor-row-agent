import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";


export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // console.log("MongoDB connected");j
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

connectDB();