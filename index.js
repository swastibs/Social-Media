const http = require("http");
const app = require("./app");

const PORT = process.env.PORT || 8080;

// Only start server when run directly (keep export for serverless platforms)
if (require.main === module) {
  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(
      `🚀 Server is running at https://postloop-8ofmkfndi-swastisunder-s-projects.vercel.app:${PORT}`,
    );
    console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  });

  // Graceful shutdown handlers
  process.on("SIGTERM", () => {
    console.log("SIGTERM signal received: closing HTTP server");
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT signal received: closing HTTP server");
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  });
}

module.exports = app;
