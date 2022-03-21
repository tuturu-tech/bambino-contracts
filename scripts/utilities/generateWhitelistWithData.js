const fs = require("fs");
const hre = require("hardhat");
const { ethers, network } = require("hardhat");
const { genesisWhitelist } = require("./genesisWhitelist");
const { presaleWhitelist } = require("./presaleWhitelist");

const zip = (rows) => rows[0].map((_, c) => rows.map((row) => row[c]));
const objectMap = (obj, fn) =>
  Object.fromEntries(Object.entries(obj).map(([k, v], i) => [k, fn(k, v, i)]));
const promiseAllObj = async (obj) =>
  Object.fromEntries(
    zip([Object.keys(obj), await Promise.all(Object.values(obj))])
  );

const signWhitelist = async (
  signer,
  contractAddress,
  userAccount,
  data,
  period
) => {
  userAccount = ethers.utils.getAddress(userAccount);
  contractAddress = ethers.utils.getAddress(contractAddress);

  return await signer.signMessage(
    ethers.utils.arrayify(
      ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["address", "uint256", "uint256", "address"],
          [contractAddress, period, data, userAccount]
        )
      )
    )
  );
};

async function main() {
  const [owner] = await ethers.getSigners();

  const contractAddress = "0x55C93c194A788aBb8832C2Cbbe7832f646F4133b";

  console.log("signer address:", owner.address);

  const genesisSignatures = await promiseAllObj(
    objectMap(genesisWhitelist, async (mintLimit, accounts) => {
      return await promiseAllObj(
        Object.assign(
          {},
          ...accounts.map((address) => ({
            [address.toLowerCase()]: signWhitelist(
              owner,
              contractAddress,
              address,
              mintLimit,
              1
            ),
          }))
        )
      );
    })
  );

  const presaleSignatures = await promiseAllObj(
    objectMap(presaleWhitelist, async (mintLimit, accounts) => {
      return await promiseAllObj(
        Object.assign(
          {},
          ...accounts.map((address) => ({
            [address.toLowerCase()]: signWhitelist(
              owner,
              contractAddress,
              address,
              mintLimit,
              2
            ),
          }))
        )
      );
    })
  );

  console.log("writing to file");
  fs.writeFileSync(
    "genesisSignatures.js",
    "export const genesisWhitelist = " +
      JSON.stringify(genesisSignatures, null, 2),
    console.log
  );

  fs.writeFileSync(
    "presaleSignatures.js",
    "export const presaleWhitelist = " +
      JSON.stringify(presaleSignatures, null, 2),
    console.log
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
