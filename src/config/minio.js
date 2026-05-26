/**
 * MinIO Configuration (S3‑compatible object storage)
 *
 * Handles file uploads to MinIO bucket with automatic thumbnail generation.
 * Used for post images and profile pictures.
 */

const Minio = require("minio");
const sharp = require("sharp");

// Initialize MinIO client with credentials from .env
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT, 10) || 9000,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "admin",
  secretKey: process.env.MINIO_SECRET_KEY || "admin123",
});

const BUCKET = process.env.MINIO_BUCKET || "postloop";

/**
 * Ensures the configured bucket exists.
 * Creates it if missing.
 */
const ensureBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) {
      await minioClient.makeBucket(BUCKET);
      console.log(`📦 MinIO bucket "${BUCKET}" created`);
    }
  } catch (err) {
    console.error("MinIO bucket check failed:", err.message);
  }
};
ensureBucket().catch(console.error);

/**
 * Extracts object key from a full MinIO URL.
 * @param {string} url - Full MinIO URL (e.g., http://localhost:9000/postloop/posts/123.jpg)
 * @returns {string|null} - Object key (e.g., "posts/123.jpg")
 */
const getKeyFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split(`/${BUCKET}/`);
  return parts.length > 1 ? parts[1] : null;
};

/**
 * Uploads a file buffer to MinIO, optionally generating a thumbnail.
 * @param {Buffer} buffer - File buffer
 * @param {string} originalname - Original file name (used for extension)
 * @param {string} folder - Target folder (e.g., "posts", "profiles")
 * @param {Object} options - { thumbnailSize, generateThumbnail }
 * @returns {Promise<{url: string, thumbnailUrl: string|null, key: string}>}
 */
const uploadToMinio = async (buffer, originalname, folder, options = {}) => {
  const { thumbnailSize = 200, generateThumbnail = true } = options;

  // Generate unique filename
  const ext = originalname.split(".").pop().toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const key = `${folder}/${timestamp}-${random}.${ext}`;

  // Upload original file
  await minioClient.putObject(BUCKET, key, buffer);

  let thumbnailUrl = null;
  if (generateThumbnail) {
    // Generate square thumbnail using sharp
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

/**
 * Deletes a file from MinIO using its full URL.
 * Also attempts to delete its thumbnail.
 * @param {string} url - Full MinIO URL of the original file
 */
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
    } catch (e) {
      // Thumbnail may not exist; ignore error
    }
  }
};

module.exports = { uploadToMinio, deleteFromMinioByUrl, minioClient, BUCKET };
