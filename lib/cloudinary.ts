import { v2 as cloudinary } from "cloudinary";

let configured = false;

// Throws if Cloudinary credentials are missing. Call before doing paid work
// (image generation) whose result would have nowhere to go.
export function ensureConfigured() {
  if (configured) return;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      "Cloudinary is not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET"
    );
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

// Uploads a story illustration. Re-uploading the same storyId overwrites the
// previous image, so "regenerate" doesn't leave orphaned files behind.
export async function uploadStoryImage(
  image: Buffer,
  storyId: string
): Promise<string> {
  ensureConfigured();
  const dataUri = `data:image/png;base64,${image.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "poppylat/stories",
    public_id: storyId,
    overwrite: true,
    invalidate: true,
    resource_type: "image",
  });
  return result.secure_url;
}
