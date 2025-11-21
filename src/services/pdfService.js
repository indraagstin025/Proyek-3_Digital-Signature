import { fileURLToPath } from "url";
import { dirname } from "path";
import pkg from "pdf-lib";
const { PDFDocument, PDFName, PDFNumber, PDFString } = pkg;
import QRCode from "qrcode";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import signerPkg from "node-signpdf";
const signer = signerPkg.default;
import { plainAddPlaceholder } from "node-signpdf/dist/helpers/index.js";
import muhammara from "muhammara";

import DocumentError from "../errors/DocumentError.js";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

const CERT_BASE64 = process.env.CERT_P12_BASE64 || process.env.CERT_BASE64 || null;
const CERT_PASSWORD = process.env.CERT_PASSWORD || null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CERT_PATH = path.resolve(__dirname, "../../config/certs/signer_cert.p12");

/**
 * Membuat annotation tanda tangan (stamp) pada halaman PDF.
 * Annotation ini bersifat terpisah dari konten halaman (tidak flatten),
 * sehingga akan hilang saat PDF dibuka di Word.
 *
 * @param {PDFDocument} pdfDoc - Dokumen PDF yang sedang dimodifikasi.
 * @param {PDFPage} page - Halaman tempat annotation ditempatkan.
 * @param {PDFFont} embeddedImage - Gambar tanda tangan yang telah di-embed.
 * @param {number} x - Posisi X (dari kiri halaman) untuk annotation.
 * @param {number} y - Posisi Y (dari bawah halaman) untuk annotation.
 * @param {number} width - Lebar annotation.
 * @param {number} height - Tinggi annotation.
 */
function createStampAnnotation(pdfDoc, page, embeddedImage, x, y, width, height) {
    const bbox = pdfDoc.context.obj([
        PDFNumber.of(0),
        PDFNumber.of(0),
        PDFNumber.of(width),
        PDFNumber.of(height),
    ]);

    const xObjectMap = pdfDoc.context.obj({ Im0: embeddedImage.ref });
    const resources = pdfDoc.context.obj({ XObject: xObjectMap });

    const content = `q\n${width} 0 0 ${height} 0 0 cm /Im0 Do\nQ\n`;
    const formStream = pdfDoc.context.flateStream(Buffer.from(content), {
        Type: PDFName.of("XObject"),
        Subtype: PDFName.of("Form"),
        BBox: bbox,
        Resources: resources,
    });
    const formRef = pdfDoc.context.register(formStream);

    const apDict = pdfDoc.context.obj({ N: formRef });

    const annotDict = pdfDoc.context.obj({
        Type: PDFName.of("Annot"),
        Subtype: PDFName.of("Stamp"),
        Rect: pdfDoc.context.obj([
            PDFNumber.of(x),
            PDFNumber.of(y),
            PDFNumber.of(x + width),
            PDFNumber.of(y + height),
        ]),
        AP: apDict,
        Border: pdfDoc.context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]),
        Name: PDFString.of("SignatureStamp"),
        T: PDFString.of("DigitalSignature"),
        F: PDFNumber.of(4),
    });

    const annotRef = pdfDoc.context.register(annotDict);

    const annots = page.node.Annots();
    if (annots) {
        annots.push(annotRef);
    } else {
        page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotRef]));
    }
}

/**
 * Service untuk memproses dokumen PDF, menambahkan tanda tangan digital,
 * QR code, dan melakukan penandatanganan digital menggunakan node-signpdf.
 */
export class PDFService {
    /**
     * @param {Object} versionRepository - Repository untuk versi dokumen.
     * @param {Object} signatureRepository - Repository untuk data tanda tangan.
     * @param {Object} fileStorage - Layanan penyimpanan file (upload/download).
     */
    constructor(versionRepository, signatureRepository, fileStorage) {
        this.versionRepository = versionRepository;
        this.signatureRepository = signatureRepository;
        this.fileStorage = fileStorage;
    }

    /**
     * Menghasilkan PDF yang sudah ditandatangani secara digital.
     *
     * @param {string} documentVersionId - ID versi dokumen.
     * @param {Array} signaturesToEmbed - Array objek tanda tangan yang akan ditempel.
     * @param {Object} [options={}] - Opsi tambahan (misal QR code).
     * @returns {Promise<{signedFileBuffer: Buffer, publicUrl: string}>}
     * @throws {DocumentError|SignatureError|CommonError}
     */
    async generateSignedPdf(documentVersionId, signaturesToEmbed, options = {}) {
        let version;
        try {
            version = await this.versionRepository.findById(documentVersionId);
        } catch (err) {
            throw CommonError.DatabaseError(`Gagal mengambil versi dokumen: ${err.message}`);
        }

        if (!version) throw DocumentError.NotFound(
            `Versi dokumen dengan ID '${documentVersionId}' tidak ditemukan.`
        );

        if (!signaturesToEmbed?.length) throw SignatureError.MissingSignatureData();

        const pdfBuffer = await this.fileStorage.downloadFileAsBuffer(version.url);

        let pdfDoc;
        try {
            pdfDoc = await PDFDocument.load(pdfBuffer);
        } catch (error) {
            if (error.message?.includes("is encrypted")) throw DocumentError.Encrypted();
            throw CommonError.InternalServerError(`Gagal memproses PDF: ${error.message}`);
        }

        for (const sig of signaturesToEmbed) {
            if (!sig.signatureImageUrl) continue;

            const base64Data = sig.signatureImageUrl.replace(/^data:image\/png;base64,/, "");
            const imageBytes = Buffer.from(base64Data, "base64");
            const embeddedImage = await pdfDoc.embedPng(imageBytes);
            const page = pdfDoc.getPage(sig.pageNumber - 1);

            const { width: pw, height: ph } = page.getSize();
            const { width: imgWidth, height: imgHeight } = embeddedImage.size();
            const imgRatio = imgWidth / imgHeight;
            const boxWidth = sig.width * pw;
            const boxHeight = sig.height * ph;
            const boxRatio = boxWidth / boxHeight;

            let finalWidth, finalHeight;
            if (imgRatio > boxRatio) {
                finalWidth = boxWidth;
                finalHeight = finalWidth / imgRatio;
            } else {
                finalHeight = boxHeight;
                finalWidth = finalHeight * imgRatio;
            }

            const xPadding = (boxWidth - finalWidth) / 2;
            const yPadding = (boxHeight - finalHeight) / 2;

            const x = sig.positionX * pw + xPadding;
            const y_from_top = sig.positionY * ph + yPadding;
            const y = ph - y_from_top - finalHeight;

            createStampAnnotation(pdfDoc, page, embeddedImage, x, y, finalWidth, finalHeight);
        }

        if (options.displayQrCode && options.verificationUrl) {
            try {
                const qrDataUrl = await QRCode.toDataURL(options.verificationUrl);
                const qrBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
                const embeddedQr = await pdfDoc.embedPng(qrBytes);
                const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
                lastPage.drawImage(embeddedQr, { x: 40, y: 40, width: 80, height: 80 });
            } catch (err) {
                console.error("Gagal membuat QR code:", err);
            }
        }

        // 6️⃣ Simpan buffer visual PDF
        const pdfVisualBytes = await pdfDoc.save({ useObjectStreams: false });

        // 7️⃣ Enkripsi PDF dengan Muhammara
        let protectedPdfBuffer;
        try {
            const srcStream = new muhammara.PDFRStreamForBuffer(pdfVisualBytes);
            const outStream = new muhammara.PDFWStreamForBuffer();
            const writer = muhammara.createWriterToModify(srcStream, outStream, {
                userPassword: CERT_PASSWORD || "readonly",
                ownerPassword: CERT_PASSWORD || "owner",
                userProtectionFlag: 4 + 8 + 16 + 32 + 256,
            });
            writer.end();
            protectedPdfBuffer = outStream.buffer;
        } catch (err) {
            console.warn("⚠️ Gagal mengenkripsi PDF dengan Muhammara:", err.message);
            protectedPdfBuffer = Buffer.from(pdfVisualBytes);
        }

        // 8️⃣ Tambahkan placeholder tanda tangan digital
        const pdfWithPlaceholder = plainAddPlaceholder({
            pdfBuffer: protectedPdfBuffer,
            reason: "Digital Signature by DigiSign Service",
            contactInfo: "support@websiteanda.com",
            name: "DigiSign System",
            location: "Indonesia",
        });

        // 9️⃣ Ambil sertifikat digital
        let p12Buffer;
        if (CERT_BASE64) {
            p12Buffer = Buffer.from(CERT_BASE64, "base64");
        } else if (fs.existsSync(CERT_PATH)) {
            p12Buffer = fs.readFileSync(CERT_PATH);
        } else {
            throw CommonError.InternalServerError(
                "Sertifikat P12 tidak ditemukan. Pastikan CERT_BASE64 atau file lokal tersedia."
            );
        }

        // 🔟 Tanda tangani PDF
        let signedPdfBuffer;
        try {
            signedPdfBuffer = signer.sign(pdfWithPlaceholder, p12Buffer, {
                passphrase: CERT_PASSWORD,
            });
        } catch (err) {
            throw CommonError.InternalServerError(`Gagal menandatangani dokumen: ${err.message}`);
        }

        const documentOwnerId = version.userId;
        const ext = path.extname(version.document.title) || ".pdf";
        const uniqueName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
        const signedPath = `signed-documents/${documentOwnerId}/${uniqueName}`;

        const finalUrl = await this.fileStorage.uploadFile(signedPath, signedPdfBuffer, "application/pdf");

        return {
            signedFileBuffer: Buffer.from(signedPdfBuffer),
            publicUrl: finalUrl,
        };
    }
}
