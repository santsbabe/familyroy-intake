import { getDeployStore, getStore } from "@netlify/blobs";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const MCP_URL="https://mcp.canva.com/mcp";
const TOKEN_URL="https://mcp.canva.com/token";

function oauthStore(){
  const production=Netlify.context?.deploy?.context==="production";
  return production?getStore("familyroy-oauth",{consistency:"strong"}):getDeployStore("familyroy-oauth");
}

async function refreshTokenIfNeeded(token:any){
  if(token?.access_token&&Number(token.expires_at||0)>Date.now()+60_000)return token;
  if(!token?.refresh_token)throw new Error("canva_mcp_reauth_required");
  const clientId=process.env.CANVA_MCP_CLIENT_ID;
  const clientSecret=process.env.CANVA_MCP_CLIENT_SECRET;
  if(!clientId||!clientSecret)throw new Error("canva_mcp_client_not_configured");

  const body=new URLSearchParams({grant_type:"refresh_token",refresh_token:token.refresh_token});
  const basic=Buffer.from(clientId+":"+clientSecret).toString("base64");
  const response=await fetch(TOKEN_URL,{
    method:"POST",
    headers:{"authorization":"Basic "+basic,"content-type":"application/x-www-form-urlencoded"},
    body
  });
  const next:any=await response.json().catch(()=>null);
  if(!response.ok||!next?.access_token)throw new Error("canva_mcp_refresh_failed");
  const stored={
    access_token:next.access_token,
    refresh_token:next.refresh_token||token.refresh_token,
    expires_at:Date.now()+Number(next.expires_in||3600)*1000,
    scope:next.scope||token.scope||null,
    token_type:next.token_type||"Bearer",
    connected_at:token.connected_at||new Date().toISOString(),
    refreshed_at:new Date().toISOString()
  };
  await oauthStore().setJSON("oauth/token.json",stored);
  return stored;
}

export async function getCanvaMcpAccessToken(){
  const token:any=await oauthStore().get("oauth/token.json",{type:"json"});
  if(!token)throw new Error("canva_mcp_not_connected");
  const valid=await refreshTokenIfNeeded(token);
  return valid.access_token as string;
}

export async function callCanvaMcpTool(accessToken:string,name:string,args:Record<string,unknown>){
  const client=new Client({name:"familyroy-intake",version:"0.1.0"});
  const transport=new StreamableHTTPClientTransport(new URL(MCP_URL),{
    requestInit:{headers:{Authorization:"Bearer "+accessToken}}
  });
  try{
    await client.connect(transport);
    return await client.callTool({name,arguments:args});
  }finally{
    await client.close().catch(()=>{});
  }
}

export function textFromToolResult(result:any){
  const blocks=Array.isArray(result?.content)?result.content:[];
  const text=blocks.filter((x:any)=>x?.type==="text"&&typeof x.text==="string").map((x:any)=>x.text).join("\n").trim();
  if(!text)return{raw:"",json:null};
  try{return{raw:text,json:JSON.parse(text)}}catch{return{raw:text,json:null}}
}

export function designIdFromUrl(value:string){
  try{
    const u=new URL(value);
    const match=u.pathname.match(/\/design\/([^/]+)/);
    return match?.[1]||null;
  }catch{return null}
}
