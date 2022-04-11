const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

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

    vialMaxSupply = vial.maxSupply();
    vialPrice = vial.price();
    vialMaxMint = vial.maxMint();
  });

  it("Should set correct owner", async function () {
    expect(await vial.owner()).to.equal(owner.address);
    expect(await box.owner()).to.equal(owner.address);
    expect(await bambino.owner()).to.equal(owner.address);
  });

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
  });

  it.only("Should correctly limit minting", async function () {
    await expect(vial.mint(5, { value: vialPrice.mul(5) })).to.be.revertedWith(
      "something"
    );
  });
});
