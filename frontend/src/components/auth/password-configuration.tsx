"use client";
import {useState} from "react";
import {ChangePasswordForm} from "./change-password-form";
import {VendorPasswordSettings} from "./vendor-password-settings";
import {useAuth} from "@/hooks/use-auth";
import {Button} from "@/components/ui/button";

export function PasswordConfiguration(){
 const {user}=useAuth();const [mode,setMode]=useState<"admin"|"vendor">("admin");
 if(user?.role!=="admin")return <ChangePasswordForm/>;
 return <div className="space-y-4"><div className="flex flex-wrap gap-2" role="group" aria-label="Password configuration">
  <Button aria-pressed={mode==="admin"} variant={mode==="admin"?"default":"outline"} onClick={()=>setMode("admin")}>Admin Password Configuration</Button>
  <Button aria-pressed={mode==="vendor"} variant={mode==="vendor"?"default":"outline"} onClick={()=>setMode("vendor")}>Vendor Password Configuration</Button>
 </div>{mode==="admin"?<ChangePasswordForm/>:<VendorPasswordSettings/>}</div>;
}
