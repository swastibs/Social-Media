const Minio = require("minio");
const sharp = require("sharp");

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT, 10),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

const BUCKET = process.env.MINIO_BUCKET;

const ensureBucket = async () => {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) await minioClient.makeBucket(BUCKET);
};
ensureBucket().catch(console.error);

const getKeyFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split(`/${BUCKET}/`);
  return parts.length > 1 ? parts[1] : null;
};

const uploadToMinio = async (buffer, originalname, folder, options = {}) => {
  const { thumbnailSize = 200, generateThumbnail = true } = options;
  const ext = originalname.split(".").pop().toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const key = `${folder}/${timestamp}-${random}.${ext}`;

  // Upload original
  await minioClient.putObject(BUCKET, key, buffer);

  let thumbnailUrl = null;
  if (generateThumbnail) {
    const thumbBuffer = await sharp(buffer)
      .resize(thumbnailSize, thumbnailSize, {
        fit: "cover",
        position: "centre",
      })
      .toBuffer();
    const thumbKey = `${folder}/thumb-${timestamp}-${random}.${ext}`;
    await minioClient.putObject(BUCKET, thumbKey, thumbBuffer);
    const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
    thumbnailUrl = `${protocol}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${BUCKET}/${thumbKey}`;
  }

  const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
  const url = `${protocol}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${BUCKET}/${key}`;
  return { url, thumbnailUrl, key };
};

const deleteFromMinioByUrl = async (url) => {
  if (!url) return;
  const key = getKeyFromUrl(url);
  if (key) {
    await minioClient.removeObject(BUCKET, key);
    // Delete thumbnail if exists
    const parts = key.split("/");
    const filename = parts.pop();
    const thumbKey = `${parts.join("/")}/thumb-${filename}`;
    try {
      await minioClient.removeObject(BUCKET, thumbKey);
    } catch (e) {}
  }
};

module.exports = { uploadToMinio, deleteFromMinioByUrl, minioClient, BUCKET };
