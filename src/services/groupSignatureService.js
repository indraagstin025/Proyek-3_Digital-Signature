import CommonError from "../errors/CommonError.js";
import crypto from "crypto";

export class GroupSignatureService {
    constructor(
        groupSignatureRepository,
        groupDocumentSignerRepository,
        documentRepository,
        versionRepository,
        groupMemberRepository,
        pdfService,
        auditService
    ) {
        this.groupSignatureRepository = groupSignatureRepository;
        this.groupDocumentSignerRepository = groupDocumentSignerRepository;
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.pdfService = pdfService;
        this.auditService = auditService;
    }

    /**
     * [DRAFT] Menyimpan Draft Tanda Tangan Group (Auto-save Drag & Drop).
     * [IMPROVED] Mencegah duplikat draft jika Frontend generate ID baru secara tidak sengaja.
     */
    async saveDraft(userId, documentId, signatureData) {
        // [FIX TIPE DATA] Pastikan userId adalah String agar konsisten dengan Frontend
        const safeUserId = String(userId);

        const document = await this.documentRepository.findById(documentId, safeUserId);
        if (!document) throw CommonError.NotFound(documentId);

        // Cek apakah user sudah memiliki draft di versi dokumen ini?
        // Ini langkah pengamanan: Jika frontend refresh dan generate UUID baru,
        // Backend harus cukup pintar untuk tahu "Oh, ini orang lama, update aja yg lama".
        let targetId = signatureData.id;

        const existingDraft = await this.groupSignatureRepository.findBySignerAndVersion(safeUserId, document.currentVersionId);

        if (existingDraft && existingDraft.status === 'draft') {
            console.log(`[GroupService] Draft lama ditemukan (${existingDraft.id}). Mengabaikan ID baru dari frontend (${signatureData.id}) dan mengupdate yang lama.`);
            targetId = existingDraft.id;
        }

        const payload = {
            id: targetId,
            userId: safeUserId,
            documentVersionId: document.currentVersionId,
            status: "draft",
            method: signatureData.method || "canvas",
            signatureImageUrl: signatureData.signatureImageUrl,
            positionX: signatureData.positionX,
            positionY: signatureData.positionY,
            pageNumber: signatureData.pageNumber,
            width: signatureData.width || 0,
            height: signatureData.height || 0,
        };

        console.log("[GroupService] Saving Draft:", payload.id);

        // Cek existing berdasarkan ID yang sudah diputuskan (targetId)
        const checkId = await this.groupSignatureRepository.findById(targetId);

        if (checkId) {
            return await this.groupSignatureRepository.update(checkId.id, payload);
        } else {
            return await this.groupSignatureRepository.create(payload);
        }
    }

    /**
     * [UPDATE POSITION] Update posisi draft group (Drag/Resize).
     */
    async updateDraftPosition(signatureId, positionData) {
        const updatePayload = {
            positionX: positionData.positionX,
            positionY: positionData.positionY,
            width: positionData.width,
            height: positionData.height,
            pageNumber: positionData.pageNumber,
        };

        const updated = await this.groupSignatureRepository.update(signatureId, updatePayload);
        return updated;
    }

    /**
     * [DELETE] Hapus Draft Group.
     */
    async deleteDraft(signatureId) {
        const result = await this.groupSignatureRepository.delete(signatureId);
        return result && result.count > 0;
    }

    /**
     * [USER ACTION] Menandatangani Dokumen (Finalisasi).
     */
    async signDocument(userId, documentId, signatureData, auditData, req = null) {
        // [FIX TIPE DATA]
        const safeUserId = String(userId);

        // 1. Cek Hak Akses (Apakah user terdaftar sebagai signer di dokumen ini?)
        // Ini gatekeeper utama. Jika findPending mengembalikan null karena beda tipe data ID, user gagal save.
        const signerRequest = await this.groupDocumentSignerRepository.findPendingByUserAndDoc(safeUserId, documentId);

        if (!signerRequest) {
            console.error(`[GroupService] Access Denied. User: ${safeUserId}, Doc: ${documentId}`);
            throw CommonError.BadRequest("Anda tidak memiliki akses atau sudah tanda tangan.");
        }

        const document = await this.documentRepository.findById(documentId, safeUserId);
        const currentVersion = document.currentVersion;

        // 2. Cek Draft Existing
        const existingSignature = await this.groupSignatureRepository.findBySignerAndVersion(safeUserId, currentVersion.id);
        let finalSignature;

        const payload = {
            ...signatureData,
            userId: safeUserId,
            documentVersionId: currentVersion.id,
            status: "final", // FINAL
            ipAddress: auditData.ipAddress,
            userAgent: auditData.userAgent,
            signedAt: new Date(), // ✅ Record exact time of signing
        };

        if (existingSignature) {
            finalSignature = await this.groupSignatureRepository.update(existingSignature.id, payload);
        } else {
            finalSignature = await this.groupSignatureRepository.create(payload);
        }

        // 3. Update Status Checklist
        await this.groupDocumentSignerRepository.updateStatusToSigned(documentId, safeUserId, finalSignature.id);

        // 4. Audit Log
        if (this.auditService) {
            await this.auditService.log("SIGN_DOCUMENT_GROUP", safeUserId, documentId, `User menandatangani dokumen grup: ${document.title}`, req);
        }

        // 5. Cek Sisa Signer
        const pendingCount = await this.groupDocumentSignerRepository.countPendingSigners(documentId);

        return {
            ...finalSignature,
            message: pendingCount === 0 ? "Tanda tangan berhasil. Menunggu finalisasi Admin." : "Tanda tangan disimpan.",
            isComplete: false,
            readyToFinalize: pendingCount === 0,
            remainingSigners: pendingCount,
        };
    }

    // --- (Metode GET Verification & Unlock tidak perlu diubah, sudah aman) ---

    async getVerificationDetails(signatureId) {
        const sig = await this.groupSignatureRepository.findById(signatureId);
        if (!sig) return null;

        if (sig.accessCode) {
            // Cek Time Lock
            let isTimeLocked = false;
            if (sig.lockedUntil && new Date() < new Date(sig.lockedUntil)) {
                isTimeLocked = true;
            }

            return {
                isLocked: true,
                signatureId: sig.id,
                documentTitle: sig.documentVersion?.document?.title || "Dokumen Terkunci",
                type: "GROUP",
                message: isTimeLocked
                    ? "Akses dibekukan sementara karena terlalu banyak percobaan gagal."
                    : "Dokumen dilindungi kode akses (PIN). Silakan masukkan PIN yang tertera di dokumen.",

                // [PENTING] Kirim data waktu kunci
                lockedUntil: sig.lockedUntil
            };
        }

        const docVersion = sig.documentVersion;
        const signer = sig.signer;
        const storedHash = docVersion.signedFileHash;

        if (!storedHash && docVersion.document?.status !== 'completed') {
            return {
                documentTitle: docVersion.document.title,
                verificationStatus: "PENDING_FINALIZATION",
                verificationMessage: "Dokumen belum difinalisasi oleh Admin Grup.",
                requireUpload: false
            };
        }

        // ✅ Fetch all signers for group collaboration display
        const allSignatures = await this.groupSignatureRepository.findAllByVersionId(docVersion.id);
        const groupSigners = allSignatures
            .filter(s => s.status === 'final')
            .map(s => ({
                name: s.signer.name,
                email: s.signer.email,
                signedAt: s.signedAt || s.createdAt,
                ipAddress: s.ipAddress || "-"
            }));

        // ✅ Get document owner (uploader) info for main display
        const documentOwner = docVersion.document.owner;

        return {
            // ✅ Display document owner as main info
            signerName: documentOwner.name,
            signerEmail: documentOwner.email,
            signerIpAddress: "-", // Owner might not have signed yet
            documentTitle: docVersion.document.title,
            signedAt: docVersion.document.createdAt, // Document upload time
            storedFileHash: storedHash || "PENDING",
            verificationStatus: "REGISTERED",
            verificationMessage: "Tanda tangan grup terdaftar.",
            originalDocumentUrl: docVersion.url,
            type: "GROUP",
            groupSigners: groupSigners, // ✅ Array of signer objects
            isLocked: false
        };
    }

    async unlockVerification(signatureId, inputCode) {
        const sig = await this.groupSignatureRepository.findById(signatureId);
        if (!sig) return null;

        if (sig.lockedUntil && new Date() < new Date(sig.lockedUntil)) {
            const waitTime = Math.ceil((new Date(sig.lockedUntil) - new Date()) / 60000);
            throw CommonError.Forbidden(`Dokumen terkunci sementara. Coba lagi dalam ${waitTime} menit.`);
        }

        if (!sig.accessCode || sig.accessCode !== inputCode) {
            const newRetryCount = (sig.retryCount || 0) + 1;
            const MAX_ATTEMPTS = 3;

            if (newRetryCount >= MAX_ATTEMPTS) {
                const lockTime = new Date(Date.now() + 30 * 60 * 1000);
                await this.groupSignatureRepository.update(sig.id, {
                    retryCount: newRetryCount,
                    lockedUntil: lockTime
                });
                throw CommonError.Forbidden("Terlalu banyak percobaan salah. Dokumen dikunci selama 30 menit.");
            } else {
                await this.groupSignatureRepository.update(sig.id, { retryCount: newRetryCount });
                const sisa = MAX_ATTEMPTS - newRetryCount;
                throw CommonError.BadRequest(`PIN Salah. Sisa percobaan: ${sisa} kali.`);
            }
        }

        if (sig.retryCount > 0 || sig.lockedUntil) {
            await this.groupSignatureRepository.update(sig.id, { retryCount: 0, lockedUntil: null });
        }

        const docVersion = sig.documentVersion;
        const storedHash = docVersion.signedFileHash;

        return {
            // === DATA SENSITIF (DISEMBUNYIKAN) ===
            signerName: null,
            signerEmail: null,

            // [UPDATE] Sembunyikan juga Tanggal & IP
            signerIpAddress: null,
            ipAddress: null,
            signedAt: null,

            // === DATA PUBLIK ===
            documentTitle: sig.documentVersion.document.title, // Judul boleh tampil
            storedFileHash: sig.documentVersion.signedFileHash,

            // === STATUS ===
            verificationStatus: "REGISTERED",
            verificationMessage: "PIN Diterima. Unggah file untuk membuka seluruh metadata.",
            type: "GROUP",

            isLocked: false,     // Gembok terbuka
            requireUpload: true, // Trigger Masking di Frontend
        };
    }

    async verifyUploadedFile(signatureId, uploadedFileBuffer, inputAccessCode = null) {
        console.log(`🔍 [DEBUG] Looking for signature ID: ${signatureId}`);
        const sig = await this.groupSignatureRepository.findById(signatureId);
        console.log(`🔍 [DEBUG] FindById result:`, sig ? 'FOUND' : 'NULL');
        if (sig) console.log(`🔍 [DEBUG] Has owner?`, sig.documentVersion?.document?.owner ? 'YES' : 'NO');
        if (!sig) return null;

        // [LOGIC BARU] Cek PIN
        console.log(`🔍 [DEBUG] Checking PIN... accessCode:`, sig.accessCode ? 'EXISTS' : 'NONE');
        if (sig.accessCode) {
            if (!inputAccessCode || sig.accessCode !== inputAccessCode) {
                console.log(`🔍 [DEBUG] PIN check failed, returning locked status`);
                return {
                    isLocked: true,
                    signatureId: sig.id,
                    documentTitle: "Dokumen Terkunci",
                    message: "Dokumen dilindungi kode akses (PIN).",
                    type: "GROUP"
                };
            }
        }

        console.log(`🔍 [DEBUG] Getting documentId...`);
        const documentId = sig.documentVersion.documentId;
        console.log(`🔍 [DEBUG] DocumentId:`, documentId);
        const document = await this.documentRepository.findByIdSimple(documentId);
        console.log(`🔍 [DEBUG] Document status:`, document?.status);

        if (document.status !== 'completed') {
            console.log(`🔍 [DEBUG] Document not completed, throwing error`);
            throw new Error("Dokumen grup ini belum difinalisasi oleh Admin.");
        }

        console.log(`🔍 [DEBUG] Getting finalVersion...`);

        try {
            const finalVersion = await this.versionRepository.findById(document.currentVersionId);
            console.log(`🔍 [DEBUG] FinalVersion:`, finalVersion ? 'FOUND' : 'NULL');
            const storedHash = finalVersion.signedFileHash;
            console.log(`🔍 [DEBUG] StoredHash:`, storedHash ? 'EXISTS' : 'MISSING');

            if (!storedHash) throw CommonError.InternalServerError("Data Hash dokumen final tidak ditemukan.");

            const recalculateHash = crypto.createHash("sha256").update(uploadedFileBuffer).digest("hex");
            const isHashMatch = recalculateHash === storedHash;
            const allSignatures = await this.groupSignatureRepository.findAllByVersionId(sig.documentVersionId);

            // ✅ Send groupSigners as array of objects with complete details
            const groupSigners = allSignatures
                .filter(s => s.status === 'final')
                .map(s => ({
                    name: s.signer.name,
                    email: s.signer.email,
                    signedAt: s.signedAt || s.createdAt,
                    ipAddress: s.ipAddress || "-"
                }));

            console.log(`🔍 [DEBUG] Getting document owner...`);
            // ✅ Get document owner info (need to fetch full document with owner)
            const fullDocument = await this.documentRepository.findById(documentId);
            console.log(`🔍 [DEBUG] FullDocument:`, fullDocument ? 'FOUND' : 'NULL');
            console.log(`🔍 [DEBUG] Owner:`, fullDocument?.owner ? 'FOUND' : 'NULL');
            const documentOwner = fullDocument.owner;

            console.log(`🔍 [DEBUG] Returning verification result...`);
            return {
                // ✅ Display document owner as main info
                signerName: documentOwner.name,
                signerEmail: documentOwner.email,
                ipAddress: "-", // Owner might not have signed
                groupSigners: groupSigners, // ✅ Array of signer detail objects
                documentTitle: document.title,
                signedAt: fullDocument.createdAt, // Document upload time
                storedFileHash: storedHash,
                recalculatedFileHash: recalculateHash,
                verificationStatus: isHashMatch ? "VALID" : "INVALID",
                isHashMatch: isHashMatch,
                type: "GROUP",
                isLocked: false
            };
        } catch (error) {
            console.error(`❌ [DEBUG] Error in verifyUploadedFile:`, error.message);
            console.error(`❌ [DEBUG] Error stack:`, error.stack);
            throw error; // Re-throw to let controller handle
        }
    }
}