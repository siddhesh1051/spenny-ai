import busboy from "busboy";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const bucket = process.env.SUPABASE_BUCKET;
const supabase = createClient(supabaseUrl, supabaseKey);

export const config = {
  api: {
    bodyParser: false, // Disables default body parsing so busboy can handle it
  },
};

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

  let filePromise = new Promise((resolve, reject) => {
    bb.on("file", (name, file, info) => {
      fileName = info.filename || `shared-${Date.now()}`;
      fileMime = info.mimeType || "image/png";
      file.on("data", (data) => fileBuffer.push(data));
      file.on("end", () => resolve());
      file.on("error", reject);
    });
  });

  bb.on("field", (name, val) => {
    if (name === "title") title = val;
    if (name === "text") text = val;
  });

  req.pipe(bb);

  bb.on("finish", async () => {
    await filePromise; // Ensure file is fully buffered
    const buffer = Buffer.concat(fileBuffer);
    if (!buffer.length) {
      res.status(400).send("No file uploaded");
      return;
    }
    const storagePath = `shared/${Date.now()}-${fileName}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, { contentType: fileMime, upsert: true });

    if (error) {
      res.status(500).send("Failed to upload image: " + error.message);
      return;
    }

    const { publicURL } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);
    const url = `/share-target?url=${encodeURIComponent(
      publicURL
    )}&title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}`;
    res.writeHead(302, { Location: url });
    res.end();
  });
}
