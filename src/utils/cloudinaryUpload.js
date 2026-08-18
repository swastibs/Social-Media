const cloudinary = require("../config/cloudinary");

/**
 * Upload a file buffer to Cloudinary
 */
const uploadToCloudinary = (buffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folder,
      resource_type: "auto",
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    };

    if (options.thumbnailSize) {
      uploadOptions.eager = [
        {
          width: options.thumbnailSize,
          height: options.thumbnailSize,
          crop: "thumb",
          gravity: "face",
          quality: "auto",
          fetch_format: "auto",
        },
      ];
    }

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) reject(error);
        else {
          const url = result.secure_url;
          const thumbnailUrl =
            result.eager && result.eager[0] ? result.eager[0].secure_url : url;
          resolve({
            url,
            thumbnailUrl,
            publicId: result.public_id,
          });
        }
      },
    );

    stream.end(buffer);
  });
};

/**
 * Delete a file from Cloudinary by public ID
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
};

/**
 * Extract public ID from a Cloudinary URL
 */
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split("/");
  const filename = parts.pop();
  const publicId = filename.split(".")[0];
  const uploadIndex = parts.indexOf("upload");
  const folderPart = parts.slice(uploadIndex + 2).join("/");
  return folderPart ? `${folderPart}/${publicId}` : publicId;
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl,
};
