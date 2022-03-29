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

  const contractAddress = "0x41978f599F793Bd4f697E3eAD1f5FB62BC5BcFC9";

  console.log("signer address:", owner.address);

  let limit = {};

  for (const [key, value] of Object.entries(genesisWhitelist)) {
    const swapped = value.map((address) => [address.toLowerCase(), key]);
    Object.assign(limit, Object.fromEntries(swapped));
  }

  let sig = {};

  for (const [key, value] of Object.entries(genesisWhitelist)) {
    const swapped = value.map((address) => [address.toLowerCase(), key]);
    for (let i = 0; i < swapped.length; i++) {
      swapped[i][1] = await signWhitelist(
        owner,
        contractAddress,
        swapped[i][0],
        swapped[i][1],
        1
      );
    }
    Object.assign(sig, Object.fromEntries(swapped));
  }

  console.log("writing to file");
  fs.writeFileSync(
    "genesisLimit.js",
    "export const genesisLimit = " + JSON.stringify(limit, null, 2),
    console.log
  );

  console.log("writing to file");
  fs.writeFileSync(
    "genesisSignatures.js",
    "export const genesisSig = " + JSON.stringify(sig, null, 2),
    console.log
  );

  let limitWl = {};
  let sigWl = {};

  for (const [key, value] of Object.entries(presaleWhitelist)) {
    const swapped = value.map((address) => [address.toLowerCase(), key]);
    Object.assign(limitWl, Object.fromEntries(swapped));
  }

  for (const [key, value] of Object.entries(presaleWhitelist)) {
    const swapped = value.map((address) => [address.toLowerCase(), key]);
    for (let i = 0; i < swapped.length; i++) {
      swapped[i][1] = await signWhitelist(
        owner,
        contractAddress,
        swapped[i][0],
        swapped[i][1],
        2
      );
    }
    Object.assign(sigWl, Object.fromEntries(swapped));
  }

  console.log("writing to file");
  fs.writeFileSync(
    "presaleLimit.js",
    "export const whitelistLimit = " + JSON.stringify(limitWl, null, 2),
    console.log
  );

  console.log("writing to file");
  fs.writeFileSync(
    "presaleSignatures.js",
    "export const whitelistSig = " + JSON.stringify(sigWl, null, 2),
    console.log
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
