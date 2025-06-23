import busboy from "busboy";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const bb = busboy({ headers: req.headers });
  let fileBuffer = [];
  let fileName = "";
  let fileMime = "";
  let title = "";
  let text = "";

  bb.on("file", (name, file, info) => {
    fileName = info.filename || `shared-${Date.now()}`;
    fileMime = info.mimeType || "image/png";
    file.on("data", (data) => fileBuffer.push(data));
  });

  bb.on("field", (name, val) => {
    if (name === "title") title = val;
    if (name === "text") text = val;
  });

  bb.on("close", async () => {
    const buffer = Buffer.concat(fileBuffer);
    const storagePath = `shared/${Date.now()}-${fileName}`;
    // Upload to Supabase Storage (bucket: shared-images)
    const { data, error } = await supabase.storage
      .from("shared-images")
      .upload(storagePath, buffer, { contentType: fileMime, upsert: true });

    if (error) {
      res.status(500).send("Failed to upload image");
      return;
    }

    // Get public URL
    const { publicURL } = supabase.storage
      .from("shared-images")
      .getPublicUrl(storagePath);

    // Redirect to SPA with image URL
    const url = `/share-target?url=${encodeURIComponent(
      publicURL
    )}&title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}`;
    res.writeHead(302, { Location: url });
    res.end();
  });

  req.pipe(bb);
}
