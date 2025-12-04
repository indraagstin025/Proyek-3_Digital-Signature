import crypto from "crypto";
import CommonError from "../errors/CommonError.js";
import DocumentError from "../errors/DocumentError.js";

/**
 * Payload tanda tangan dalam paket.
 * @typedef {object} SignaturePayload
 * @property {string} packageDocId
 * @property {string} signatureImageUrl
 * @property {number} pageNumber
 * @property {number} positionX
 * @property {number} positionY
 * @property {number} width
 * @property {number} height
 * @property {boolean} [displayQrCode=true]
 */

/**
 * Service untuk seluruh lifecycle Signing Package (batch)
 * termasuk create, signing, verifikasi & integritas hash.
 */
export class PackageService {
    /**
     * @param {*} packageRepository
     * @param {*} documentRepository
     * @param {*} versionRepository
     * @param {*} pdfService
     */
    constructor(packageRepository, documentRepository, versionRepository, pdfService) {
        if (!packageRepository || !documentRepository || !versionRepository || !pdfService) {
            throw CommonError.InternalServerError("PackageService: Repository & PDF Service wajib diberikan.");
        }
        this.packageRepository = packageRepository;
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.pdfService = pdfService;
    }

    /**
     * Membuat package beserta kumpulan dokumen versi aktif.
     *
     * **Alur Kerja:**
     * 1. Validasi tiap dokumen.
     * 2. Ambil `currentVersionId` → jika tidak ada → reject.
     * 3. Jika dokumen telah selesai (completed), tidak bisa dimasukkan ke paket.
     * 4. Simpan package berikut seluruh docVersion ke DB.
     */
    async createPackage(userId, title, documentIds) {
        const docVersionIds = [];

        for (const docId of documentIds) {
            const doc = await this.documentRepository.findById(docId, userId);

            if (!doc) throw DocumentError.NotFound(docId);
            if (!doc.currentVersionId) throw DocumentError.InvalidVersion("Tidak memiliki versi aktif", docId);
            if (doc.status === "completed")
                throw CommonError.BadRequest(`Dokumen '${doc.title}' selesai & tidak dapat ditambah ke paket.`);

            docVersionIds.push(doc.currentVersionId);
        }

        if (docVersionIds.length === 0)
            throw CommonError.BadRequest("Tidak ada dokumen valid untuk diproses.");

        return await this.packageRepository.createPackageWithDocuments(userId, title, docVersionIds);
    }

    /** Mengambil metadata package + relasi dokumen */
    async getPackageDetails(packageId, userId) {
        return await this.packageRepository.findPackageById(packageId, userId);
    }

    /**
     * Eksekusi signing untuk seluruh dokumen dalam paket.
     *
     * **Flow Signing:**
     * 1. Ambil package dan cek status (completed → tolak).
     * 2. Loop setiap dokumen pada paket.
     * 3. Filter payload signature yang sesuai packageDocumentId.
     * 4. Simpan signature ke tabel → dapatkan ID.
     * 5. Generate PDF baru dengan QR Code + verification URL opsional.
     * 6. Hitung hash SHA-256 file hasil.
     * 7. Simpan sebagai versi baru dokumen & mark `completed`.
     * 8. Jika gagal → rollback signature yang sempat tersimpan.
     *
     * @param {string} packageId
     * @param {string} userId
     * @param {SignaturePayload[]} signaturesPayload
     * @param {string} userIpAddress
     * @returns {Promise<{packageId:string, status:'completed'|'partial_failure', success:string[], failed:any[]}>}
     */
    async signPackage(packageId, userId, signaturesPayload, userIpAddress) {
        const pkg = await this.getPackageDetails(packageId, userId);
        if (pkg.status === "completed")
            throw CommonError.BadRequest("Paket ini sudah selesai & tidak dapat diproses ulang.");

        const results = { success: [], failed: [] };

        for (const packageDoc of pkg.documents) {
            const originalDocId = packageDoc.docVersion.document.id;
            const originalVersionId = packageDoc.docVersion.id;
            let createdSignatureIds = [];

            try {
                const signaturesForThisDoc = signaturesPayload.filter(sig => sig.packageDocId === packageDoc.id);
                if (signaturesForThisDoc.length === 0)
                    throw new Error("Tidak ada konfigurasi tanda tangan untuk dokumen ini.");

                const signaturesToCreate = signaturesForThisDoc.map(sig => ({
                    packageDocumentId: packageDoc.id,
                    signerId: userId,
                    signatureImageUrl: sig.signatureImageUrl,
                    pageNumber: sig.pageNumber,
                    positionX: sig.positionX,
                    positionY: sig.positionY,
                    width: sig.width,
                    height: sig.height,
                    ipAddress: userIpAddress
                }));

                const createdSignatures = await this.packageRepository.createPackageSignatures(signaturesToCreate);
                if (!createdSignatures?.length)
                    throw new Error("Database gagal menyimpan tanda tangan.");

                createdSignatureIds = createdSignatures.map(s => s.id);
                const firstSignatureId = createdSignatures[0].id;

                const base = (process.env.VERIFICATION_URL || "http://localhost:5173").replace(/\/$/, "");
                const verificationUrl = `${base}/verify/${firstSignatureId}`;
                const displayQrCode = signaturesForThisDoc[0].displayQrCode ?? true;

                const { signedFileBuffer, publicUrl } = await this.pdfService.generateSignedPdf(
                    originalVersionId,
                    signaturesForThisDoc,
                    { displayQrCode, verificationUrl }
                );

                const hash = crypto.createHash("sha256").update(signedFileBuffer).digest("hex");
                const newVersion = await this.versionRepository.create({
                    documentId: originalDocId,
                    userId,
                    url: publicUrl,
                    hash,
                    signedFileHash: hash,
                });

                await this.packageRepository.updatePackageDocumentVersion(packageId, originalVersionId, newVersion.id);
                await this.documentRepository.update(originalDocId, {
                    currentVersionId: newVersion.id,
                    status: "completed",
                    signedFileUrl: publicUrl
                });

                results.success.push(originalDocId);

            } catch (error) {
                console.error(`[PackageService] Failed doc ${originalDocId}:`, error);

                if (createdSignatureIds.length > 0)
                    await this.packageRepository.deleteSignaturesByIds(createdSignatureIds);

                results.failed.push({ documentId: originalDocId, error: error.message });
            }
        }

        const status = results.failed.length === 0 ? "completed" : "partial_failure";
        await this.packageRepository.updatePackageStatus(packageId, status);

        return { packageId, status, ...results };
    }

    /**
     * Mengambil data verifikasi 1 signature dalam package.
     * Digunakan halaman `/verify/:signatureId` (scanner/QR Code).
     */
    async getPackageSignatureVerificationDetails(signatureId) {
        const sig = await this.packageRepository.findPackageSignatureById(signatureId);
        if (!sig) return null;

        const docVersion = sig.packageDocument?.docVersion;
        const signer = sig.signer;
        const storedHash = docVersion?.signedFileHash || docVersion?.hash;

        if (!docVersion || !signer || !storedHash) return null;

        return {
            signerName: signer.name,
            signerEmail: signer.email,
            documentTitle: docVersion.document.title,
            signedAt: sig.createdAt,
            signatureImageUrl: sig.signatureImageUrl,
            ipAddress: sig.ipAddress ?? "-",
            verificationStatus: "REGISTERED",
            storedFileHash: storedHash,
            originalDocumentUrl: docVersion.url,
            type: "PACKAGE"
        };
    }

    /**
     * Verifikasi integritas file yang diupload user (manual upload).
     * Menghitung hash ulang & dibandingkan dengan hash versi database.
     *
     * @returns {{
     *  signerName:string, signerEmail:string, documentTitle:string,
     *  signedAt:string, verificationStatus:string, isHashMatch:boolean,
     *  storedFileHash:string, recalculatedFileHash:string
     * } | null}
     */
    async verifyUploadedPackageFile(signatureId, uploadedFileBuffer) {
        const sig = await this.packageRepository.findPackageSignatureById(signatureId);
        if (!sig) return null;

        const docVersion = sig.packageDocument?.docVersion;
        const signer = sig.signer;
        const storedHash = docVersion?.signedFileHash || docVersion?.hash;
        if (!storedHash) return null;

        const recalculatedHash = crypto.createHash("sha256").update(uploadedFileBuffer).digest("hex");
        const isMatch = recalculatedHash === storedHash;

        return {
            signerName: signer.name,
            signerEmail: signer.email,
            documentTitle: docVersion.document.title,
            signedAt: sig.createdAt,
            ipAddress: sig.ipAddress ?? "-",
            verificationStatus: isMatch ? "VALID" : "INVALID",
            isSignatureValid: true,
            isHashMatch: isMatch,
            storedFileHash: storedHash,
            recalculatedFileHash: recalculatedHash,
            type: "PACKAGE"
        };
    }
}
