const fs = require("fs");
const hre = require("hardhat");
const { ethers, network } = require("hardhat");
const { whitelist } = require("./whitelist");

const zip = (rows) => rows[0].map((_, c) => rows.map((row) => row[c]));
const objectMap = (obj, fn) =>
  Object.fromEntries(Object.entries(obj).map(([k, v], i) => [k, fn(k, v, i)]));
const promiseAllObj = async (obj) =>
  Object.fromEntries(
    zip([Object.keys(obj), await Promise.all(Object.values(obj))])
  );

const signWhitelist = async (signer, contractAddress, userAccount) => {
  userAccount = ethers.utils.getAddress(userAccount);
  contractAddress = ethers.utils.getAddress(contractAddress);

  return await signer.signMessage(
    ethers.utils.arrayify(
      ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["address", "address"],
          [contractAddress, userAccount]
        )
      )
    )
  );
};

async function main() {
  const [owner] = await ethers.getSigners();

  const contractAddress = "0x617A4405485deD83c4EA301F8C4CAcE9ae792554";

  console.log("signer address:", owner.address);

  const signatures = await promiseAllObj(
    objectMap(whitelist, async (phase, accounts) => {
      return await promiseAllObj(
        Object.assign(
          {},
          ...accounts.map((address) => ({
            [address.toLowerCase()]: signWhitelist(
              owner,
              contractAddress,
              address
            ),
          }))
        )
      );
    })
  );

  console.log("signatures:");
  console.log(signatures);
  console.log("writing to file");
  fs.writeFileSync(
    "whitelistSignatures.js",
    "export const whitelist = " + JSON.stringify(signatures, null, 2),
    console.log
  );
  // fs.writeFile('test.js', JSON.stringify({ a: 1, b: 2, c: 3 }, null, 4), function (err) {
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     console.log('JSON saved to ' + outputFilename);
  //   }
  // });
  // console.log(await Promise.all(Object.values(signatures)));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
