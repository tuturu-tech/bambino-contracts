const hre = require("hardhat");

async function main() {
  const [owner, addr1, addr2] = await ethers.getSigners();
  const Container = await hre.ethers.getContractFactory("Container");
  const container = await Container.deploy(owner.address, 10);

  console.log("Container deployed to:", container.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
