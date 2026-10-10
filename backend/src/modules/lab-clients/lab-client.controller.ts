import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  createClient as createClientService,
  getClient as getClientService,
  searchClients as searchClientsService,
  updateClient as updateClientService,
} from "./lab-client.service";
import type {
  CreateClientInput,
  UpdateClientInput,
} from "./lab-client.service";

export const searchClients = asyncHandler(async (req: Request, res: Response) => {
  const clients = await searchClientsService({
    search: typeof req.query.search === "string" ? req.query.search : undefined,
  });
  return sendSuccess(res, clients);
});

export const getClient = asyncHandler(async (req: Request, res: Response) => {
  const client = await getClientService(req.params.id);
  return sendSuccess(res, { client });
});

export const createClient = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const client = await createClientService(userId, req.body as CreateClientInput);
  return res.status(201).json({
    success: true,
    message: "Client created successfully",
    data: { client },
  });
});

export const updateClient = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const client = await updateClientService(req.params.id, userId, req.body as UpdateClientInput);
  return sendSuccess(res, { client });
});