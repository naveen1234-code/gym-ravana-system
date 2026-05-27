const fs = require("fs");

const cloudinary = require("../config/cloudinary");

const uploadBodyProgressPhoto = async ({ filePath, userId, kind }) => {
  const folder = `gym-ravana/body-progress/${userId}`;

  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "image",
    overwrite: false,
    context: { kind },
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

const deleteCloudinaryImageIfExists = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch {
    // Best-effort cleanup; do not block API flow on Cloudinary failures.
  }
};

const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore
  }
};

module.exports = {
  uploadBodyProgressPhoto,
  deleteCloudinaryImageIfExists,
  safeUnlink,
};

