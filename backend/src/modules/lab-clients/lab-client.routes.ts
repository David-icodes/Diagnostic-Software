import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import {
  createClientSchema,
  updateClientSchema,
} from "../../validations/lab-client";
import {
  createClient,
  getClient,
  searchClients,
  updateClient,
} from "./lab-client.controller";

const router = Router();

router.use(authenticate);

router.get("/", searchClients);
router.post("/", validate(createClientSchema), createClient);
router.get("/:id", getClient);
router.put("/:id", validate(updateClientSchema), updateClient);

export default router;