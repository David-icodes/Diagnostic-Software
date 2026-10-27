import type {Request} from 'express';
import {env} from '../config/env';
import {ApiError} from './api-error';
export type SessionScope='admin'|'vendor';
export const sessionCookieName=(scope:SessionScope)=>scope==='vendor'?`${env.COOKIE_NAME}_vendor`:env.COOKIE_NAME;
export function requestSession(req:Request) {
 const header=req.headers?.['x-lis-session'];
 if(header!==undefined&&header!=='admin'&&header!=='vendor')throw new ApiError(400,'Invalid session context');
 const scope:SessionScope=header==='vendor'||(!header&&/^\/api\/v1\/vendor-portal(?:\/|$)/i.test(req.originalUrl.split('?')[0]))?'vendor':'admin';
 const name=sessionCookieName(scope),token=req.cookies?.[name];
 return {scope,name,token:typeof token==='string'?token:undefined};
}
