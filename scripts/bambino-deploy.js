const hre = require("hardhat");

async function main() {
	const Bambino = await hre.ethers.getContractFactory("BillionaireBambinos");
	const bambino = await Bambino.deploy("0x3dE53A44EaAA867463CCC0d65c8ab4c114c82662",,3243);

	console.log("Bambino deployed to:", bambino.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
