const hre = require("hardhat");

async function main() {
	const [owner] = await ethers.getSigners();

	const Vial = await hre.ethers.getContractFactory("Vial");
	const vial = await Vial.deploy(
		"ipfs://QmZ9NREbRYVMphwF7TnYYchra7vE4JGGHeyzwUm7VpUBji",
		owner.address
	);

	await vial.deployed();

	console.log("Vial deployed to:", vial.address);

	const Box = await hre.ethers.getContractFactory("BambinoBox");
	const box = await Box.deploy(
		"ipfs://QmY6zieAxu4DYpdLvUC5RHqyoP1pzQ6zGxy2LebTJc6Aby",
		owner.address
	);

	await box.deployed();

	console.log("Box deployed to:", box.address);

	const Bambino = await hre.ethers.getContractFactory("BillionaireBambinos");
	const bambino = await Bambino.deploy(vial.address, box.address, 3243);

	await bambino.deployed();

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
