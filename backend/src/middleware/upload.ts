import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');

// Make sure the target dirs exist before multer first touches them.
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    // Files are namespaced by user id so each user's previous avatars are
    // easy to find/clean up later. Extension is derived from the original.
    const userId = (req as Request & { userId?: string }).userId || 'anon';
    const ext = (path.extname(file.originalname) || '.png').toLowerCase();
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
    cb(null, `${userId}_${Date.now()}${safeExt}`);
  }
});

export const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error('Only PNG, JPEG, and WebP images are allowed'));
      return;
    }
    cb(null, true);
  }
});

export const UPLOAD_PATHS = { root: UPLOAD_ROOT, avatars: AVATAR_DIR };

/**
 * Sniff the first 12 bytes of an uploaded file and confirm it's actually
 * an image. multer's fileFilter only checks the Content-Type header, which
 * is supplied by the client and easy to spoof. This catches:
 *   - `.exe` renamed to `.jpg` with `Content-Type: image/jpeg`
 *   - arbitrary binary blobs masquerading as images
 *
 * Returns the detected kind (`png` / `jpeg` / `webp`) on success.
 * Throws if the file isn't a known image — and deletes the bad file from disk.
 */
export function verifyImageMagic(filepath: string): 'png' | 'jpeg' | 'webp' {
  let fd = -1;
  try {
    fd = fs.openSync(filepath, 'r');
    const buf = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
    if (bytesRead < 8) {
      throw new Error('File too small to be a valid image');
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      return 'png';
    }
    // JPEG: FF D8 FF (followed by any of E0/E1/E2/E8/DB/EE)
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      return 'jpeg';
    }
    // WebP: "RIFF" .. .. .. .. "WEBP"
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) {
      return 'webp';
    }
    throw new Error('File is not a recognised PNG, JPEG, or WebP image');
  } catch (e) {
    // Best-effort cleanup so we don't leave the bogus upload on disk
    try { fs.unlinkSync(filepath); } catch { /* ignore */ }
    throw e;
  } finally {
    if (fd >= 0) try { fs.closeSync(fd); } catch { /* ignore */ }
  }
}
