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
		vial = await VIAL.deploy("ipfs://vial/");
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
		it("Should restrict functions to owner", async function () {
			await expect(
				vial.connect(addr1).airdrop(addr1.address, 5)
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(vial.connect(addr1).toggleSale()).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
			await expect(
				vial.connect(addr1).setBBContract(addr1.address)
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(vial.connect(addr1).setURI("dummy")).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
			await expect(
				vial.connect(addr1).setWithdrawalAddress(addr1.address)
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(vial.connect(addr1).withdraw()).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
			await expect(
				vial.connect(addr1).setPrice(ethers.utils.parseEther("0"))
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(vial.connect(addr1).setMaxSupply(10000)).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
		});

		it("Should correctly limit minting", async function () {
			await expect(
				vial.mint(5, { value: vialPrice.mul(5) })
			).to.be.revertedWith("SALE: NOT_STARTED");
			await expect(vial.toggleSale()).to.not.be.reverted;
			expect(await vial.saleStarted()).to.equal(true);
			await expect(
				vial.mint(5, { value: vialPrice.mul(4) })
			).to.be.revertedWith("PRICE: AMOUNT_TOO_LOW");
			await expect(
				vial.mint(11, { value: vialPrice.mul(11) })
			).to.be.revertedWith("QUANTITY: TOO_HIGH");

			await expect(vial.setMaxSupply(5)).to.not.be.reverted;

			await expect(vial.mint(5, { value: vialPrice.mul(5) })).to.not.be
				.reverted;
			await expect(
				vial.mint(1, { value: vialPrice.mul(1) })
			).to.be.revertedWith("SUPPLY: MAX_REACHED");
		});

		it("Should correctly use and limit setMaxSupply", async function () {
			await expect(vial.setMaxSupply(vialMaxSupply.add(1))).to.be.revertedWith(
				"CANT_RAISE_MAX_SUPPLY"
			);
			await expect(vial.toggleSale()).to.not.be.reverted;
			await expect(vial.mint(10, { value: vialPrice.mul(10) })).to.not.be
				.reverted;
			await expect(vial.setMaxSupply(9)).to.be.revertedWith("SUPPLY_TOO_LOW");
			await expect(vial.setMaxSupply(10)).to.not.be.reverted;
			expect(await vial.maxSupply()).to.be.equal(10);
		});

		it("Should correctly mint", async function () {
			await expect(vial.toggleSale()).to.not.be.reverted;
			await expect(vial.mint(1, { value: vialPrice })).to.not.be.reverted;
			expect(await vial.ownerOfERC721Like(1)).to.equal(owner.address);
			expect(await vial.balanceOf(owner.address, 1)).to.equal(1);

			await expect(vial.connect(addr1).mint(10, { value: vialPrice.mul(10) }))
				.to.not.be.reverted;
			for (let i = 2; i <= 11; i++) {
				expect(await vial.ownerOfERC721Like(i)).to.be.equal(addr1.address);
				expect(await vial.balanceOf(addr1.address, i)).to.equal(1);
			}
		});

		it("Should properly set price", async function () {
			const newPrice = ethers.utils.parseEther("1");
			await expect(vial.setPrice(newPrice)).to.not.be.reverted;
			expect(await vial.price()).to.equal(newPrice);
		});

		it("Should properly set BBContract", async function () {
			await expect(vial.setBBContract(addr2.address)).to.not.be.reverted;
			expect(await vial.BBContract()).to.equal(addr2.address);
		});

		it("Should properly set the URI", async function () {
			await expect(vial.toggleSale()).to.not.be.reverted;
			await expect(vial.mint(1, { value: vialPrice })).to.not.be.reverted;
			await expect(vial.setURI("Newuri")).to.not.be.reverted;
			expect(await vial.uri(1)).to.equal("Newuri");
		});

		it("Should properly set withdrawal address", async function () {
			await expect(vial.setWithdrawalAddress(addr2.address)).to.not.be.reverted;
			expect(await vial.withdrawalAddress()).to.equal(addr2.address);
		});

		it("Should properly use and limit airdrop", async function () {
			await expect(vial.airdrop(addr1.address, 5)).to.not.be.reverted;
			for (let i = 1; i <= 5; i++) {
				expect(await vial.ownerOfERC721Like(i)).to.equal(addr1.address);
				expect(await vial.balanceOf(addr1.address, i)).to.equal(1);
			}

			await expect(vial.setMaxSupply(10)).to.not.be.reverted;
			await expect(vial.airdrop(addr1.address, 5)).to.not.be.reverted;

			await expect(vial.airdrop(addr1.address, 1)).to.be.revertedWith(
				"SUPPLY: MAX_REACHED"
			);
		});

		it("Should properly use and limit burn", async function () {
			await expect(vial.toggleSale()).to.not.be.reverted;
			await expect(vial.setBBContract(owner.address)).to.not.be.reverted;
			await expect(vial.mint(2, { value: vialPrice.mul(2) })).to.not.be
				.reverted;

			await expect(
				vial.connect(addr1).burn(owner.address, [1, 2])
			).to.be.revertedWith("NOT_AUTHORIZED");

			await expect(vial.burn(owner.address, [1])).to.not.be.reverted;
			await expect(vial.ownerOfERC721Like(1)).to.be.revertedWith(
				"ERC1155D: owner query for nonexistent token"
			);
			expect(await vial.ownerOfERC721Like(2)).to.equal(owner.address);
			expect(await vial.balanceOf(owner.address, 1)).to.equal(0);
			expect(await vial.balanceOf(owner.address, 2)).to.equal(1);
		});
	});

	describe("Bambino Box", function () {
		it("Should restrict functions to owner", async function () {
			await expect(
				box.connect(addr1).airdrop(addr1.address, 5)
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(box.connect(addr1).togglePaused()).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
			await expect(
				box.connect(addr1).setApprovedMinter(addr1.address)
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(box.connect(addr1).setURI("dummy")).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
			await expect(
				box.connect(addr1).setWithdrawalAddress(addr1.address)
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(box.connect(addr1).withdraw()).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
			await expect(
				box.connect(addr1).setMaxCirculatingSupply(2000)
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("Should correctly use and limit minting", async function () {
			await expect(box.setApprovedMinter(owner.address)).to.not.be.reverted;
			await expect(box.mint(owner.address, 5)).to.be.revertedWith(
				"CONTRACT_PAUSED"
			);
			await expect(box.togglePaused()).to.not.be.reverted;

			await expect(
				box.connect(addr1).mint(addr1.address, 1)
			).to.be.revertedWith("NOT_AUTHORIZED");

			await expect(box.mint(owner.address, 2)).to.not.be.reverted;
			expect(await box.ownerOfERC721Like(1)).to.equal(owner.address);
			expect(await box.ownerOfERC721Like(2)).to.equal(owner.address);
			expect(await box.balanceOf(owner.address, 1)).to.equal(1);
			expect(await box.balanceOf(owner.address, 2)).to.equal(1);

			await expect(box.setMaxCirculatingSupply(10)).to.not.be.reverted;
			expect(await box.maxCirculatingSupply()).to.equal(10);
			await expect(box.mint(owner.address, 8)).to.not.be.reverted;
			await expect(box.mint(owner.address, 1)).to.be.revertedWith(
				"SUPPLY: MAX_REACHED"
			);
		});

		it("Should properly set approvedMinter", async function () {
			await expect(box.setApprovedMinter(addr2.address)).to.not.be.reverted;
			expect(await box.approvedMinter()).to.equal(addr2.address);
		});

		it("Should properly set the URI", async function () {
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.setApprovedMinter(owner.address)).to.not.be.reverted;

			await expect(box.mint(owner.address, 1)).to.not.be.reverted;
			await expect(box.setURI("Newuri")).to.not.be.reverted;
			expect(await box.uri(1)).to.equal("Newuri");
		});

		it("Should properly set withdrawal address", async function () {
			await expect(box.setWithdrawalAddress(addr2.address)).to.not.be.reverted;
			expect(await box.withdrawalAddress()).to.equal(addr2.address);
		});

		it("Should properly use and limit airdrop", async function () {
			await expect(box.airdrop(addr1.address, 5)).to.not.be.reverted;
			for (let i = 1; i <= 5; i++) {
				expect(await box.ownerOfERC721Like(i)).to.equal(addr1.address);
				expect(await box.balanceOf(addr1.address, i)).to.equal(1);
			}

			await expect(box.setMaxCirculatingSupply(10)).to.not.be.reverted;
			await expect(box.airdrop(addr1.address, 5)).to.not.be.reverted;

			await expect(box.airdrop(addr1.address, 1)).to.be.revertedWith(
				"SUPPLY: MAX_REACHED"
			);
		});

		it("Should properly use and limit burn", async function () {
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.setApprovedMinter(owner.address)).to.not.be.reverted;
			await expect(box.mint(owner.address, 2)).to.not.be.reverted;

			await expect(box.connect(addr1).burnForReward([1, 2])).to.be.revertedWith(
				"ERC1155: burn amount exceeds balance"
			);
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.burnForReward([1, 2])).to.be.revertedWith(
				"CONTRACT_PAUSED"
			);
			await expect(box.togglePaused()).to.not.be.reverted;
			await expect(box.burnForReward([1, 2])).to.not.be.reverted;

			await expect(box.ownerOfERC721Like(1)).to.be.revertedWith(
				"ERC1155D: owner query for nonexistent token"
			);
			await expect(box.ownerOfERC721Like(2)).to.be.revertedWith(
				"ERC1155D: owner query for nonexistent token"
			);
		});
	});

	describe("Billionaire Bambinos", function () {
		it("Should properly limit owner functions", async function () {
			await expect(
				bambino.connect(addr1).setBaseURI("base")
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(
				bambino.connect(addr1).setUnrevealedURI("base")
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(
				bambino.connect(addr1).setRevealTime(100)
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(
				bambino.connect(addr1).setVialContract(vial.address)
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(bambino.connect(addr1).setNumWords(10)).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
			await expect(
				bambino.connect(addr1).setGasLimit(200000)
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(
				bambino.connect(addr1).startNextCycle(1649949697)
			).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(bambino.connect(addr1).toggleActive()).to.be.revertedWith(
				"Ownable: caller is not the owner"
			);
		});

		it("Should correctly set baseURI", async function () {
			await expect(bambino.setBaseURI("baseURI/")).to.not.be.reverted;
			expect(await bambino.baseURI()).to.equal("baseURI/");
		});

		it("Should correctly set unrevealedURI", async function () {
			await expect(bambino.setUnrevealedURI("baseURI/")).to.not.be.reverted;
			expect(await bambino.unrevealedURI()).to.equal("baseURI/");
		});

		it("Should correctly set revealTime", async function () {
			await expect(bambino.setRevealTime(100)).to.not.be.reverted;
			expect(await bambino.revealTime()).to.equal(100);
		});

		it("Should correctly set vialContract", async function () {
			await expect(bambino.setVialContract(addr1.address)).to.not.be.reverted;
			expect(await bambino.vialContract()).to.equal(addr1.address);
		});

		it("Should correctly set numWords", async function () {
			await expect(bambino.setNumWords(10)).to.not.be.reverted;
			expect(await bambino.numWords()).to.equal(10);
		});

		it("Should correctly set gasLimit", async function () {
			await expect(bambino.setGasLimit(200000)).to.not.be.reverted;
			expect(await bambino.callbackGasLimit()).to.equal(200000);
		});

		it("Should properly mint Bambino and burn vial", async function () {
			vial.toggleSale();
			vial.mint(5, { value: vialPrice.mul(5) });
			vial.connect(addr1).mint(5, { value: vialPrice.mul(5) });
			for (let i = 1; i <= 5; i++) {
				expect(await vial.ownerOfERC721Like(i)).to.equal(owner.address);
				expect(await vial.ownerOfERC721Like(i + 5)).to.equal(addr1.address);
			}

			await expect(bambino.burnVialsForBambino([1, 2, 3])).to.be.revertedWith(
				"CONTRACT_PAUSED"
			);
			await expect(bambino.toggleActive()).to.not.be.reverted;
			await expect(bambino.burnVialsForBambino([1])).to.be.revertedWith(
				"NOT_AUTHORIZED"
			);
			await expect(vial.setBBContract(bambino.address)).to.not.be.reverted;
			await expect(bambino.burnVialsForBambino([6])).to.be.revertedWith(
				"ERC1155: burn amount exceeds balance"
			);

			await expect(bambino.burnVialsForBambino([1, 2, 3])).to.not.be.reverted;
			expect(await vial.balanceOf(owner.address, 1)).to.equal(0);
			expect(await vial.balanceOf(owner.address, 2)).to.equal(0);
			expect(await vial.balanceOf(owner.address, 3)).to.equal(0);
			expect(await vial.balanceOf(owner.address, 4)).to.equal(1);
			expect(await vial.balanceOf(owner.address, 5)).to.equal(1);

			expect(await bambino.ownerOf(1)).to.equal(owner.address);
			expect(await bambino.ownerOf(2)).to.equal(owner.address);
			expect(await bambino.ownerOf(3)).to.equal(owner.address);
			expect(await bambino.numMinted(owner.address)).to.equal(3);
			expect(await bambino.numOwned(owner.address)).to.equal(3);
			expect(await bambino.numStaked(owner.address)).to.equal(0);

			await expect(bambino.burnVialsForBambino([1, 2, 3])).to.be.revertedWith(
				"ERC1155: burn amount exceeds balance"
			);
			await expect(bambino.burnVialsForBambino([4, 5, 6])).to.be.revertedWith(
				"ERC1155: burn amount exceeds balance"
			);

			await expect(bambino.tokenURI(4)).to.be.revertedWith(
				"ERC721Metadata: URI query for nonexistent token"
			);
			expect(await bambino.tokenURI(1)).to.equal("");
			await expect(bambino.setUnrevealedURI("unrevealed")).to.not.be.reverted;
			expect(await bambino.tokenURI(1)).to.equal("unrevealed");
			await expect(bambino.setBaseURI("base/")).to.not.be.reverted;
			expect(await bambino.tokenURI(1)).to.equal("base/1.json");

			await expect(bambino.setRevealTime((await getBlockTimestamp()) + 1000)).to
				.not.be.reverted;
			expect(await bambino.tokenURI(1)).to.equal("unrevealed");
		});

		it("Should correctly startNextCycle", async function () {
			await expect(bambino.setCycleSeed(0, 100)).to.not.be.reverted;
			await expect(bambino.startNextCycle(100)).to.be.revertedWith(
				"START_TIME_TOO_SMALL"
			);
			await expect(
				bambino.startNextCycle(Number(await getBlockTimestamp()) + 10)
			).to.not.be.reverted;
			expect(await bambino.currentCycle()).to.equal(1);
			await expect(
				bambino.startNextCycle(Number(await getBlockTimestamp()) + 11)
			).to.be.revertedWith("TOO_SOON_TO_START_NEW_CYCLE");
		});

		it("Should correctly stake", async function () {
			vial.toggleSale();
			vial.mint(5, { value: vialPrice.mul(5) });
			vial.connect(addr1).mint(5, { value: vialPrice.mul(5) });
			await expect(bambino.toggleActive()).to.not.be.reverted;
			await expect(vial.setBBContract(bambino.address)).to.not.be.reverted;
			await expect(bambino.burnVialsForBambino([1, 2, 3])).to.not.be.reverted;
			await expect(bambino.connect(addr1).burnVialsForBambino([6, 7, 8, 9, 10]))
				.to.not.be.reverted;

			await expect(bambino.stake([1])).to.not.be.reverted;
			expect(await bambino.ownerOf(1)).to.equal(bambino.address);
			expect(await bambino.ownerOf(2)).to.equal(owner.address);
			expect(await bambino.ownerOf(3)).to.equal(owner.address);
		});

		it("Should correctly stake and ustake", async function () {
			let tokens1 = [1, 2, 3];
			let tokens2 = [6, 7];
			vial.toggleSale();
			vial.mint(5, { value: vialPrice.mul(5) });
			vial.connect(addr1).mint(3, { value: vialPrice.mul(3) });
			vial.connect(addr1).mint(5, { value: vialPrice.mul(5) });
			await expect(bambino.toggleActive()).to.not.be.reverted;
			await expect(vial.setBBContract(bambino.address)).to.not.be.reverted;
			await expect(bambino.burnVialsForBambino(tokens1)).to.not.be.reverted;
			await expect(bambino.connect(addr1).burnVialsForBambino([6, 7, 8, 9, 10]))
				.to.not.be.reverted;

			await expect(bambino.stake(tokens1)).to.not.be.reverted;
			await expect(bambino.connect(addr1).stake(tokens2)).to.not.be.reverted;
			await expect(bambino.setCycleSeed(0, 100)).to.not.be.reverted;
			await expect(
				bambino.startNextCycle(Number(await getBlockTimestamp()) + 10)
			).to.not.be.reverted;

			await advanceTime(time.delta14d);
			await advanceTime(time.delta1m);
			await expect(bambino.setCycleSeed(1, 12)).to.not.be.reverted;

			await expect(
				bambino.startNextCycle(Number(await getBlockTimestamp()) + 10)
			).to.not.be.reverted;
			expect(await bambino.rewardEarned(1, 1)).to.equal(true);
			expect(await bambino.rewardEarned(1, 2)).to.equal(false);
			expect(await bambino.rewardEarned(1, 3)).to.equal(false);
			expect(await bambino.rewardEarned(1, 6)).to.equal(false);
			expect(await bambino.rewardEarned(1, 7)).to.equal(true);

			await expect(box.setApprovedMinter(bambino.address)).to.not.be.reverted;
			await expect(box.togglePaused()).to.not.be.reverted;

			await expect(bambino.claimReward(1)).to.not.be.reverted;
			expect(await bambino.rewardClaimed(1, 1)).to.equal(true);
			expect(await box.balanceOf(owner.address, 1)).to.equal(1);
			expect(await box.circulatingSupply()).to.equal(1);

			await expect(bambino.unstake([6, 7])).to.be.revertedWith(
				"CallerNotOwner()"
			);
			await expect(bambino.connect(addr1).unstake([6, 7])).to.not.be.reverted;
			expect(await box.circulatingSupply()).to.equal(2);
			expect(await box.balanceOf(addr1.address, 2)).to.equal(1);
		});
	});
});
