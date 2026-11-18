const fs = require("node:fs");
const path = require("node:path");

const outputDirectory = path.join(__dirname, "dist");
const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:5000/api";

fs.mkdirSync(outputDirectory, { recursive: true });

for (const filename of ["index.html", "styles.css", "app.js"]) {
  fs.copyFileSync(path.join(__dirname, filename), path.join(outputDirectory, filename));
}

fs.writeFileSync(
  path.join(outputDirectory, "api-config.js"),
  `window.CARE_NOTES_API_URL = ${JSON.stringify(apiBaseUrl)};\n`
);

console.log(`Built frontend in ${outputDirectory}`);
