import { Types } from "mongoose";
import { z } from "zod";
import { LabClient } from "../../models/lab-client.model";
import { User, hashPassword } from "../../models/user.model";
import { ApiError } from "../../utils/api-error";
import { recordAudit } from "../audit/audit.service";

type Actor = { id: string; role: string };
export const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(50).refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Username cannot contain control characters").transform(value => value.toLowerCase()),
  password: z.union([z.literal(""), z.string().min(6).max(100)]).optional(),
}).strict();
function authorize(actor: Actor, id: string) {
  if (actor.role !== "admin") throw new ApiError(403, "Administrator access required");
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "Vendor client not found");
}

/** Explicit administrator setup only; listing a client never creates an account. */
export async function configureVendorCredentials(id: string, actor: Actor, raw: unknown) {
  authorize(actor, id);
  const input = credentialsSchema.parse(raw);
  const client = await LabClient.findById(id).exec();
  if (!client) throw new ApiError(404, "Vendor client not found");
  const account = await User.findOne({ clientId: client._id, role: "vendor" }).exec();
  try {
    if (!account) {
      if (client.active === false) throw new ApiError(422, "Activate the client before configuring its login");
      if (!input.password) throw new ApiError(422, "An initial password is required for this client");
      if (await User.exists({ username: input.username })) throw new ApiError(409, "Username is already in use");
      const created = await User.create({ username: input.username, name: client.name.slice(0, 100), clientId: client._id,
        role: "vendor", status: "active", passwordHash: await hashPassword(input.password) });
      await recordAudit({ user: actor.id, action: "vendor.account_created", entityType: "User", entity: created._id });
      return { id: String(created._id), username: created.username };
    }
    const usernameChanged = account.username !== input.username;
    const passwordChanged = Boolean(input.password);
    if (usernameChanged && await User.exists({ username: input.username, _id: { $ne: account._id } })) throw new ApiError(409, "Username is already in use");
    if (usernameChanged || passwordChanged) {
      account.username = input.username;
      if (input.password) account.passwordHash = await hashPassword(input.password);
      account.sessionVersion = (account.sessionVersion ?? 0) + 1;
      await account.save();
      await recordAudit({ user: actor.id, action: "vendor.credentials_updated", entityType: "User", entity: account._id,
        details: { usernameChanged, passwordChanged } });
    }
    return { id: String(account._id), username: account.username };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new ApiError(409, "Username or client association is already in use");
    throw error;
  }
}

/** Remove from active selection without deleting bills, tariffs or ownership links. */
export async function deactivateVendorClient(id: string, actor: Actor) {
  authorize(actor, id);
  const client = await LabClient.findById(id).exec();
  if (!client) throw new ApiError(404, "Vendor client not found");
  await User.updateMany({ clientId: client._id, role: "vendor" }, { $set: { status: "inactive" }, $inc: { sessionVersion: 1 } }).exec();
  client.active = false;
  client.set("updatedBy", actor.id);
  await client.save();
  await recordAudit({ user: actor.id, action: "vendor.client_deactivated", entityType: "LabClient", entity: client._id });
  return { id: String(client._id), active: false };
}
