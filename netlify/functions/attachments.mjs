import crypto from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";

export const MAX_ATTACHMENT_BYTES=3*1024*1024;
const cleanBase64=s=>String(s??"").replace(/^data:[^;]+;base64,/i,"").replace(/\s/g,"");
const zipMagic=bytes=>bytes.length>=4&&bytes[0]===0x50&&bytes[1]===0x4b&&[0x03,0x05,0x07].includes(bytes[2])&&[0x04,0x06,0x08].includes(bytes[3]);
const imageMime=bytes=>{
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return "image/png";
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return "image/jpeg";
  if(bytes.length>=6&&["GIF87a","GIF89a"].includes(bytes.subarray(0,6).toString("ascii")))return "image/gif";
  if(bytes.length>=12&&bytes.subarray(0,4).toString("ascii")==="RIFF"&&bytes.subarray(8,12).toString("ascii")==="WEBP")return "image/webp";
  return "";
};
const textFromBytes=bytes=>{
  const text=bytes.toString("utf8");
  if(!text||text.includes("\uFFFD"))return "";
  const sample=text.slice(0,4096);
  const printable=[...sample].filter(c=>c==="\n"||c==="\r"||c==="\t"||c.charCodeAt(0)>=32).length;
  return sample.length&&printable/sample.length>=0.95?text.trim():"";
};
export function decodeAttachment(a={}){
  const raw=cleanBase64(a.data_base64);
  if(!raw)throw new Error("attachment_missing_data");
  const bytes=Buffer.from(raw,"base64");
  if(!bytes.length)throw new Error("attachment_missing_data");
  if(bytes.length>MAX_ATTACHMENT_BYTES)throw new Error("attachment_too_large");
  const sha256=crypto.createHash("sha256").update(bytes).digest("hex");
  return{bytes,meta:{name:String(a.name||"shared-item"),mime_type:String(a.mime_type||a.type||"application/octet-stream"),size:bytes.length,sha256}};
}
export function inspectAttachment(decoded){
  const {bytes,meta}=decoded;
  const zip=/\.zip$/i.test(meta.name)||meta.mime_type==="application/zip"||meta.mime_type==="application/x-zip-compressed"||zipMagic(bytes);
  if(zip){
    let files;try{files=unzipSync(new Uint8Array(bytes));}catch{throw new Error("invalid_zip");}
    const names=Object.keys(files);
    const chatName=names.find(n=>/(^|\/)\_chat\.txt$/i.test(n))||names.find(n=>/\.txt$/i.test(n));
    const chatText=chatName?strFromU8(files[chatName]).trim():"";
    return{meta:{...meta,mime_type:"application/zip",archive_entries:names.length,chat_file:chatName||null},text:chatText,kind:"whatsapp_export"};
  }
  const detectedImage=imageMime(bytes);
  if(detectedImage)return{meta:{...meta,mime_type:detectedImage},text:"",kind:"image"};
  const text=textFromBytes(bytes);
  if(text)return{meta:{...meta,mime_type:"text/plain"},text,kind:"text"};
  return{meta,text:"",kind:"file"};
}
export function prepareEvidence(body={}){
  const payload=body.payload&&typeof body.payload==="object"?[body.payload]:[];
  const input=[...(Array.isArray(body.attachments)?body.attachments:[]),...payload];
  const prepared=input.map(a=>inspectAttachment(decodeAttachment(a)));
  const extracted=prepared.map(x=>x.text).filter(Boolean).join("\n\n");
  const text=[String(body.text??"").trim(),extracted].filter(Boolean).join("\n\n");
  return{...body,source_type:prepared.some(x=>x.kind==="whatsapp_export")?"whatsapp_export":(body.source_type||"whatsapp_share"),text,attachments:prepared.map(x=>x.meta),_evidence:prepared};
}
