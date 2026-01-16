// src/utils/urlHelper.js
import 'dotenv/config';

// Hardcode bucket sesuai FileStorage Anda
const SUPABASE_BUCKET = "avatar";
const SUPABASE_URL = process.env.SUPABASE_URL;

export const formatAvatarUrl = (path) => {
    if (!path) return null;

    // FIX: Deteksi jika URL ganda (Supabase Prefix + Google URL)
    // Contoh: https://xxx.supabase.co/.../avatar/https://lh3.googleusercontent.com/...
    if (path.includes("/storage/v1/object/public/avatar/http")) {
        const parts = path.split("/storage/v1/object/public/avatar/");
        // Ambil bagian terakhir yang merupakan URL asli
        return parts[parts.length - 1];
    }

    // Jika path sudah URL lengkap (misal dari Google), biarkan
    if (path.startsWith("http")) return path;

    // Jika env belum siap, kembalikan path aslinya (fallback)
    if (!SUPABASE_URL) return path;

    // Rakit URL Lengkap
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
};