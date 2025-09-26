import { supabase } from "../config/supabaseClient.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Akses ditolak. Token tidak ditemukan." });
    }

    const token = authHeader.split(" ")[1];

    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
        if (error.message.toLowerCase().includes("jwt expired")) {
            return res.status(401).json({
                message: "Sesi Anda telah berakhir. Silahkan login kembali.",
                code: "TOKEN_EXPIRED"
            });
        }
        return res.status(401).json({ message: "Token otentikasi tidak valid.", code: "INVALID_TOKEN"});
    }

    if (!data?.user) {
        return res.status(401).json({ message: "Token otentikasi tidak valid.", code: "INVALID_TOKEN"});
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

    if (!localUser) {
      return res.status(404).json({ message: "Profil user tidak ditemukan di database." });
    }

    req.user = {
      id: localUser.id,
      email: localUser.email,
      name: localUser.name,
      role: localUser.isSuperAdmin ? "super_admin" : "basic_user",
      supabase_metadata: supabaseUser.user_metadata,
    };

    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada autentikasi." });
  }
};

export default authMiddleware;
