import { User } from "../../models/user.model";
import { hashPassword, verifyPassword } from "../../models/user.model";
import { ApiError } from "../../utils/api-error";
import { signAuthToken } from "../../utils/jwt";
import type { AuthUser } from "../../types/auth";

export interface LoginResult {
  user: AuthUser;
  token: string;
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<LoginResult> {
  const user = await User.findOne({ username: username.toLowerCase() });

  if (!user) {
    throw new ApiError(401, "Invalid username or password");
  }

  if (user.status !== "active") {
    throw new ApiError(
      403,
      "Your account is not active. Contact the administrator.",
    );
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, "Invalid username or password");
  }

  const token = signAuthToken({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  return {
    user: user.toJSON() as unknown as AuthUser,
    token,
  };
}

/**
 * Changes the signed-in user's own password after verifying the current one.
 *
 * The stored value is only ever a bcrypt hash; the plain current/new passwords
 * are never persisted or logged. Reusing the current password is refused.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const currentMatches = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentMatches) {
    throw new ApiError(422, "Current password is incorrect");
  }

  if (currentPassword === newPassword) {
    throw new ApiError(422, "New password must be different from the current password");
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
}