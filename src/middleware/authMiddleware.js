import supabaseAuth from "../config/supabaseAuth.js";
import prisma from "../config/prismaClient.js";
import AuthError from "../errors/AuthError.js";
import asyncHandler from "../utils/asyncHandler.js";


const authMiddleware = asyncHandler(async (req, res, next) => {
    // ✅ LEBIH SEDERHANA: Langsung baca dari objek req.cookies
    const token = req.cookies["sb-access-token"];

    if (!token) {
        throw AuthError.MissingToken("Sesi tidak ditemukan atau token autentikasi tidak ada.");
    }

    const { data, error } = await supabaseAuth.auth.getUser(token);

    if (error) {
        if (error.message?.toLowerCase().includes("jwt expired")) {
            // ✅ PERUBAHAN DI SINI: Lempar error dengan kode yang jelas
            const sessionError = AuthError.SessionExpired("Sesi Anda telah berakhir. Silakan login kembali.");
            sessionError.code = "SESSION_EXPIRED"; // Tambahkan properti 'code'
            throw sessionError;
        } else {
            throw AuthError.InvalidToken("Token otentikasi tidak valid.");
        }
    }

    if (!data?.user) {
        throw AuthError.InvalidToken("Token otentikasi tidak valid.");
    }


    const localUser = await prisma.user.findUnique({
        where: { id: data.user.id },
        select: {
            id: true,
            email: true,
            name: true,
            isSuperAdmin: true,
        },
    });

    if (!localUser) {
        throw AuthError.UserNotFound(
            "User account is valid but not found in our system."
        );
    }

    req.user = {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.isSuperAdmin ? "super_admin" : "basic_user",
    };
    next();
});

export default authMiddleware;