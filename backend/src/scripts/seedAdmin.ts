import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { env } from "../config/env";
import { User, hashPassword } from "../models/user.model";

async function seedAdmin(): Promise<void> {
  await connectDB();

  const username = env.ADMIN_USERNAME.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  const name = env.ADMIN_NAME.trim();

  if (!username || !password || password.length < 6) {
    console.error(
      "[seed] ADMIN_USERNAME and ADMIN_PASSWORD (min 6 characters) must be set in backend/.env",
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const user = await User.findOneAndUpdate(
    { username },
    { name, role: "admin", status: "active", passwordHash },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(
    `[seed] Administrator ready — username: ${user.username} (role: ${user.role})`,
  );
}

seedAdmin()
  .catch((err) => {
    console.error("[seed] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });