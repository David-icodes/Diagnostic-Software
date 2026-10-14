import test from "node:test";
import assert from "node:assert/strict";
process.env.MONGODB_URI="mongodb://127.0.0.1/vendor_submission_no_connection";
process.env.JWT_SECRET="synthetic-vendor-submission-secret";
test("submission rejects spoofed client/payment fields and repeated checkpoint never creates another patient",async t=>{
 const [{vendorSubmissionSchema,submitVendorPatient},{VendorSubmission}]=await Promise.all([import("./submission.service.js"),import("../../models/vendor-submission.model.js")]);
 const input={requestKey:"f8f9536f-42a1-4b89-a705-0b5a2b8ea222",patient:{firstName:"Synthetic",age:30,gender:"female",mobile:"0000000000"},order:{items:[{testId:"507f1f77bcf86cd799439011",quantity:1}]}};
 assert.equal(vendorSubmissionSchema.safeParse({...input,clientId:"spoof"}).success,false);assert.equal(vendorSubmissionSchema.safeParse({...input,order:{...input.order,paidAmount:100}}).success,false);
 assert.equal(vendorSubmissionSchema.safeParse({...input,patient:{...input.patient,status:"inactive"}}).success,false);
 assert.equal(vendorSubmissionSchema.safeParse({...input,order:{items:[{...input.order.items[0],out:true,outsideLabId:"507f1f77bcf86cd799439012"}]}}).success,false);
 assert.equal(vendorSubmissionSchema.safeParse({...input,order:{items:[{...input.order.items[0],packageId:input.order.items[0].testId}]}}).success,false);
 t.mock.method(VendorSubmission,"findOne",()=>({exec:async()=>({fingerprint:"other",state:"completed"})}) as any);
 await assert.rejects(submitVendorPatient({id:"507f1f77bcf86cd799439013",role:"vendor",clientId:"507f1f77bcf86cd799439012"} as any,vendorSubmissionSchema.parse(input)),/already used/);
});
test("missing client tariffs fail before creating a checkpoint or patient",async t=>{
 const [{submitVendorPatient,vendorSubmissionSchema},{VendorSubmission},{LabTest},{Department},{LabClientTariff}]=await Promise.all([import("./submission.service.js"),import("../../models/vendor-submission.model.js"),import("../../models/lab-test.model.js"),import("../../models/department.model.js"),import("../../models/lab-client-tariff.model.js")]);
 const chain=(data:unknown)=>({select(){return this;},exec:async()=>data});let writes=0;
 t.mock.method(VendorSubmission,"findOne",()=>chain(null) as any);t.mock.method(VendorSubmission,"create",async()=>{writes++;throw Error("Unexpected write");});t.mock.method(LabTest,"countDocuments",async()=>1);t.mock.method(LabTest,"find",()=>chain([]) as any);t.mock.method(Department,"find",()=>chain([]) as any);t.mock.method(LabClientTariff,"find",()=>chain([]) as any);
 const input=vendorSubmissionSchema.parse({requestKey:"c20d5b6d-5a11-46fb-8f55-7ac768b639aa",patient:{firstName:"Synthetic",age:30,gender:"female",mobile:"0000000000"},order:{items:[{testId:"507f1f77bcf86cd799439011",quantity:1}]}});
 await assert.rejects(submitVendorPatient({id:"507f1f77bcf86cd799439013",role:"vendor",clientId:"507f1f77bcf86cd799439012"} as any,input),/client-specific tariff/);assert.equal(writes,0);
});
