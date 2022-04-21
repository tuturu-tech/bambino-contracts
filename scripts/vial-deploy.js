const hre = require("hardhat");

async function main() {
	const Vial = await hre.ethers.getContractFactory("Vial");
	const vial = await Vial.deploy("testURI");

	console.log("Vial deployed to:", vial.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
