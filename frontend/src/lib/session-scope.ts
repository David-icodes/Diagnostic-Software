export type SessionScope="admin"|"vendor";
export function sessionScope(pathname:string):SessionScope {return /^\/vendor(?:-portal|-dashboard|-login)(?:\/|$)/.test(pathname)?"vendor":"admin";}
export function browserSessionHeaders():Record<string,string> {return {"X-LIS-Session":sessionScope(typeof window!=="undefined"?window.location?.pathname??"":"")};}
