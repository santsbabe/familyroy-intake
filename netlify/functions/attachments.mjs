import crypto from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";

export const MAX_ATTACHMENT_BYTES=3*1024*1024;
const cleanBase64=s=>String(s??"").replace(/^data:[^;]+;base64,/i,"").replace(/\s/g,"");
export function decodeAttachment(a={}){
  const raw=cleanBase64(a.data_base64);
  if(!raw)throw new Error("attachment_missing_data");
  const bytes=Buffer.from(raw,"base64");
  if(!bytes.length)throw new Error("attachment_missing_data");
  if(bytes.length>MAX_ATTACHMENT_BYTES)throw new Error("attachment_too_large");
  const sha256=crypto.createHash("sha256").update(bytes).digest("hex");
  return{bytes,meta:{name:String(a.name||"attachment"),mime_type:String(a.mime_type||a.type||"application/octet-stream"),size:bytes.length,sha256}};
}
export function inspectAttachment(decoded){
  const {bytes,meta}=decoded;
  const zip=/\.zip$/i.test(meta.name)||meta.mime_type==="application/zip"||meta.mime_type==="application/x-zip-compressed";
  if(!zip)return{meta,text:"",kind:meta.mime_type.startsWith("image/")?"image":"file"};
  let files;try{files=unzipSync(new Uint8Array(bytes));}catch{throw new Error("invalid_zip");}
  const names=Object.keys(files);
  const chatName=names.find(n=>/(^|\/)\_chat\.txt$/i.test(n))||names.find(n=>/\.txt$/i.test(n));
  const chatText=chatName?strFromU8(files[chatName]).trim():"";
  return{meta:{...meta,archive_entries:names.length,chat_file:chatName||null},text:chatText,kind:"whatsapp_export"};
}
export function prepareEvidence(body={}){
  const input=Array.isArray(body.attachments)?body.attachments:[];
  const prepared=input.map(a=>inspectAttachment(decodeAttachment(a)));
  const extracted=prepared.map(x=>x.text).filter(Boolean).join("\n\n");
  const text=[String(body.text??"").trim(),extracted].filter(Boolean).join("\n\n");
  return{...body,source_type:prepared.some(x=>x.kind==="whatsapp_export")?"whatsapp_export":(body.source_type||"whatsapp_share"),text,attachments:prepared.map(x=>x.meta),_evidence:prepared};
}
