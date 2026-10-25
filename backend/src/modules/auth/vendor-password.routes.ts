import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { User, hashPassword } from "../../models/user.model";
import { asyncHandler } from "../../utils/async-handler";
import { ApiError } from "../../utils/api-error";
import { sendSuccess, sendMessage } from "../../utils/http";
import { recordAudit } from "../audit/audit.service";
import { LabClient } from "../../models/lab-client.model";
import { listLabBills } from "../lab-bills/lab-bill.service";
import { AuditLog } from "../../models/audit-log.model";
const router = Router();
router.use(authenticate, (req,_res,next) => next(req.user?.role === "admin" ? undefined : new ApiError(403,"Administrator access required")));
const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(50).refine(value=>!/[\u0000-\u001f\u007f]/.test(value), "Username cannot contain control characters").transform(value=>value.toLowerCase()),
  password: z.union([z.literal(""),z.string().min(6).max(100)]).optional(),
}).strict();
/** Existing account only. Client/role/ID reassignment is never accepted here. */
router.patch("/clients/:id/credentials", validate(credentialsSchema), asyncHandler(async(req,res)=>{
  if(!Types.ObjectId.isValid(req.params.id))throw new ApiError(404,"Vendor account not found");
  const client=await LabClient.findById(req.params.id).exec();
  if(!client)throw new ApiError(404,"Vendor client not found");
  const account=await User.findOne({clientId:client._id,role:"vendor"}).exec();
  if(!account)throw new ApiError(404,"Vendor account not found");
  const usernameChanged=account.username!==req.body.username;
  const passwordChanged=typeof req.body.password==="string" && req.body.password!=="";
  if(usernameChanged && await User.exists({username:req.body.username,_id:{$ne:account._id}}))throw new ApiError(409,"Username is already in use");
  if(usernameChanged || passwordChanged){
    account.username=req.body.username;
    if(passwordChanged)account.passwordHash=await hashPassword(req.body.password);
    account.sessionVersion=(account.sessionVersion??0)+1;
    try{await account.save();}catch(error){if((error as {code?:number}).code===11000)throw new ApiError(409,"Username is already in use");throw error;}
    await recordAudit({user:req.user!.id,action:"vendor.credentials_updated",entityType:"User",entity:account._id,details:{usernameChanged,passwordChanged}});
  }
  return sendSuccess(res,{id:String(account._id),username:account.username});
}));
router.get("/", asyncHandler(async (_req,res) => sendSuccess(res,await User.find({role:"vendor"}).select("username name clientId status").populate("clientId", "clientCode name active").exec())));
router.get("/clients",asyncHandler(async(_req,res)=>sendSuccess(res,await LabClient.find({}).select("clientCode name active").sort({name:1}).exec())));
router.patch("/clients/:id",validate(z.object({name:z.string().trim().min(2).max(120)}).strict()),asyncHandler(async(req,res)=>{
 if(!Types.ObjectId.isValid(req.params.id))throw new ApiError(404,"Vendor client not found");
 try{
  const client=await LabClient.findByIdAndUpdate(req.params.id,{$set:{name:req.body.name,updatedBy:req.user!.id}},{new:true,runValidators:true}).exec();
  if(!client)throw new ApiError(404,"Vendor client not found");
  await User.updateMany({role:"vendor",clientId:client._id},{$inc:{sessionVersion:1}}).exec();
  await recordAudit({user:req.user!.id,action:"vendor.client_updated",entityType:"LabClient",entity:client._id});
  return sendSuccess(res,{client:client.toJSON()});
 }catch(error){if((error as {code?:number}).code===11000)throw new ApiError(409,"A client with this name already exists");throw error;}
}));
router.get("/:id/submissions",asyncHandler(async(req,res)=>{
 if(!Types.ObjectId.isValid(req.params.id))throw new ApiError(404,"Vendor account not found");
 const user=await User.findOne({_id:req.params.id,role:"vendor"}).select("clientId").exec();
 if(!user?.clientId)throw new ApiError(404,"Vendor account not found");
 const page=Number(req.query.page);
 return sendSuccess(res,await listLabBills({clientId:String(user.clientId),billType:"vendor",page:Number.isFinite(page)?Math.max(1,Math.floor(page)):1,limit:20}));
}));
router.get("/:id/activity",asyncHandler(async(req,res)=>{
 if(!Types.ObjectId.isValid(req.params.id)||!await User.exists({_id:req.params.id,role:"vendor"}))throw new ApiError(404,"Vendor account not found");
 const page=Math.max(1,Math.floor(Number(req.query.page)||1));const filter={user:new Types.ObjectId(req.params.id)};
 const [data,total]=await Promise.all([AuditLog.find(filter).select("action timestamp entityType").sort({timestamp:-1,_id:-1}).skip((page-1)*20).limit(20).exec(),AuditLog.countDocuments(filter)]);
 return sendSuccess(res,{data,pagination:{total,totalPages:Math.max(1,Math.ceil(total/20))}});
}));
const accountSchema = z.object({ username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, underscores or hyphens").transform(value=>value.toLowerCase()).optional(), clientId: z.string().refine(Types.ObjectId.isValid, "Select a valid existing vendor client"), name: z.string().trim().min(1).max(100), status: z.enum(["active", "inactive"]) }).strict();
router.post("/", validate(accountSchema.extend({password:z.string().min(6).max(100)})), asyncHandler(async (req,res) => {
  const client = await LabClient.findById(req.body.clientId).exec();
  if (!client) throw new ApiError(422,"Vendor client not found");
  if (req.body.status === "active" && client.active === false) throw new ApiError(422,"Activate the client before its account");
  if (await User.exists({role:"vendor",clientId:client._id})) throw new ApiError(409,"This vendor client already has an account");
  try {
    const row = await User.create({username:req.body.username ?? `vendor-${String(client._id)}`,name:req.body.name,clientId:client._id,role:"vendor",status:req.body.status,passwordHash:await hashPassword(req.body.password)});
    await recordAudit({user:req.user!.id,action:"vendor.account_created",entityType:"User",entity:row._id});
    return sendSuccess(res,{user:row.toJSON()});
  } catch(error) { if ((error as {code?:number}).code === 11000) throw new ApiError(409,"Username or client association is already in use"); throw error; }
}));
router.patch("/:id", validate(accountSchema), asyncHandler(async (req,res) => {
  if (!Types.ObjectId.isValid(req.params.id)) throw new ApiError(404,"Vendor account not found");
  const client = await LabClient.findById(req.body.clientId).exec();
  if (!client) throw new ApiError(422,"Vendor client not found");
  if (req.body.status === "active" && client.active === false) throw new ApiError(422,"Activate the client before its account");
  const account = await User.findOne({_id:req.params.id,role:"vendor"}).exec();
  if (!account) throw new ApiError(404,"Vendor account not found");
  // Ownership is historical: account edits must not transfer access to another client.
  if (String(account.clientId)!==String(client._id)) throw new ApiError(422,"An existing account cannot be transferred to another vendor client");
  if(req.body.username && req.body.username!==account.username){if(await User.exists({username:req.body.username,_id:{$ne:account._id}}))throw new ApiError(409,"Username is already in use");account.username=req.body.username;}
  account.name=req.body.name; account.status=req.body.status; account.sessionVersion=(account.sessionVersion??0)+1;
  await account.save();
  await recordAudit({user:req.user!.id,action:"vendor.account_updated",entityType:"User",entity:account._id});
  return sendSuccess(res,{user:account.toJSON()});
}));
const schema = z.object({newPassword:z.string().min(6).max(100),confirmPassword:z.string().min(6).max(100)}).strict().refine(v=>v.newPassword===v.confirmPassword,{message:"Passwords must match",path:["confirmPassword"]});
router.post("/:id/password", validate(schema), asyncHandler(async (req,res) => {
  if (!Types.ObjectId.isValid(req.params.id)) throw new ApiError(404,"Vendor account not found");
  const user = await User.findOneAndUpdate({_id:req.params.id,role:"vendor"},{$set:{passwordHash:await hashPassword(req.body.newPassword)},$inc:{sessionVersion:1}},{new:true}).select("_id").exec();
  if (!user) throw new ApiError(404,"Vendor account not found");
  await recordAudit({user:req.user!.id,action:"vendor.password_changed",entityType:"User",entity:user._id});
  return sendMessage(res,"Vendor password changed successfully");
}));
export default router;
