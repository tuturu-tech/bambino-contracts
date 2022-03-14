const hre = require("hardhat");

async function main() {
  const [owner, addr1, addr2] = await ethers.getSigners();
  const Abstracto = await hre.ethers.getContractFactory("Abstracto");
  const abstracto = await Abstracto.deploy("test", owner.address);

  console.log("Abstracto deployed to:", babyboss.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
