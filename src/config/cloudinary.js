const cloudinary = require("cloudinary").v2;
const { Readable } = require("stream");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const uploadToCloudinary = async (buffer, folder = "uploads", options = {}) => {
  const { thumbnailSize } = options;

  return new Promise((resolve, reject) => {
    const publicId = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId.replace(`${folder}/`, ""),
        use_filename: false,
        unique_filename: false,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        try {
          const url = result.secure_url || result.url;
          let thumbnailUrl = null;
          if (thumbnailSize) {
            // derive thumbnail URL using transformation
            thumbnailUrl = cloudinary.url(result.public_id, {
              width: thumbnailSize,
              height: thumbnailSize,
              crop: "thumb",
              gravity: "face",
              secure: true,
            });
          }
          resolve({ url, thumbnailUrl });
        } catch (e) {
          reject(e);
        }
      },
    );

    const readable = new Readable();
    readable._read = () => {}; // _read is required but you can noop it
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

const deleteFromCloudinaryByUrl = async (url) => {
  if (!url) return;
  try {
    // Example URL formats:
    // https://res.cloudinary.com/<cloud>/image/upload/v123456/folder/name.jpg
    // Extract the part after /upload/ and remove version + extension
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match || !match[1]) return;
    let publicIdWithExt = match[1];
    // remove file extension
    publicIdWithExt = publicIdWithExt.replace(/\.[a-zA-Z0-9]+(\?.*)?$/, "");
    await cloudinary.uploader.destroy(publicIdWithExt, { invalidate: true });
  } catch (err) {
    // don't crash on malformed URLs or delete failures
    console.error("Cloudinary delete error:", err.message || err);
  }
};

module.exports = { uploadToCloudinary, deleteFromCloudinaryByUrl, cloudinary };
