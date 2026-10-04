import type { FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { generateClientCode } from "../../utils/id-generator";
import { LabClient, type ILabClient, type LabClientDoc } from "../../models/lab-client.model";

export type CreateClientInput = Omit<ILabClient, "createdAt" | "updatedAt">;
export type UpdateClientInput = Partial<Omit<ILabClient, "createdAt" | "updatedAt">>;

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof Error && (error as { code?: number }).code === 11000;
}

export async function searchClients({
  search,
  limit = 50,
}: {
  search?: string;
  limit?: number;
}): Promise<LabClientDoc[]> {
  const filter: FilterQuery<ILabClient> = {};
  const keyword = search?.trim();
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { clientCode: { $regex: escaped, $options: "i" } },
      { city: { $regex: escaped, $options: "i" } },
    ];
  }
  return LabClient.find(filter).sort({ name: 1 }).limit(limit).exec();
}

export async function getClient(id: string): Promise<LabClientDoc> {
  const client = await LabClient.findById(id).exec();
  if (!client) {
    throw new ApiError(404, "Client not found");
  }
  return client;
}

export async function createClient(
  userId: string,
  input: CreateClientInput,
): Promise<LabClientDoc> {
  const clientCode = await generateClientCode();
  try {
    return await LabClient.create({
      ...input,
      clientCode,
      active: input.active ?? true,
      createdBy: userId,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "A client with this name already exists");
    }
    throw error;
  }
}

export async function updateClient(
  id: string,
  userId: string,
  input: UpdateClientInput,
): Promise<LabClientDoc> {
  const client = await getClient(id);
  try {
    Object.assign(client, input, { updatedBy: userId });
    await client.save();
    return client;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "A client with this name already exists");
    }
    throw error;
  }
}