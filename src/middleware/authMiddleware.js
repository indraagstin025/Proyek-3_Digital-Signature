import {supabase} from "../config/supabaseClient.js";
import prisma from "../config/prismaClient.js";
import AuthError from "../errors/AuthError.js";
import asyncHandler from "../utils/asyncHandler.js";
import {parse} from "cookie";

const authMiddleware = asyncHandler(async (req, res, next) => {
    const cookies = req.headers.cookie;
    if(!cookies) {
        throw AuthError.MissingToken("Sesi tidak ditemukan. Silahkan login kembali.");
    }

    const parsedCookies = parse(cookies);
    const token = parsedCookies["sb-access-token"];

    if(!token) {
        throw AuthError.MissingToken("Token autentikasi tidak ditemukan dalam sesi.");
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
        throw AuthError.InvalidToken("Sesi Anda tidak valid atau telah kadaluarsa.");
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