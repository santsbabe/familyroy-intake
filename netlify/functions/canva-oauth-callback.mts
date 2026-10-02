import type { Config } from "@netlify/functions";
import { getDeployStore, getStore } from "@netlify/blobs";

function storeForEnvironment(){
  const production=Netlify.context?.deploy?.context==="production";
  return production?getStore("familyroy-oauth",{consistency:"strong"}):getDeployStore("familyroy-oauth");
}
function html(title:string,body:string,status=200){return new Response(`<!doctype html><meta charset="utf-8"><title>${title}</title><main style="font:16px system-ui;max-width:720px;margin:48px auto;padding:0 20px"><h1>${title}</h1><p>${body}</p></main>`,{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});}

export default async(req:Request)=>{
  if(req.method!=="GET")return new Response("Method Not Allowed",{status:405,headers:{Allow:"GET"}});
  const clientId=process.env.CANVA_CLIENT_ID;
  const clientSecret=process.env.CANVA_CLIENT_SECRET;
  if(!clientId||!clientSecret)return html("Canva connection not ready","FamilyRoy is missing its Canva OAuth credentials.",503);
  const url=new URL(req.url);
  const error=url.searchParams.get("error");
  if(error)return html("Canva connection cancelled","Canva returned: "+error,400);
  const code=url.searchParams.get("code");
  const state=url.searchParams.get("state");
  if(!code||!state)return html("Canva connection failed","Missing authorization code or state.",400);
  const store=storeForEnvironment();
  const stateKey="oauth/state/"+state+".json";
  const pending:any=await store.get(stateKey,{type:"json"});
  if(!pending?.verifier||!pending?.redirect_uri)return html("Canva connection failed","This authorization request is missing or expired.",400);
  await store.delete(stateKey);
  const created=Date.parse(pending.created_at||"");
  if(!Number.isFinite(created)||Date.now()-created>10*60*1000)return html("Canva connection expired","Please start the Canva connection again.",400);
  const body=new URLSearchParams({
    grant_type:"authorization_code",
    code,
    code_verifier:pending.verifier,
    redirect_uri:pending.redirect_uri
  });
  const basic=Buffer.from(clientId+":"+clientSecret).toString("base64");
  const tokenResponse=await fetch("https://api.canva.com/rest/v1/oauth/token",{
    method:"POST",
    headers:{"authorization":"Basic "+basic,"content-type":"application/x-www-form-urlencoded"},
    body
  });
  const token:any=await tokenResponse.json().catch(()=>null);
  if(!tokenResponse.ok||!token?.access_token)return html("Canva connection failed","Token exchange failed. FamilyRoy has not stored an access token.",502);
  await store.setJSON("oauth/token.json",{
    access_token:token.access_token,
    refresh_token:token.refresh_token||null,
    expires_at:Date.now()+Number(token.expires_in||14400)*1000,
    scope:token.scope||null,
    token_type:token.token_type||"Bearer",
    connected_at:new Date().toISOString()
  });
  return html("Canva connected","FamilyRoy can now read authorised Canva design content. You can close this tab.");
};
export const config:Config={path:"/canva/oauth/callback"};
