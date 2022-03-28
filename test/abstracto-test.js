const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber, utils } = require("ethers");
const {
  centerTime,
  getBlockTimestamp,
  jumpToTime,
  advanceTime,
} = require("../scripts/utilities/utility.js");

const BN = BigNumber.from;
var time = centerTime();

const getPrice = async (
  decrementAmount,
  auctionStart,
  decrementInterval,
  startingPrice,
  minimumPrice
) => {
  let price;
  let timestamp = await getBlockTimestamp();
  let decrement = decrementAmount.mul(
    Math.floor((timestamp - auctionStart) / decrementInterval)
  );
  if (decrement >= startingPrice - minimumPrice) {
    price = minimumPrice;
  } else {
    price = startingPrice - decrement;
  }

  return BN(price);
};

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe("Deploy", function () {
  let nft, owner, addr1, addr2;
  let decrementAmount,
    auctionStart,
    decrementInterval,
    startingPrice,
    minimumPrice;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("Abstracto");
    nft = await NFT.deploy("hidden", owner.address);
    await nft.deployed();

    decrementAmount = await nft.decrementAmount();
    decrementInterval = await nft.decrementInterval();
    startingPrice = await nft.startingPrice();
    minimumPrice = await nft.minimumPrice();
  });

  it("Should set correct owner", async function () {
    expect(await nft.owner()).to.equal(owner.address);
  });

  it("Should mint correctly", async function () {
    await nft.startAuction();
    auctionStart = await nft.auctionStart();
    let price = await nft.getCurrentPrice();
    await expect(nft.mint(1)).to.be.revertedWith("PRICE: VALUE_TOO_LOW");
    await expect(nft.mint(1, { value: price })).to.not.be.reverted;
    expect(await nft.ownerOf(0)).to.equal(owner.address);
  });

  it("Should decrement price correctly", async function () {
    await nft.startAuction();
    auctionStart = await nft.auctionStart();
    let price = await nft.getCurrentPrice();
    expect(price).to.equal(utils.parseEther("5"));
    await advanceTime(time.delta5m);
    price = await nft.getCurrentPrice();
    expect(price).to.equal(utils.parseEther("4.8"));

    await advanceTime(time.delta3m);
    price = await nft.getCurrentPrice();
    expect(price).to.equal(utils.parseEther("4.8"));
    await advanceTime(time.delta2m);
    price = await nft.getCurrentPrice();
    expect(price).to.equal(utils.parseEther("4.6"));
    await advanceTime(time.delta1h);
    price = await nft.getCurrentPrice();
    expect(price).to.equal(utils.parseEther("2.2"));
    await advanceTime(time.delta50m);
    price = await nft.getCurrentPrice();
    expect(price).to.equal(utils.parseEther("0.2"));
    await advanceTime(time.delta50m);
    price = await nft.getCurrentPrice();
    expect(price).to.equal(utils.parseEther("0.2"));
  });

  it("Should set decrement function correctly", async function () {
    let maxPrice = utils.parseEther("10");
    let minPrice = utils.parseEther("1");
    let decAmount = utils.parseEther("0.5");
    await nft.setDecrementFunction(maxPrice, minPrice, 60 * 10, decAmount);
    await nft.startAuction();
    auctionStart = await nft.auctionStart();
    let price = await nft.getCurrentPrice();
    expect(price).to.equal(maxPrice);

    for (let i = 1; i <= 18; i++) {
      await advanceTime(time.delta10m);
      price = await nft.getCurrentPrice();
      expect(price).to.equal(maxPrice.sub(decAmount.mul(i)));
    }
  });

  it("Should correctly limit mint", async function () {
    await expect(
      nft.mint(1, { value: utils.parseEther("5") })
    ).to.be.revertedWith("SALE_NOT_STARTED");

    await nft.startAuction();
    let price = await nft.getCurrentPrice();
    await expect(nft.mint(11, { value: price.mul(11) })).to.be.revertedWith(
      "ERC721A: quantity to mint too high"
    );
    await expect(nft.mint(10, { value: price.mul(9) })).to.be.revertedWith(
      "PRICE: VALUE_TOO_LOW"
    );
    await expect(nft.mint(10, { value: price.mul(9) })).to.be.revertedWith(
      "PRICE: VALUE_TOO_LOW"
    );
    await expect(nft.mint(10, { value: price.mul(10) })).to.not.be.reverted;
    await expect(nft.mint(10, { value: price.mul(10) })).to.not.be.reverted;
    await expect(nft.mint(1, { value: price.mul(1) })).to.be.revertedWith(
      "EXCEDEED_MAX_MINT"
    );
    await nft.setMaxMint(1001);
    for (let i = 0; i < 98; i++) {
      await expect(nft.mint(10, { value: price.mul(10) })).to.not.be.reverted;
    }
    await expect(nft.mint(1, { value: price.mul(1) })).to.be.revertedWith(
      "MAX_SUPPLY_REACHED"
    );
    expect(await nft.totalSupply()).to.equal(1000);
  });

  it("Should correctly airdrop tokens", async function () {
    await expect(nft.airdrop(addr1.address, 10)).to.not.be.reverted;
    expect(await nft.balanceOf(addr1.address)).to.equal(10);
    expect(await nft.ownerOf(9)).to.equal(addr1.address);
  });

  it("Should withdraw properly", async function () {
    await nft.startAuction();
    let price = await nft.getCurrentPrice();
    await nft.connect(addr1).mint(10, { value: price.mul(10) });
    let prevBalance = await ethers.provider.getBalance(owner.address);
    await expect(nft.withdraw()).to.not.be.reverted;
    let expectedBalance = prevBalance.add(price.mul(10));
    let actual = await ethers.provider.getBalance(owner.address);
    //expect(actual).to.equal(expectedBalance);
    console.log(
      "prev",
      prevBalance.toString(),
      "expected",
      expectedBalance.toString(),
      "actual",
      actual.toString()
    );
  });
});
