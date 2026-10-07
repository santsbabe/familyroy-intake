import type { Config } from "@netlify/functions";
import { getDeployStore, getStore } from "@netlify/blobs";
import crypto from "node:crypto";

function storeForEnvironment(){
  const production=Netlify.context?.deploy?.context==="production";
  return production?getStore("familyroy-oauth",{consistency:"strong"}):getDeployStore("familyroy-oauth");
}
function b64url(buf:Buffer){return buf.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}

export default async(req:Request)=>{
  if(req.method!=="GET")return new Response("Method Not Allowed",{status:405,headers:{Allow:"GET"}});
  const clientId=process.env.CANVA_CLIENT_ID;
  if(!clientId)return Response.json({ok:false,error:"missing_canva_client_id"},{status:503});
  const url=new URL(req.url);
  const redirectUri=url.origin+"/canva/oauth/callback";
  const state=b64url(crypto.randomBytes(24));
  const verifier=b64url(crypto.randomBytes(48));
  const challenge=b64url(crypto.createHash("sha256").update(verifier).digest());
  const store=storeForEnvironment();
  await store.setJSON("oauth/state/"+state+".json",{verifier,redirect_uri:redirectUri,created_at:new Date().toISOString()});
  const auth=new URL("https://www.canva.com/api/oauth/authorize");
  auth.searchParams.set("code_challenge",challenge);
  auth.searchParams.set("code_challenge_method","s256");
  auth.searchParams.set("scope","design:content:read design:meta:read");
  auth.searchParams.set("response_type","code");
  auth.searchParams.set("client_id",clientId);
  auth.searchParams.set("state",state);
  auth.searchParams.set("redirect_uri",redirectUri);
  return Response.redirect(auth.toString(),302);
};
export const config:Config={path:"/canva/oauth/start"};
