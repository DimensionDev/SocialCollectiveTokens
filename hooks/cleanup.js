const fs = require("fs");

// Change file reference from .env.example to .env
const hardhatConfig = __dirname + "/../hardhat.config.ts";
fs.readFile(hardhatConfig, 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  var result = data.replace(/\.\/\.env\.example/g, '.env');

  fs.writeFile(hardhatConfig, result, 'utf8', function (err) {
     if (err) return console.log(err);
  });
});