const packageJson = require("../package.json");
// const hardhatConfig = require("../hardhat.config.ts");
const fs = require("fs");

// Add back Alchemy API key placeholder to package.json
packageJson.scripts["fork"] = "yarn hardhat node --fork https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}";
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 4));

// Change file reference from .env to .env.example
const hardhatConfig = __dirname + "/../hardhat.config.ts";
fs.readFile(hardhatConfig, 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  var result = data.replace(/\.\/\.env/g, './.env.example');

  fs.writeFile(hardhatConfig, result, 'utf8', function (err) {
     if (err) return console.log(err);
  });
});