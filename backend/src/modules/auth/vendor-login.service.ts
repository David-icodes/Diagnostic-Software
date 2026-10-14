import { LabClient } from "../../models/lab-client.model";
import { User, verifyPassword } from "../../models/user.model";
import { ApiError } from "../../utils/api-error";
import { signAuthToken } from "../../utils/jwt";
import type { AuthUser } from "../../types/auth";

export async function authenticateVendor(clientCode: string, clientName: string, password: string) {
  const client = await LabClient.findOne({ clientCode: clientCode.trim(), name: clientName.trim(), active: { $ne: false } }).exec();
  const user = client ? await User.findOne({ role: "vendor", clientId: client._id, status: "active" }).exec() : null;
  if (!user || !await verifyPassword(password, user.passwordHash)) throw new ApiError(401, "Invalid vendor credentials or inactive account");
  return { user: user.toJSON() as unknown as AuthUser, token: signAuthToken({ sub: user.id, username: user.username, role: user.role, sessionVersion: user.sessionVersion ?? 0 }) };
}
