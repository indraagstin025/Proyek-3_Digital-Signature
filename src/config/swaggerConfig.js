/**
 * @file swaggerConfig.js
 * @description Konfigurasi utama Swagger/OpenAPI untuk dokumentasi API
 */

const swaggerConfig = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WeSign API Documentation",
      version: "1.0.0",
      description: "Dokumentasi lengkap API WeSign - Platform tanda tangan digital",
      contact: {
        name: "WeSign Team",
        email: "support@wesign.com",
      },
      license: {
        name: "ISC",
        url: "https://opensource.org/licenses/ISC",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development Server",
      },
      {
        url: "https://api.moodvis.my.id/api-docs",
        description: "Production Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT Authorization header using the Bearer scheme",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "authToken",
          description: "Authentication cookie",
        },
      },
      schemas: {
        // Global Response Schemas
        SuccessResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "success",
            },
            message: {
              type: "string",
              example: "Operasi berhasil",
            },
            data: {
              type: "object",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "fail",
            },
            message: {
              type: "string",
              example: "Terjadi kesalahan",
            },
            error: {
              type: "object",
            },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "fail",
            },
            message: {
              type: "string",
              example: "Validasi gagal",
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: {
                    type: "string",
                  },
                  message: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [
    // Import dokumentasi dari setiap module
    "./src/docs/swagger/authentication-guide.swagger.js",
    "./src/docs/swagger/common.swagger.js",
    "./src/docs/swagger/enums.swagger.js",
    "./src/docs/swagger/models.swagger.js",
    "./src/docs/swagger/cors-troubleshooting.swagger.js",
    "./src/docs/swagger/auth.swagger.js",
    "./src/docs/swagger/user.swagger.js",
    "./src/docs/swagger/document.swagger.js",
    "./src/docs/swagger/signature.swagger.js",
    "./src/docs/swagger/group.swagger.js",
    "./src/docs/swagger/groupSignature.swagger.js",
    "./src/docs/swagger/package.swagger.js",
    "./src/docs/swagger/payment.swagger.js",
    "./src/docs/swagger/admin.swagger.js",
    "./src/docs/swagger/dashboard.swagger.js",
    "./src/docs/swagger/history.swagger.js",
  ],
};

export default swaggerConfig;
