import busboy from "busboy";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const bb = busboy({ headers: req.headers });
  let imageBase64 = "";
  let title = "";
  let text = "";
  let imageMime = "";

  bb.on("file", (name, file, info) => {
    const chunks = [];
    imageMime = info.mimeType || "";
    file.on("data", (data) => chunks.push(data));
    file.on("end", () => {
      imageBase64 = Buffer.concat(chunks).toString("base64");
    });
  });

  bb.on("field", (name, val) => {
    if (name === "title") title = val;
    if (name === "text") text = val;
  });

  bb.on("close", () => {
    // Note: For large images, query params may exceed URL length limits.
    const url = `/share-target?image=${encodeURIComponent(
      imageBase64
    )}&mime=${encodeURIComponent(imageMime)}&title=${encodeURIComponent(
      title
    )}&text=${encodeURIComponent(text)}`;
    res.writeHead(302, { Location: url });
    res.end();
  });

  req.pipe(bb);
}
