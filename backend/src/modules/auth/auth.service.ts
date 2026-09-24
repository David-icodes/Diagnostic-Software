import { User } from "../../models/user.model";
import { verifyPassword } from "../../models/user.model";
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