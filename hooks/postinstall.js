const packageJson = require("../package.json");
const fs = require("fs");

packageJson.scripts["fork"] = "yarn hardhat node --fork https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}";

fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 4));
