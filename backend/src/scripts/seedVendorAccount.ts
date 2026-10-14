import "dotenv/config";
import mongoose from "mongoose";
import { User, hashPassword } from "../models/user.model";
import { LabClient } from "../models/lab-client.model";
import { connectDB } from "../config/db";

/** Insert-only; run only after the owner confirms the client ID and sets a local password. */
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri || new URL(uri).pathname !== "/diagnostic_lis_development_20261012" || process.env.NODE_ENV === "production") throw new Error("Expected development database required");
  const clientId = process.env.VENDOR_CLIENT_ID;
  const password = process.env.VENDOR_INITIAL_PASSWORD;
  if (!clientId || !mongoose.isValidObjectId(clientId) || !password || password.length < 6) throw new Error("Confirmed VENDOR_CLIENT_ID and secure VENDOR_INITIAL_PASSWORD required");
  await connectDB();
  if (mongoose.connection.name !== "diagnostic_lis_development_20261012") throw new Error("Runtime database mismatch");
  if (!await LabClient.exists({_id:clientId,active:{$ne:false}})) throw new Error("Active confirmed client required");
  const existing = await User.findOne({username:"anjali"});
  if (existing) {
    if (existing.role !== "vendor" || String(existing.clientId) !== clientId) throw new Error("Existing account differs; no overwrite permitted");
    console.log("Vendor account already exists; unchanged"); return;
  }
  await User.create({username:"Anjali",name:"Anjali",role:"vendor",status:"active",clientId,passwordHash:await hashPassword(password)});
  console.log("Vendor account created");
}
void main().catch(() => {console.error("Vendor setup failed; verify approved client, development database and local configuration");process.exitCode=1;}).finally(()=>mongoose.disconnect());
