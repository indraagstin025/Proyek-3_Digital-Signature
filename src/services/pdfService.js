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

import DocumentError from "../errors/DocumentError.js";
import SignatureError from "../errors/SignatureError.js";
import CommonError from "../errors/CommonError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Membuat Locked Stamp Annotation pada halaman PDF.
 *
 * Annotation ini dirancang agar:
 * 1. Tampil di Browser (Chrome/Edge/Safari).
 * 2. Terkunci (Locked & ReadOnly) di Adobe Acrobat Reader.
 * 3. Umumnya dihapus saat dikonversi ke Word (PDF Reflow).
 *
 * @param {PDFDocument} pdfDoc - Instance dokumen PDF.
 * @param {PDFPage} page - Halaman tempat annotation ditempatkan.
 * @param {PDFImage} embeddedImage - Gambar yang sudah di-embed (PNG/JPG).
 * @param {number} x - Koordinat X (kiri).
 * @param {number} y - Koordinat Y (bawah).
 * @param {number} width - Lebar gambar.
 * @param {number} height - Tinggi gambar.
 */
function createLockedStampAnnotation(pdfDoc, page, embeddedImage, x, y, width, height) {
  const bbox = pdfDoc.context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(width), PDFNumber.of(height)]);

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
    Rect: pdfDoc.context.obj([PDFNumber.of(x), PDFNumber.of(y), PDFNumber.of(x + width), PDFNumber.of(y + height)]),
    AP: apDict,

    F: PDFNumber.of(196),
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
 * Service untuk menangani manipulasi PDF dan Penandatanganan Digital.
 */
export class PDFService {
  /**
   * @param {Object} versionRepository - Repository versi dokumen.
   * @param {Object} signatureRepository - Repository tanda tangan.
   * @param {Object} fileStorage - Service penyimpanan file (S3/Local).
   */
  constructor(versionRepository, signatureRepository, fileStorage) {
    this.versionRepository = versionRepository;
    this.signatureRepository = signatureRepository;
    this.fileStorage = fileStorage;
  }

  /**
   * Memproses PDF untuk menambahkan visual tanda tangan, QR Code,
   * dan sertifikat digital kriptografi (P12).
   *
   * @param {string} documentVersionId - ID versi dokumen yang akan ditandatangani.
   * @param {Array} signaturesToEmbed - Daftar data tanda tangan visual.
   * @param {Object} [options={}] - Opsi tambahan (misal: QR Code).
   * @returns {Promise<{signedFileBuffer: Buffer, publicUrl: string}>}
   * @throws {CommonError} Jika terjadi kesalahan proses.
   */
  async generateSignedPdf(documentVersionId, signaturesToEmbed, options = {}) {
    const certPassword = process.env.CERT_PASSWORD;
    if (!certPassword) {
      throw CommonError.InternalServerError("Konfigurasi Error: CERT_PASSWORD belum diset.");
    }

    let version;
    try {
      version = await this.versionRepository.findById(documentVersionId);
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil versi dokumen: ${err.message}`);
    }

    if (!version) {
      throw DocumentError.NotFound(`Versi dokumen dengan ID '${documentVersionId}' tidak ditemukan.`);
    }
    if (!signaturesToEmbed?.length) {
      throw SignatureError.MissingSignatureData();
    }

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

      const pageIndex = sig.pageNumber - 1;
      if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;

      const page = pdfDoc.getPage(pageIndex);
      const { width: pw, height: ph } = page.getSize();

      const boxWidth = sig.width * pw;
      const boxHeight = sig.height * ph;

      const { width: imgWidth, height: imgHeight } = embeddedImage.size();
      const imgRatio = imgWidth / imgHeight;
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

      createLockedStampAnnotation(pdfDoc, page, embeddedImage, x, y, finalWidth, finalHeight);
    }

    if (options.displayQrCode && options.verificationUrl) {
      try {
        const qrDataUrl = await QRCode.toDataURL(options.verificationUrl);
        const qrBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
        const embeddedQr = await pdfDoc.embedPng(qrBytes);
        const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);

        createLockedStampAnnotation(pdfDoc, lastPage, embeddedQr, 40, 40, 80, 80);
      } catch (err) {
        console.error("Gagal membuat QR code:", err);
      }
    }

    const pdfVisualBytes = await pdfDoc.save({
      useObjectStreams: false,
      updateFieldAppearances: false,
    });

    const pdfWithPlaceholder = plainAddPlaceholder({
      pdfBuffer: Buffer.from(pdfVisualBytes),
      reason: "Digitally Signed by Signify System",
      contactInfo: "admin@signify.com",
      name: "Signify System",
      location: "Bandung, Indonesia",
      signatureLength: 32768,
    });

    const envCertPath = process.env.CERT_FILE_PATH || "./config/certificates/signer_cert.p12";
    const p12Path = path.resolve(process.cwd(), envCertPath);
    let p12Buffer;

    if (fs.existsSync(p12Path)) {
      p12Buffer = fs.readFileSync(p12Path);
    } else if (process.env.CERT_BASE64) {
      p12Buffer = Buffer.from(process.env.CERT_BASE64, "base64");
    } else {
      throw CommonError.InternalServerError("Sertifikat Digital (P12) tidak ditemukan.");
    }

    let signedPdfBuffer;
    try {
      signedPdfBuffer = signer.sign(pdfWithPlaceholder, p12Buffer, {
        passphrase: certPassword,
      });
    } catch (err) {
      throw CommonError.InternalServerError(`Gagal signing: ${err.message}`);
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
