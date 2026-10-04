import { User } from "../../models/user.model";
import { hashPassword, verifyPassword } from "../../models/user.model";
import { ApiError } from "../../utils/api-error";
import { signAuthToken } from "../../utils/jwt";
import type { AuthUser } from "../../types/auth";

export interface LoginResult {
  user: AuthUser;
  token: string;
}

/**
 * Authenticates a username/password pair.
 *
 * TEMPORARY DIAGNOSTIC LOGGING (safe) — the `[auth]` lines below were added to
 * pinpoint why production returns 401. They log only the username, an existence
 * flag, the active flag, the role and a password-match boolean. They never log
 * the submitted password, the stored hash, the JWT, cookies or any other secret.
 * Remove the `[auth]` lines once the 401 is diagnosed.
 */
export async function authenticateUser(
  username: string,
  password: string,
): Promise<LoginResult> {
  const normalizedUsername = username.toLowerCase();
  console.log(`[auth] login attempt username=${normalizedUsername}`);

  const user = await User.findOne({ username: normalizedUsername });
  console.log(`[auth] user found=${Boolean(user)}`);

  if (!user) {
    console.warn(
      `[auth] login rejected: user not found (username=${normalizedUsername})`,
    );
    throw new ApiError(401, "Invalid username or password");
  }

  console.log(
    `[auth] user active=${user.status === "active"} role=${user.role}`,
  );

  if (user.status !== "active") {
    throw new ApiError(
      403,
      "Your account is not active. Contact the administrator.",
    );
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  console.log(`[auth] password match=${passwordMatches}`);

  if (!passwordMatches) {
    console.warn(
      `[auth] login rejected: password mismatch (username=${normalizedUsername})`,
    );
    throw new ApiError(401, "Invalid username or password");
  }

  console.log(`[auth] login accepted username=${normalizedUsername}`);

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