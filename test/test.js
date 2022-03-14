const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Deploy", function () {
  let nfta, owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    maxSupply = 10000;
    totalReserved = 500;
    maxBuy = 10;
    priceWL = ethers.utils.parseEther("0.05");
    pricePS = ethers.utils.parseEther("0.1");
    const NFTA = await ethers.getContractFactory("NFTA");
    nfta = await NFTA.deploy(
      maxSupply,
      totalReserved,
      maxBuy,
      maxBuy,
      priceWL,
      pricePS,
      owner.address
    );
    await nfta.deployed();
  });

  it("Should set correct owner", async function () {
    expect(await nfta.owner()).to.equal(owner.address);
  });

  it("Should mint correctly", async function () {
    await nfta.setSaleState(2);
    await nfta.mint(1, { value: ethers.utils.parseEther("0.1") });
    expect(await nfta.ownerOf(0)).to.equal(owner.address);
  });

  it("Should correctly check signature", async function () {
    let signature = await owner.signMessage(
      ethers.utils.arrayify(
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address"],
            [nfta.address, addr1.address]
          )
        )
      )
    );
    expect(await nfta.connect(addr1).isValidSignature(signature)).to.equal(
      owner.address
    );
  });
});
