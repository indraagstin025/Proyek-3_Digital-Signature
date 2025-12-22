// file: src/services/aiService.js
import axios from "axios";
import FormData from "form-data";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5000";

export const aiService = {

  /**
   * Hybrid Analysis: Menangani URL (String) ataupun Buffer.
   * @param {string|Buffer} sourceData - Bisa berupa URL string atau File Buffer.
   * @param {string} mode - 'url' atau 'buffer'.
   * @param {string} docType - Tipe dokumen.
   */
  async analyzeDocumentContent(sourceData, mode, docType = "General") {
    try {
      let response;

      // ====================================================
      // SKENARIO 1: MODE URL (Production / Cloud Storage)
      // ====================================================
      if (mode === 'url') {
        console.log(`📡 [AI Service] Mengirim JSON URL ke Python...`);

        // Pastikan sourceData benar-benar string URL, bukan Buffer
        if (typeof sourceData !== 'string') {
          throw new Error("Mode URL dipilih, tapi data bukan string.");
        }

        response = await axios.post(`${AI_SERVICE_URL}/analyze-content`, {
          file_url: sourceData,
          document_type: docType
        }, {
          headers: { "Content-Type": "application/json" },
          timeout: 120000
        });
      }

          // ====================================================
          // SKENARIO 2: MODE BUFFER (Localhost / Local Disk)
      // ====================================================
      else if (mode === 'buffer') {
        console.log(`📡 [AI Service] Uploading Buffer ke Python...`);

        const form = new FormData();
        // Di sini sourceData PASTI Buffer, jadi aman masuk FormData
        form.append("file", sourceData, "document.pdf");
        form.append("document_type", docType);

        response = await axios.post(`${AI_SERVICE_URL}/analyze-content`, form, {
          headers: { ...form.getHeaders() },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 120000
        });
      }

      else {
        throw new Error("Mode tidak valid (harus 'url' atau 'buffer').");
      }

      // Handle Response
      const result = response.data;
      if (result.status === "success") {
        return result.data;
      }

      if (result.summary || result.risk_analysis) return result;

      return null;

    } catch (error) {
      console.error("❌ AI Service Error:", error.message);
      if (error.response) {
        console.error("   Python Response:", error.response.data);
      }
      return { error: error.message };
    }
  },
};