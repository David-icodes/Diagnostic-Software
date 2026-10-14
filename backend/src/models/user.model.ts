import bcrypt from "bcryptjs";
import { model, Schema, type HydratedDocument } from "mongoose";

export type UserRole = "admin" | "staff" | "operator" | "vendor";
export type UserStatus = "active" | "inactive" | "suspended";

export interface IUser {
  username: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  clientId?: Schema.Types.ObjectId;
  sessionVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 50,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    role: {
      type: String,
      enum: ["admin", "staff", "operator", "vendor"],
      default: "staff",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc: unknown, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

userSchema.add({
  clientId: { type: Schema.Types.ObjectId, ref: "LabClient", required: function () { return this.role === "vendor"; } },
  sessionVersion: { type: Number, default: 0, min: 0 },
});

export type UserDoc = HydratedDocument<IUser>;
userSchema.index({ clientId: 1 }, { unique: true, partialFilterExpression: { role: "vendor" } });

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, 10);
}

export function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

export const User = model<IUser>("User", userSchema);
