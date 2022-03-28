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
    await nfta.setSaleState(3);
    let priceGenesis = await nfta.priceGenesis();
    let priceWL = await nfta.priceWL();
    let pricePS = await nfta.pricePS();
    await nfta.mint(1, { value: pricePS });
    expect(await nfta.ownerOf(0)).to.equal(owner.address);
    await expect(nfta.mint(3, { value: pricePS.mul(3) })).to.be.revertedWith(
      "MAX_MINT: AMOUNT_TOO_HIGH"
    );

    await nfta.setSaleState(2);
    await expect(nfta.mint(1, { value: pricePS })).to.be.revertedWith(
      "WRONG_SALE_STATE"
    );
    await expect(nfta.mint(1, { value: pricePS.sub(1) })).to.be.revertedWith(
      "PRICE: VALUE_TOO_LOW"
    );

    let signature = signWhitelist(owner, nfta.address, owner.address, 2, 1);

    /* let signature = await owner.signMessage(
      ethers.utils.arrayify(
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "address"],
            [nfta.address, 2, 1, owner.address]
          )
        )
      )
    ); */

    await expect(
      nfta.whitelistMint(signature, 2, 1, { value: priceWL.mul(2) })
    ).to.be.revertedWith("MAX_MINT: AMOUNT_TOO_HIGH");
    await expect(
      nfta.whitelistMint(signature, 1, 2, { value: priceWL.mul(2) })
    ).to.be.revertedWith("INCORRECT_SIGNATURE");
    await expect(nfta.whitelistMint(signature, 1, 1, { value: priceWL })).to.not
      .be.reverted;
    expect(await nfta.ownerOf(1)).to.equal(owner.address);

    signature = signWhitelist(owner, nfta.address, addr1.address, 1, 3);

    await expect(
      nfta.genesisMint(signature, 4, 4, { value: priceGenesis.mul(4) })
    ).to.be.revertedWith("WRONG_SALE_STATE");
    await nfta.setSaleState(1);
    await expect(
      nfta.genesisMint(signature, 4, 4, { value: priceGenesis.mul(4) })
    ).to.be.revertedWith("INCORRECT_SIGNATURE");
    await expect(
      nfta.genesisMint(signature, 2, 3, { value: priceGenesis.mul(2) })
    ).to.be.revertedWith("INCORRECT_SIGNATURE");
    await expect(
      nfta
        .connect(addr1)
        .genesisMint(signature, 2, 3, { value: priceGenesis.mul(2) })
    ).to.not.be.reverted;
    expect(await nfta.ownerOf(2)).to.equal(addr1.address);
    expect(await nfta.ownerOf(3)).to.equal(addr1.address);
    await expect(
      nfta
        .connect(addr1)
        .genesisMint(signature, 2, 3, { value: priceGenesis.mul(2) })
    ).to.be.revertedWith("MAX_MINT: AMOUNT_TOO_HIGH");
  });

  it("Should correctly limit supply", async function () {
    await nfta.setSaleState(3);
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
      nfta.connect(addr1).airdrop(owner.address, 2)
    ).to.be.revertedWith("NOT_IN_TEAM");

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

  it("Should correctly limit airdrop", async function () {
    await expect(nfta.airdrop(owner.address, 300)).to.not.be.reverted;
    await expect(nfta.airdrop(owner.address, 1)).to.be.revertedWith(
      "OVER_RESERVE"
    );
  });

  it("Should correctly limit airdrop batch", async function () {
    await expect(
      nfta.airdropBatch([owner.address, addr1.address, addr2.address], 100)
    ).to.not.be.reverted;
    await expect(nfta.airdropBatch([owner.address], 1)).to.be.revertedWith(
      "OVER_RESERVE"
    );
  });

  it("Should correctly limit admin functions", async function () {
    await expect(
      nfta.connect(addr1).setPricePS(ethers.utils.parseEther("1"))
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      nfta.connect(addr1).setPriceWL(ethers.utils.parseEther("1"))
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      nfta.connect(addr1).setPriceGenesis(ethers.utils.parseEther("1"))
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      nfta.connect(addr1).setTeam(addr1.address, true)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(nfta.connect(addr1).setMaxMint(1)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(
      nfta.connect(addr1).setSignerAddress(addr1.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(nfta.connect(addr1).setBaseURI("test")).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(
      nfta.connect(addr1).setUnrevealedURI("test")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(nfta.connect(addr1).setRevealTime(1000)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(nfta.connect(addr1).setSaleState(1)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(
      nfta.connect(addr1).setWithdrawalAddress(addr1.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(nfta.connect(addr1).withdraw()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Should correctly use admin functions", async function () {
    let price = ethers.utils.parseEther("1");
    await expect(nfta.setPricePS(price)).to.not.be.reverted;
    await expect(nfta.setPriceWL(price)).to.not.be.reverted;
    await expect(nfta.setPriceGenesis(price)).to.not.be.reverted;

    expect(await nfta.pricePS()).to.equal(price);
    expect(await nfta.priceWL()).to.equal(price);
    expect(await nfta.priceGenesis()).to.equal(price);

    await expect(nfta.setTeam(addr1.address, true)).to.not.be.reverted;
    expect(await nfta.isTeam(addr1.address)).to.equal(true);
    await expect(nfta.setTeam(addr1.address, true)).to.be.revertedWith(
      "NO_CHANGE"
    );

    await expect(nfta.setMaxMint(1)).to.not.be.reverted;
    expect(await nfta.maxMint()).to.equal(1);
    await expect(nfta.setMaxMint(0)).to.be.revertedWith("AMOUNT_TOO_LOW");

    await expect(nfta.setSignerAddress(addr1.address)).to.not.be.reverted;
    await expect(nfta.setBaseURI("test")).to.not.be.reverted;
    await expect(nfta.setUnrevealedURI("test")).to.not.be.reverted;
    expect(await nfta.baseURI()).to.equal("test");
    expect(await nfta.unrevealedURI()).to.equal("test");

    await expect(nfta.setRevealTime(1000)).to.not.be.reverted;
    expect(await nfta.revealTime()).to.equal(1000);
    await expect(nfta.setSaleState(1)).to.not.be.reverted;
    expect(await nfta.saleState()).to.equal(1);
    await expect(nfta.setWithdrawalAddress(addr1.address)).to.not.be.reverted;
    expect(await nfta.withdrawalAddress()).to.equal(addr1.address);

    await expect(nfta.withdraw()).to.not.be.reverted;
  });

  it("Should correctly reveal/unreveal", async function () {
    await nfta.setSaleState(3);
    let pricePS = await nfta.pricePS();
    await nfta.mint(1, { value: pricePS });
    await expect(nfta.setUnrevealedURI("test")).to.not.be.reverted;
    expect(await nfta.unrevealedURI()).to.equal("test");

    expect(await nfta.tokenURI(0)).to.equal("test");
    await expect(nfta.setBaseURI("base/")).to.not.be.reverted;
    expect(await nfta.tokenURI(0)).to.equal("base/0.json");
    await expect(nfta.setRevealTime(10000000000));
    expect(await nfta.tokenURI(0)).to.equal("test");
  });

  it("Should correctly withdraw", async function () {
    await nfta.setSaleState(3);
    let pricePS = await nfta.pricePS();
    await nfta.mint(1, { value: pricePS });

    expect(await waffle.provider.getBalance(nfta.address)).to.equal(pricePS);
    await expect(nfta.setWithdrawalAddress(addr1.address)).to.not.be.reverted;
    let prevBalance = await waffle.provider.getBalance(addr1.address);
    await expect(nfta.withdraw()).to.not.be.reverted;
    let newBalance = await waffle.provider.getBalance(addr1.address);
    expect(newBalance).to.equal(prevBalance.add(pricePS));
    expect(await waffle.provider.getBalance(nfta.address)).to.equal(0);
  });

  it("Should correctly check signature", async function () {
    let signature = await owner.signMessage(
      ethers.utils.arrayify(
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "address"],
            [nfta.address, 1, 1, owner.address]
          )
        )
      )
    );
    expect(
      await nfta.connect(owner).isValidSignature(signature, 1, 1)
    ).to.equal(owner.address);
    expect(
      await nfta.connect(owner).isValidSignature(signature, 1, 2)
    ).to.not.equal(owner.address);
  });
});
