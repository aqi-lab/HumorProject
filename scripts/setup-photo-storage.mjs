import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: buckets, error } = await admin.storage.listBuckets();
if (error) throw new Error("Could not inspect Storage buckets");
if (!buckets.some(bucket => bucket.id === "caption-photos")) {
  const { error: createError } = await admin.storage.createBucket("caption-photos", { public: false, fileSizeLimit: 3 * 1024 * 1024, allowedMimeTypes: ["image/webp"] });
  if (createError) throw new Error("Could not create the private photo bucket");
}
console.log("Private caption photo storage is ready");
