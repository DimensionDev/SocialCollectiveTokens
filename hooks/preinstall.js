const packageJson = require("../package.json");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

packageJson.scripts["fork"] = packageJson.scripts["fork"].replace("${ALCHEMY_API_KEY}", process.env.ALCHEMY_API_KEY);

fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 4));
