const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Deploy", function () {
  let nfta, content, owner, addr1, addr2, price;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const NFTA = await ethers.getContractFactory("Container");
    nfta = await NFTA.deploy(owner.address, 10);
    await nfta.deployed();
    content = await ethers.getContractAt("Content", await nfta.NFT());

    price = ethers.utils.parseEther("0.001");
  });

  it("Should set correct owner", async function () {
    expect(await nfta.owner()).to.equal(owner.address);
  });

  it("Should correctly mint and allow claim", async function () {
    nfta.setSaleState(2);
    nfta.mint(1, { value: price });
    expect(await nfta.ownerOf(0)).to.equal(owner.address);
    await expect(nfta.claimContent(0)).to.not.be.reverted;
    console.log(await content.ownerOf(0));
  });
});
