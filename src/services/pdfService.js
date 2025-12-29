import { fileURLToPath } from "url";
import { dirname } from "path";
import pkg from "pdf-lib";
const { PDFDocument, PDFName, PDFNumber, PDFString, rgb, StandardFonts } = pkg;
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

// ... (Helper createLockedStampAnnotation TETAP SAMA) ...
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

export class PDFService {
  constructor(versionRepository, signatureRepository, fileStorage) {
    this.versionRepository = versionRepository;
    this.signatureRepository = signatureRepository;
    this.fileStorage = fileStorage;
  }

  async generateSignedPdf(documentVersionId, signaturesToEmbed, options = {}) {
    const certPassword = process.env.CERT_PASSWORD;
    if (!certPassword) throw CommonError.InternalServerError("Konfigurasi Error: CERT_PASSWORD belum diset.");

    // 1. Load Data
    let version;
    try {
      version = await this.versionRepository.findById(documentVersionId);
    } catch (err) {
      throw CommonError.DatabaseError(`Gagal mengambil versi dokumen: ${err.message}`);
    }
    if (!version) throw DocumentError.NotFound(`Versi dokumen ID '${documentVersionId}' tidak ditemukan.`);
    if (!signaturesToEmbed?.length) throw SignatureError.MissingSignatureData();

    // 2. Load PDF
    const pdfBuffer = await this.fileStorage.downloadFileAsBuffer(version.url);
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(pdfBuffer);
    } catch (error) {
      if (error.message?.includes("is encrypted")) throw DocumentError.Encrypted();
      throw CommonError.InternalServerError(`Gagal memproses PDF: ${error.message}`);
    }

    // 3. Embed Visual Signatures (Di Halaman Asli)
    for (const sig of signaturesToEmbed) {
      if (!sig.signatureImageUrl) continue;

      // Skip jika koordinat 0 (artinya mungkin hanya untuk audit log, tidak visual)
      if (!sig.width || !sig.height) continue;

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

    // 4. [BARU] GENERATE HALAMAN AUDIT TRAIL
    let accessCode = null;
    if (options.displayQrCode && options.verificationUrl) {
      accessCode = crypto.randomBytes(3).toString("hex").toUpperCase();

      // Buat halaman baru di akhir
      const auditPage = pdfDoc.addPage();
      const { width, height } = auditPage.getSize();

      // Font
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let yPos = height - 50;

      // HEADER
      auditPage.drawText("DIGITAL SIGNATURE AUDIT TRAIL", { x: 50, y: yPos, size: 18, font: fontBold, color: rgb(0, 0, 0) });
      yPos -= 25;
      auditPage.drawText("Lembar ini adalah bagian tak terpisahkan dari dokumen ini.", { x: 50, y: yPos, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
      yPos -= 40;

      // QR CODE & PIN SECTION
      try {
        const qrDataUrl = await QRCode.toDataURL(options.verificationUrl);
        const qrBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
        const embeddedQr = await pdfDoc.embedPng(qrBytes);

        // Gambar QR di sebelah kanan atas (opsional) atau di bawah header
        // Kita taruh di bawah header kiri
        const qrSize = 100;
        auditPage.drawImage(embeddedQr, { x: 50, y: yPos - qrSize, width: qrSize, height: qrSize });

        // Tulis Info Verifikasi di sebelah QR
        const textX = 170;
        let textY = yPos - 15;

        auditPage.drawText("VERIFIKASI DOKUMEN", { x: textX, y: textY, size: 12, font: fontBold });
        textY -= 20;
        auditPage.drawText("Scan QR Code di samping untuk memverifikasi keaslian", { x: textX, y: textY, size: 10, font: fontRegular });
        textY -= 15;
        auditPage.drawText("dan integritas dokumen ini secara digital.", { x: textX, y: textY, size: 10, font: fontRegular });

        textY -= 30;
        auditPage.drawText(`ACCESS CODE (PIN):  ${accessCode}`, { x: textX, y: textY, size: 14, font: fontBold, color: rgb(0, 0, 0) });

        yPos -= (qrSize + 40); // Geser cursor ke bawah QR
      } catch (err) {
        console.error("Gagal render QR Audit:", err);
      }

      // TABEL LOG SIGNATURE
      auditPage.drawText("RIWAYAT PENANDATANGANAN", { x: 50, y: yPos, size: 14, font: fontBold });
      yPos -= 20;

      // Garis Header
      auditPage.drawLine({ start: { x: 50, y: yPos }, end: { x: width - 50, y: yPos }, thickness: 1, color: rgb(0, 0, 0) });
      yPos -= 20;

      // Loop Data Signature (Audit Log)
      for (const sig of signaturesToEmbed) {
        // Pastikan data ini dikirim dari Service!
        const name = sig.signerName || "Unknown Signer";
        const email = sig.signerEmail || "-";
        const ip = sig.ipAddress || "IP tidak tercatat";
        const dateStr = sig.signedAt ? new Date(sig.signedAt).toLocaleString("id-ID") : "Waktu tidak tercatat";
        const sigId = sig.id ? `ID: ${sig.id.substring(0,8)}...` : "";

        // Cek overflow halaman
        if (yPos < 50) {
          // Buat halaman baru jika penuh (simple logic)
          // (Untuk implementasi robust butuh recursive, tapi ini cukup untuk ~10 signer)
          // auditPage = pdfDoc.addPage(); ...reset yPos...
        }

        auditPage.drawText(name, { x: 50, y: yPos, size: 12, font: fontBold });
        auditPage.drawText(dateStr, { x: width - 200, y: yPos, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

        yPos -= 15;
        auditPage.drawText(`${email}  •  ${ip}  •  ${sigId}`, { x: 50, y: yPos, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

        yPos -= 25; // Spasi antar item
      }

      // Footer Dokumen ID
      const footerY = 30;
      const docIdText = `Document ID: ${version.document.id}  •  Generated by WeSign System`;
      auditPage.drawText(docIdText, { x: 50, y: footerY, size: 8, font: fontRegular, color: rgb(0.6, 0.6, 0.6) });
    }

    // 5. Digital Signing (Crypto)
    const pdfVisualBytes = await pdfDoc.save({ useObjectStreams: false, updateFieldAppearances: false });
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
      signedPdfBuffer = signer.sign(pdfWithPlaceholder, p12Buffer, { passphrase: certPassword });
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
      accessCode: accessCode,
    };
  }
}