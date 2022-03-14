const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Deploy", function () {
  let nfta, owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const NFTA = await ethers.getContractFactory("BabyBoss");
    nfta = await NFTA.deploy(owner.address, 1000);
    await nfta.deployed();
  });

  it("Should set correct owner", async function () {
    expect(await nfta.owner()).to.equal(owner.address);
  });

  it("Should mint correctly", async function () {
    await nfta.setSaleState(2);
    let priceWL = await nfta.priceWL();
    let pricePS = await nfta.pricePS();
    await nfta.mint(1, { value: pricePS });
    expect(await nfta.ownerOf(0)).to.equal(owner.address);
    await expect(nfta.mint(3, { value: pricePS.mul(3) })).to.be.revertedWith(
      "MAX_MINT: AMOUNT_TOO_HIGH"
    );

    await nfta.setSaleState(1);
    await expect(nfta.mint(1, { value: pricePS })).to.be.revertedWith(
      "WRONG_SALE_STATE"
    );
    await expect(nfta.mint(1, { value: pricePS.sub(1) })).to.be.revertedWith(
      "PRICE: VALUE_TOO_LOW"
    );

    let signature = await owner.signMessage(
      ethers.utils.arrayify(
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "address"],
            [nfta.address, 1, owner.address]
          )
        )
      )
    );

    await expect(
      nfta.whitelistMint(signature, 2, 1, { value: priceWL.mul(2) })
    ).to.be.revertedWith("MAX_MINT: AMOUNT_TOO_HIGH");
    await expect(
      nfta.whitelistMint(signature, 1, 2, { value: priceWL.mul(2) })
    ).to.be.revertedWith("INCORRECT_SIGNATURE");
    await expect(nfta.whitelistMint(signature, 1, 1, { value: priceWL })).to.not
      .be.reverted;
    expect(await nfta.ownerOf(1)).to.equal(owner.address);
  });

  it("Should correctly limit supply", async function () {
    await nfta.setSaleState(2);
    let priceWL = await nfta.priceWL();
    let pricePS = await nfta.pricePS();
    let totalSupply = await nfta.totalSupply();
    let maxSupply = await nfta.maxSupply();
    let reserved = await nfta.reserved();
    let publicLimit = 3999 - reserved;
    let mint = 1000;

    await nfta.setMaxMint(10000);

    await expect(nfta.airdrop(owner.address, reserved + 1)).to.be.revertedWith(
      "OVER_RESERVE"
    );

    while (Number(totalSupply) < publicLimit) {
      if (publicLimit - totalSupply < 1000) {
        mint = publicLimit - totalSupply;
      }
      await nfta.mint(mint, { value: pricePS.mul(mint) });
      totalSupply = await nfta.totalSupply();
      console.log(
        "minted",
        mint,
        "supply:",
        totalSupply.toString(),
        "limit",
        publicLimit
      );
    }
    await expect(nfta.mint(1, { value: pricePS })).to.be.revertedWith(
      "MAX_SUPPLY: AMOUNT_TOO_HIGH"
    );

    await expect(nfta.airdrop(owner.address, reserved + 1)).to.be.revertedWith(
      "MAX_SUPPLY: AMOUNT_TOO_HIGH"
    );
    await expect(nfta.airdrop(owner.address, reserved)).to.not.be.reverted;
  });

  it("Should correctly aidrop", async function () {
    await expect(nfta.airdrop(owner.address, 2)).to.not.be.reverted;
    expect(await nfta.ownerOf(0)).to.equal(owner.address);
    expect(await nfta.ownerOf(1)).to.equal(owner.address);

    await expect(
      nfta.airdropBatch([owner.address, addr1.address, addr2.address], 1)
    );
    expect(await nfta.ownerOf(2)).to.equal(owner.address);
    expect(await nfta.ownerOf(3)).to.equal(addr1.address);
    expect(await nfta.ownerOf(4)).to.equal(addr2.address);

    await expect(
      nfta.airdropBatch([owner.address, addr1.address, addr2.address], 2)
    );

    expect(await nfta.ownerOf(5)).to.equal(owner.address);
    expect(await nfta.ownerOf(6)).to.equal(owner.address);
    expect(await nfta.ownerOf(7)).to.equal(addr1.address);
    expect(await nfta.ownerOf(8)).to.equal(addr1.address);
    expect(await nfta.ownerOf(9)).to.equal(addr2.address);
    expect(await nfta.ownerOf(10)).to.equal(addr2.address);
  });

  it("Should correctly check signature", async function () {
    let signature = await owner.signMessage(
      ethers.utils.arrayify(
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "address"],
            [nfta.address, 1, owner.address]
          )
        )
      )
    );
    expect(await nfta.connect(owner).isValidSignature(signature, 1)).to.equal(
      owner.address
    );
    expect(
      await nfta.connect(owner).isValidSignature(signature, 2)
    ).to.not.equal(owner.address);
  });
});
