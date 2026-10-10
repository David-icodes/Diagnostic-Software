import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";
import { ApiError } from "../utils/api-error";

export function cloudinarySettings(config: {
  CLOUDINARY_CLOUD_NAME: string; CLOUDINARY_API_KEY: string; CLOUDINARY_API_SECRET: string;
}) {
  const values = [config.CLOUDINARY_CLOUD_NAME, config.CLOUDINARY_API_KEY, config.CLOUDINARY_API_SECRET];
  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value) || !/^[a-zA-Z0-9_-]+$/.test(config.CLOUDINARY_CLOUD_NAME)) {
    throw new ApiError(503, "PDF storage configuration is incomplete or invalid. Configure all three CLOUDINARY settings.");
  }
  return { cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET, secure: true };
}

export function configuredCloudinary() {
  const settings = cloudinarySettings(env);
  if (!settings) return null;
  cloudinary.config(settings);
  return { client: cloudinary, cloudName: settings.cloud_name };
}
