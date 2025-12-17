import axios from "axios";
import FormData from "form-data";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5000";

export const aiService = {
  /**
   * Mengirim buffer PDF ke AI Service (Python) untuk deteksi layout.
   * Perhatikan nama fungsinya: detectSignatureLocations (JAMAK/PLURAL)
   */
  async detectSignatureLocations(fileBuffer, fileName = "document.pdf") {
    try {
      const form = new FormData();
      form.append("file", fileBuffer, fileName);

      const response = await axios.post(`${AI_SERVICE_URL}/analyze-layout`, form, {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const result = response.data;

      if (result.status === "success" && result.locations) {
        return result.locations.map((loc) => ({
          pageNumber: loc.page_number,
          x: loc.coordinates.x,
          y: loc.coordinates.y,
          width: loc.coordinates.width,
          height: loc.coordinates.height,
          keyword: loc.keyword_found,
        }));
      }

      return [];
    } catch (error) {
      console.error("AI Service Error:", error.message);

      return [];
    }
  },

  /**
   * Mengirim dokumen ke AI Service.
   * [UPDATE] Menambahkan parameter 'docType' agar Python bisa melakukan analisis kontekstual.
   * * @param {Buffer} fileBuffer - Buffer file PDF.
   * @param {string} docType - Tipe dokumen (default: 'General').
   * @param {string} fileName - Nama file (opsional).
   */
  async analyzeDocumentContent(fileBuffer, docType = "General", fileName = "document.pdf") {
    try {
      const form = new FormData();
      form.append("file", fileBuffer, fileName);
      form.append("document_type", docType || "General");

      const response = await axios.post(`${AI_SERVICE_URL}/analyze-content`, form, {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const result = response.data;
      if (result.status === "success") {
        return result.data;
      }
      return null;
    } catch (error) {
      console.error("AI Content Analysis Error:", error.message);
      return null;
    }
  },
};
