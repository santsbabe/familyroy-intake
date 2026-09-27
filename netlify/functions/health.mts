import type { Config } from "@netlify/functions";
export default async () => Response.json({ok:true, service:"familyroy-intake", version:"0.1.0"});
export const config: Config = { path: "/health" };
