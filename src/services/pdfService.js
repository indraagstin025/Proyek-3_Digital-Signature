import pkg from "pdf-lib";
const { PDFDocument, Permissions } = pkg;
import QRCode from "qrcode";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import signerPkg from "node-signpdf";
const signer = signerPkg.default;
import { plainAddPlaceholder } from "node-signpdf/dist/helpers/index.js";

import DocumentError from "../errors/DocumentError.js";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

// 🔐 Ambil dari environment
const CERT_BASE64 = process.env.CERT_BASE64 || null;
const CERT_PASSWORD = process.env.CERT_PASSWORD || null;

// 🔄 Fallback ke file lokal jika CERT_BASE64 tidak ada
const CERT_PATH =
    process.env.CERT_FILE_PATH ||
    path.join(process.cwd(), "config", "certs", "signer_cert.p12");

export class PDFService {
    constructor(versionRepository, signatureRepository, fileStorage) {
        this.versionRepository = versionRepository;
        this.signatureRepository = signatureRepository;
        this.fileStorage = fileStorage;
    }

    async generateSignedPdf(documentVersionId, signaturesToEmbed, options = {}) {
        let version;
        try {
            version = await this.versionRepository.findById(documentVersionId);
        } catch (err) {
            throw CommonError.DatabaseError(
                `Gagal mengambil versi dokumen: ${err.message}`
            );
        }

        if (!version)
            throw DocumentError.NotFound(
                `Versi dokumen dengan ID '${documentVersionId}'`
            );

        if (!signaturesToEmbed?.length)
            throw SignatureError.MissingSignatureData();

        const pdfBuffer = await this.fileStorage.downloadFileAsBuffer(version.url);

        let pdfDoc;
        try {
            pdfDoc = await PDFDocument.load(pdfBuffer);
        } catch (error) {
            if (error.message?.includes("is encrypted"))
                throw DocumentError.Encrypted();
            throw CommonError.InternalServerError(
                `Gagal memproses PDF: ${error.message}`
            );
        }

        // 🔹 Tempelkan tanda tangan visual
        for (const sig of signaturesToEmbed) {
            if (!sig.signatureImageUrl) continue;

            const base64Data = sig.signatureImageUrl.replace(
                /^data:image\/png;base64,/,
                ""
            );
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

            page.drawImage(embeddedImage, {
                x,
                y,
                width: finalWidth,
                height: finalHeight,
            });
        }

        // 🔹 Tambahkan QR Code opsional
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

        // 🔹 Proteksi PDF (read-only)
        try {
            pdfDoc.encrypt({
                ownerPassword: CERT_PASSWORD || "readonly",
                permissions: {
                    printing: Permissions.HighResolution,
                    modifying: false,
                    copying: false,
                    annotating: false,
                    fillingForms: false,
                    contentAccessibility: false,
                    documentAssembly: false,
                },
            });
        } catch (err) {
            console.warn("Gagal mengunci PDF:", err.message);
        }

        const pdfVisualBytes = await pdfDoc.save({ useObjectStreams: false });

        // 🔹 Tambahkan placeholder tanda tangan
        const pdfWithPlaceholder = plainAddPlaceholder({
            pdfBuffer: Buffer.from(pdfVisualBytes),
            reason: "Digital Signature by DigiSign Service",
            contactInfo: "support@websiteanda.com",
            name: "DigiSign System",
            location: "Indonesia",
        });

        // 🔹 Ambil buffer sertifikat
        let p12Buffer;
        if (CERT_BASE64) {
            // Railway / Env mode
            p12Buffer = Buffer.from(CERT_BASE64, "base64");
        } else if (fs.existsSync(CERT_PATH)) {
            // Local dev fallback
            p12Buffer = fs.readFileSync(CERT_PATH);
        } else {
            throw CommonError.InternalServerError(
                "Sertifikat P12 tidak ditemukan. Pastikan CERT_BASE64 atau file lokal tersedia."
            );
        }

        // 🔹 Tanda tangani PDF
        let signedPdfBuffer;
        try {
            signedPdfBuffer = signer.sign(pdfWithPlaceholder, p12Buffer, {
                passphrase: CERT_PASSWORD,
            });
        } catch (err) {
            throw CommonError.InternalServerError(
                `Gagal menandatangani dokumen: ${err.message}`
            );
        }

        // 🔹 Upload hasil
        const documentOwnerId = version.userId;
        const ext = path.extname(version.document.title) || ".pdf";
        const uniqueName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
        const signedPath = `signed-documents/${documentOwnerId}/${uniqueName}`;

        const finalUrl = await this.fileStorage.uploadFile(
            signedPath,
            signedPdfBuffer,
            "application/pdf"
        );

        return {
            signedFileBuffer: Buffer.from(signedPdfBuffer),
            publicUrl: finalUrl,
        };
    }
}
