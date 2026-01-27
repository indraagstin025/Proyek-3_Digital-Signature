import { parse } from 'cookie';
import prisma from '../config/prismaClient.js';
import { supabase } from '../config/supabaseClient.js'; // Client untuk Auth
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

// ✅ [BARU] Import Bucket Name dari config terpusat
import { supabaseBucket } from '../config/supabaseAdmin.js';

// Ambil URL Project dari Env (Masih diperlukan untuk merakit URL string)
const REDIS_URL = process.env.REDIS_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_BUCKET = "avatar";

/**
 * Helper: Mengubah path relatif menjadi Full URL Public Supabase.
 * Menggunakan 'supabaseBucket' yang diimport dari config/supabaseAdmin.js
 */
const formatAvatarUrl = (path) => {
    // 1. Jika path kosong/null, return null
    if (!path) return null;

    // 2. Jika path sudah berupa URL lengkap (misal login via Google), kembalikan langsung
    if (path.startsWith("http")) return path;

    // 3. Validasi Env & Config
    if (!SUPABASE_URL || !supabaseBucket) {
        console.warn("⚠️ SUPABASE_URL atau supabaseBucket belum terkonfigurasi dengan benar.");
        // Fallback: kembalikan path aslinya daripada error
        return path;
    }

    // 4. Rakit URL
    // Format: [PROJECT_URL]/storage/v1/object/public/[NAMA_BUCKET]/[PATH_FILE]
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
};

export const initSocket = (io) => {
    // 🔧 [DEBUG] Log untuk memastikan env variable REDIS_URL terbaca
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 [REDIS DEBUG] REDIS_URL exists:', !!REDIS_URL);
    console.log('🔧 [REDIS DEBUG] REDIS_URL value:', REDIS_URL ? REDIS_URL.replace(/:[^:@]+@/, ':****@') : 'NOT SET');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // --- 1. SETUP REDIS ADAPTER ---
    if (REDIS_URL) {
        console.log('🚀 Mendeteksi REDIS_URL, mencoba koneksi Redis...');
        const pubClient = createClient({
            url: REDIS_URL,
            socket: {
                tls: REDIS_URL.startsWith('rediss://'), // Auto-enable TLS for rediss://
                rejectUnauthorized: false // Railway often uses self-signed certs for internal redis
            }
        });
        const subClient = pubClient.duplicate();

        pubClient.on('error', (err) => console.error('❌ Redis Pub Client Error:', err));
        subClient.on('error', (err) => console.error('❌ Redis Sub Client Error:', err));

        // Non-blocking connection to allow server to start immediately
        Promise.all([pubClient.connect(), subClient.connect()])
            .then(async () => {
                io.adapter(createAdapter(pubClient, subClient));
                console.log('✅ Redis Adapter Terhubung (Mode Cluster Siap)');

                // [DEBUG] Tulis key test untuk memastikan koneksi Redis berhasil & bisa write
                try {
                    await pubClient.set('DIGISIGN_STATUS', 'Redis Connected Successfully - ' + new Date().toISOString());
                    console.log('📝 Test Key [DIGISIGN_STATUS] berhasil ditulis ke Redis');
                } catch (writeErr) {
                    console.error('⚠️ Gagal menulis test key ke Redis:', writeErr);
                }
            })
            .catch((error) => {
                console.error('⚠️ Gagal connect Redis, fallback ke Memory:', error);
            });
    } else {
        console.log('☕ Mode Development: Menggunakan RAM Laptop (Tanpa Redis)');
    }

    // --- 2. MIDDLEWARE AUTH ---
    // Registered immediately regardless of Redis status
    io.use(async (socket, next) => {
        try {
            const cookieHeader = socket.request.headers.cookie;

            // Allow Header/Auth fallback
            let accessToken = null;

            if (cookieHeader) {
                const cookies = parse(cookieHeader);
                accessToken = cookies['sb-access-token'];

                // Debugging: Log cookie keys
                if (!accessToken) {
                    console.log("[Socket Auth] Cookies accepted but token missing. Keys:", Object.keys(cookies));
                }
            }

            // Fallback: Check Handshake Auth or Query
            if (!accessToken && socket.handshake.auth && socket.handshake.auth.token) {
                accessToken = socket.handshake.auth.token;
                console.log("[Socket Auth] Using token from Handshake Auth");
            }
            if (!accessToken && socket.handshake.query && socket.handshake.query.token) {
                accessToken = socket.handshake.query.token;
                console.log("[Socket Auth] Using token from Query Param");
            }

            if (!accessToken && !refreshToken) return next(new Error("Authentication error: Access token missing."));

            // A. Validasi Token ke Supabase Auth (Client Standard)
            let user = null;

            // 1. Coba Validasi Access Token
            if (accessToken) {
                const { data, error } = await supabase.auth.getUser(accessToken);
                if (!error && data.user) {
                    user = data.user;
                }
            }

            // 2. Jika Access Token Gagal/Expired, Coba Refresh Token
            if (!user && refreshToken) {
                console.log("🔄 [Socket Auth] Access token expired/invalid. Attempting refresh...");
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
                    refresh_token: refreshToken,
                });

                if (!refreshError && refreshData.session) {
                    console.log("✅ [Socket Auth] Refresh successful for user:", refreshData.user.email);
                    user = refreshData.user;
                    // Note: Kita tidak bisa update cookie di browser via Socket Handshake dengan mudah,
                    // tapi setidaknya koneksi ini berhasil.
                } else {
                    console.error("❌ [Socket Auth] Refresh failed:", refreshError?.message);
                }
            }

            if (!user) return next(new Error("Authentication error: Invalid or expired token."));

            // B. Ambil Data User dari DB Lokal (Prisma)
            const localUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    isSuperAdmin: true,
                    profilePictureUrl: true, // Ambil path relatif dari DB
                },
            });

            if (!localUser) return next(new Error("Authentication error: User not found in local DB."));

            // 🔥 [LANGKAH KUNCI] Mutasi path relatif menjadi Full URL Public
            // Menggunakan helper yang sudah terhubung dengan supabaseAdmin config
            localUser.profilePictureUrl = formatAvatarUrl(localUser.profilePictureUrl);

            // Simpan user object ke socket session
            socket.user = localUser;
            socket.data.user = localUser;

            next();

        } catch (err) {
            console.error("[Socket Auth] Internal Error:", err.message);
            return next(new Error("Authentication error: Internal Server Error."));
        }
    });

    // --- 3. EVENT HANDLERS ---
    io.on("connection", (socket) => {
        // console.log(`🟢 User Connected: ${socket.user.name}`);

        // A. EVENT JOIN ROOM
        socket.on("join_room", async (documentId) => {
            socket.join(documentId);

            // 1. Beri tahu user LAIN (Kirim Full URL)
            socket.to(documentId).emit("user_joined", {
                userId: socket.user.id,
                userName: socket.user.name,
                profilePictureUrl: socket.user.profilePictureUrl,
                joinedAt: new Date()
            });

            // 2. Beri tahu user BARU tentang user LAMA
            try {
                const sockets = await io.in(documentId).fetchSockets();

                const existingUsers = sockets
                    .map(s => {
                        const u = s.data.user || s.user;
                        if (!u) return null;

                        return {
                            userId: u.id,
                            userName: u.name,
                            profilePictureUrl: u.profilePictureUrl // Sudah Full URL
                        };
                    })
                    .filter(u => u && u.userId && String(u.userId) !== String(socket.user.id));

                // Deduplikasi User
                const uniqueUsers = [];
                const seenIds = new Set();
                for (const u of existingUsers) {
                    if (!seenIds.has(u.userId)) {
                        seenIds.add(u.userId);
                        uniqueUsers.push(u);
                    }
                }

                socket.emit("current_room_users", uniqueUsers);

            } catch (error) {
                console.error("Gagal fetch sockets:", error);
            }
        });

        // B. EVENT DRAG SIGNATURE
        socket.on("drag_signature", (data) => {
            socket.to(data.documentId).emit("update_signature_position", data);
        });

        // C. EVENT LEAVE ROOM
        socket.on("leave_room", (documentId) => {
            socket.leave(documentId);
            socket.to(documentId).emit("user_left", { userId: socket.user.id });
        });

        // D. EVENT TRIGGER RELOAD
        socket.on("trigger_reload", (documentId) => {
            socket.to(documentId).emit("refetch_data");
        });

        // E. EVENT ADD SIGNATURE LIVE
        socket.on("add_signature_live", (data) => {
            socket.to(data.documentId).emit("add_signature_live", data.signature);
        });

        // F. EVENT REMOVE SIGNATURE LIVE
        socket.on("remove_signature_live", (data) => {
            socket.to(data.documentId).emit("remove_signature_live", data.signatureId);
        });

        // ✅ [BARU] G. EVENT SIGNATURE SAVED - Memberitahu user lain saat tanda tangan disimpan
        socket.on("signature_saved", (data) => {
            // Broadcast ke semua user di room KECUALI pengirim
            socket.to(data.documentId).emit("signature_saved", {
                userId: socket.user.id,
                userName: socket.user.name,
                profilePictureUrl: socket.user.profilePictureUrl,
                message: `${socket.user.name} telah menandatangani dokumen!`,
                savedAt: new Date()
            });
        });

        // H. EVENT CURSOR MOVE
        socket.on("cursor_move", (data) => {
            const cursorData = {
                ...data,
                userId: socket.user.id,
                userName: socket.user.name,
            };
            socket.to(data.documentId).emit("cursor_move", cursorData);
        });

        // I. EVENT JOIN GROUP ROOM
        socket.on("join_group_room", async (groupId) => {
            try {
                const gId = parseInt(groupId);
                const isMember = await prisma.groupMember.findFirst({
                    where: { groupId: gId, userId: socket.user.id }
                });
                if (isMember) {
                    socket.join(`group_${gId}`);
                }
            } catch (error) {
                console.error("Error joining group room:", error);
            }
        });

        // J. EVENT LEAVE GROUP ROOM
        socket.on("leave_group_room", (groupId) => {
            socket.leave(`group_${groupId}`);
        });

        // K. EVENT DISCONNECT
        socket.on("disconnect", () => {
            // Cleanup jika perlu
        });
    });
};