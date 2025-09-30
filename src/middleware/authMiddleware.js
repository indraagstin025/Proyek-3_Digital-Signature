import { supabase } from "../config/supabaseClient.js";
import prisma from "../config/prismaClient.js";
import AuthError from "../errors/AuthError.js";
import asyncHandler from "../utils/asyncHandler.js"; // <-- 1. Import asyncHandler

const authMiddleware = asyncHandler(async (req, res, next) => { // <-- 2. Wrap with asyncHandler
    // Outer try...catch is no longer needed

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw AuthError.MissingToken();
    }

    const token = authHeader.split(" ")[1];

    // 🔹 Verify the token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    // 🔹 Simplify error handling
    // If there's any error (expired, invalid, etc.) or the user is not found,
    // the token is effectively invalid.
    if (error || !data?.user) {
        throw AuthError.InvalidToken();
    }

    // 🔹 Sync with our local database
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
        throw AuthError.UserNotFound("User account is valid but not found in our system.");
    }

    // 🔹 Inject user data into the request object
    req.user = {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.isSuperAdmin ? "super_admin" : "basic_user",
    };

    next();
});

export default authMiddleware;