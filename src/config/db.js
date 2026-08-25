import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";


export async function connectDB() {
  try {
    await mongoose.connect("mongodb+srv://sayedatif4321_db_user:opsmind@cluster0.qse6bvv.mongodb.net/?appName=Cluster0");

    // console.log("MongoDB connected");j
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

connectDB();