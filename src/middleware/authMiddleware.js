import { supabase } from "../config/supabaseClient.js";
import { PrismaClient } from "@prisma/client";
import asyncHandler from "../utils/asyncHandler.js";
import AuthError from "../errors/AuthError.js";

const prisma = new PrismaClient();

const authMiddleware = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // 1. Ganti res.json dengan throw AuthError
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw AuthError.MissingToken();
    }

    const token = authHeader.split(" ")[1];

    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
        // 2. Ganti pengecekan string dengan error yang lebih spesifik
        if (error.message.toLowerCase().includes("jwt expired")) {
            throw AuthError.TokenExpired();
        }
        throw AuthError.InvalidToken();
    }

    if (!data?.user) {
        throw AuthError.InvalidToken();
    }

    const supabaseUser = data.user;

    const localUser = await prisma.user.findUnique({
        where: { id: supabaseUser.id },
        select: {
            id: true,
            email: true,
            name: true,
            isSuperAdmin: true,
        },
    });

    // 3. Gunakan error yang lebih deskriptif
    if (!localUser) {
        throw AuthError.UserNotFound("User valid di Supabase, tapi tidak ditemukan di database lokal.");
    }

    // Jika semua berhasil, lampirkan data user ke request
    req.user = {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.isSuperAdmin ? "super_admin" : "basic_user",
        supabase_metadata: supabaseUser.user_metadata,
    };

    // Lanjutkan ke controller berikutnya
    next();
});

export default authMiddleware;
