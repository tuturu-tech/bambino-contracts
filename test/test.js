const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Deploy", function () {
  let nfta, owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const NFTA = await ethers.getContractFactory("NFTA");
    nfta = await NFTA.deploy();
    await nfta.deployed();
  });

  it("Should set correct owner", async function () {
    expect(await nfta.owner()).to.equal(owner.address);
  });

  it("Should mint correctly", async function () {
    await nfta.mint(1);
    expect(await nfta.ownerOf(0)).to.equal(owner.address);
  });
});
