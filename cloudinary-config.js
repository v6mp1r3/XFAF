// Cloudinary account for the shared party gallery (photos + video).
// These values are safe to expose publicly: an unsigned upload preset
// only allows uploads, under whatever size/type limits you set on it
// in the Cloudinary dashboard - never full account access.
//
// Replace both REPLACE_ME values once you've created a free Cloudinary
// account (cloudinary.com) and an UNSIGNED upload preset:
//   Dashboard -> Settings (gear icon) -> Upload -> Upload presets
//   -> Add upload preset -> Signing Mode: Unsigned -> Save.
window.XFAF_CLOUDINARY_CLOUD_NAME = 'i6ced6yu';
window.XFAF_CLOUDINARY_UPLOAD_PRESET = 'Fall-XFAF-2026';
