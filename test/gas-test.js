const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const { BigNumber, utils } = require("ethers");
const {
	centerTime,
	getBlockTimestamp,
	jumpToTime,
	advanceTime,
} = require("../scripts/utilities/utility.js");

const BN = BigNumber.from;
var time = centerTime();

const signWhitelist = async (
	signer,
	contractAddress,
	userAccount,
	period,
	data
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

describe.only("Deploy", function () {
	let nfta, owner, addr1, addr2;
	let vialMaxSupply, vialPrice, vialMaxMint;

	beforeEach(async function () {
		[owner, addr1, addr2] = await ethers.getSigners();

		const VIAL = await ethers.getContractFactory("Vial");
		vial = await VIAL.deploy("ipfs://vial/", owner.address);
		await vial.deployed();

		const BOX = await ethers.getContractFactory("BambinoBox");
		box = await BOX.deploy("ipfs://box/", owner.address);
		await box.deployed();

		const BAMBINO = await ethers.getContractFactory("BillionaireBambinos");
		bambino = await BAMBINO.deploy(box.address, vial.address, 1234);
		await bambino.deployed();

		vialMaxSupply = await vial.maxSupply();
		vialPrice = await vial.price();
		vialMaxMint = await vial.maxMint();
	});

	it("Should set correct owner", async function () {
		expect(await vial.owner()).to.equal(owner.address);
		expect(await box.owner()).to.equal(owner.address);
		expect(await bambino.owner()).to.equal(owner.address);
	});

	describe("Vial", function () {
		it("Mint one", async function () {
			await expect(vial.toggleSale()).to.not.be.reverted;
			await expect(vial.mint(1, { value: vialPrice })).to.not.be.reverted;
			expect(await vial.ownerOfERC721Like(1)).to.equal(owner.address);
			expect(await vial.balanceOf(owner.address, 1)).to.equal(1);
		});

		it("Mint ten", async function () {
			await expect(vial.toggleSale()).to.not.be.reverted;
			await expect(vial.connect(addr1).mint(10, { value: vialPrice.mul(10) }))
				.to.not.be.reverted;
			for (let i = 1; i <= 10; i++) {
				expect(await vial.ownerOfERC721Like(i)).to.be.equal(addr1.address);
				expect(await vial.balanceOf(addr1.address, i)).to.equal(1);
			}
		});

		it("Airdrop one", async function () {
			await expect(vial.airdrop(addr1.address, 1)).to.not.be.reverted;
			expect(await vial.ownerOfERC721Like(1)).to.equal(addr1.address);
			expect(await vial.balanceOf(addr1.address, 1)).to.equal(1);
		});
		it("Airdrop ten", async function () {
			await expect(vial.airdrop(addr1.address, 10)).to.not.be.reverted;
			for (let i = 1; i <= 10; i++) {
				expect(await vial.ownerOfERC721Like(i)).to.equal(addr1.address);
				expect(await vial.balanceOf(addr1.address, i)).to.equal(1);
			}
		});

		it("Burn one for Bambino", async function () {
			await expect(vial.toggleSale()).to.not.be.reverted;
			await expect(bambino.toggleActive()).to.not.be.reverted;
			await expect(vial.setBBContract(bambino.address)).to.not.be.reverted;
			await expect(vial.mint(1, { value: vialPrice })).to.not.be.reverted;

			await expect(
				vial.connect(addr1).burn(owner.address, [1])
			).to.be.revertedWith("NOT_AUTHORIZED");

			await expect(bambino.burnVialsForBambino([1])).to.not.be.reverted;
			await expect(vial.ownerOfERC721Like(1)).to.be.revertedWith(
				"ERC1155D: owner query for nonexistent token"
			);
		});

		it("Burn ten for Bambino", async function () {
			await expect(vial.toggleSale()).to.not.be.reverted;
			await expect(bambino.toggleActive()).to.not.be.reverted;
			await expect(vial.setBBContract(bambino.address)).to.not.be.reverted;
			await expect(vial.mint(10, { value: vialPrice.mul(10) })).to.not.be
				.reverted;

			await expect(
				vial.connect(addr1).burn(owner.address, [1, 2])
			).to.be.revertedWith("NOT_AUTHORIZED");

			await expect(bambino.burnVialsForBambino([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
				.to.not.be.reverted;
			await expect(vial.ownerOfERC721Like(1)).to.be.revertedWith(
				"ERC1155D: owner query for nonexistent token"
			);
		});
	});

	describe("Bambino Box", function () {
		it("Mint one", async function () {
			await expect(box.setApprovedMinter(owner.address)).to.not.be.reverted;
			await expect(box.mint(owner.address, 1)).to.be.revertedWith(
				"CONTRACT_PAUSED"
			);
			await expect(box.togglePaused()).to.not.be.reverted;

			await expect(
				box.connect(addr1).mint(addr1.address, 1)
			).to.be.revertedWith("NOT_AUTHORIZED");

			await expect(box.mint(owner.address, 1)).to.not.be.reverted;
			expect(await box.ownerOfERC721Like(1)).to.equal(owner.address);
			expect(await box.balanceOf(owner.address, 1)).to.equal(1);
		});

		it("Mint ten", async function () {
			await expect(box.setApprovedMinter(owner.address)).to.not.be.reverted;
			await expect(box.mint(owner.address, 1)).to.be.revertedWith(
				"CONTRACT_PAUSED"
			);
			await expect(box.togglePaused()).to.not.be.reverted;

			await expect(
				box.connect(addr1).mint(addr1.address, 1)
			).to.be.revertedWith("NOT_AUTHORIZED");

			await expect(box.mint(owner.address, 10)).to.not.be.reverted;
			for (let i = 1; i <= 10; i++) {
				expect(await box.ownerOfERC721Like(i)).to.equal(owner.address);
				expect(await box.balanceOf(owner.address, i)).to.equal(1);
			}
		});

		it("Airdrop one", async function () {
			await expect(box.airdrop(addr1.address, 1)).to.not.be.reverted;
			expect(await box.ownerOfERC721Like(1)).to.equal(addr1.address);
			expect(await box.balanceOf(addr1.address, 1)).to.equal(1);
		});

		it("Airdrop ten", async function () {
			await expect(box.airdrop(addr1.address, 10)).to.not.be.reverted;
			for (let i = 1; i <= 10; i++) {
				expect(await box.ownerOfERC721Like(i)).to.equal(addr1.address);
				expect(await box.balanceOf(addr1.address, i)).to.equal(1);
			}
		});

		it("Burn one", async function () {
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.setApprovedMinter(owner.address)).to.not.be.reverted;
			await expect(box.mint(owner.address, 1)).to.not.be.reverted;

			await expect(box.connect(addr1).burnForReward([1])).to.be.revertedWith(
				"ERC1155: burn amount exceeds balance"
			);
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.burnForReward([1])).to.be.revertedWith(
				"CONTRACT_PAUSED"
			);
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.burnForReward([1])).to.not.be.reverted;

			await expect(box.ownerOfERC721Like(1)).to.be.revertedWith(
				"ERC1155D: owner query for nonexistent token"
			);
		});

		it("Burn ten", async function () {
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.setApprovedMinter(owner.address)).to.not.be.reverted;
			await expect(box.mint(owner.address, 10)).to.not.be.reverted;

			await expect(box.connect(addr1).burnForReward([1, 2])).to.be.revertedWith(
				"ERC1155: burn amount exceeds balance"
			);
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.burnForReward([1, 2])).to.be.revertedWith(
				"CONTRACT_PAUSED"
			);
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.burnForReward([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).to.not.be
				.reverted;

			for (let i = 1; i <= 10; i++) {
				await expect(box.ownerOfERC721Like(1)).to.be.revertedWith(
					"ERC1155D: owner query for nonexistent token"
				);
			}
		});
	});

	describe("Billionaire Bambinos", function () {
		it("Stake/unstake one", async function () {
			vial.toggleSale();
			vial.mint(1, { value: vialPrice.mul(1) });
			await expect(bambino.toggleActive()).to.not.be.reverted;
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.setApprovedMinter(bambino.address)).to.not.be.reverted;
			await expect(vial.setBBContract(bambino.address)).to.not.be.reverted;
			await expect(bambino.burnVialsForBambino([1])).to.not.be.reverted;

			await expect(bambino.stake([1])).to.not.be.reverted;
			expect(await bambino.ownerOf(1)).to.equal(bambino.address);
			await expect(bambino.unstake([1])).to.not.be.reverted;
			expect(await bambino.ownerOf(1)).to.equal(owner.address);
		});

		it.only("Stake/unstake ten", async function () {
			vial.toggleSale();
			vial.mint(10, { value: vialPrice.mul(10) });
			const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			await expect(bambino.toggleActive()).to.not.be.reverted;
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.setApprovedMinter(bambino.address)).to.not.be.reverted;
			await expect(vial.setBBContract(bambino.address)).to.not.be.reverted;
			await expect(bambino.burnVialsForBambino(ids)).to.not.be.reverted;

			await expect(bambino.stake(ids)).to.not.be.reverted;
			for (let i = 1; i <= 10; i++) {
				expect(await bambino.ownerOf(i)).to.equal(bambino.address);
			}

			await expect(bambino.unstake(ids)).to.not.be.reverted;
			for (let i = 1; i <= 10; i++) {
				expect(await bambino.ownerOf(i)).to.equal(owner.address);
			}
		});
	});
});
