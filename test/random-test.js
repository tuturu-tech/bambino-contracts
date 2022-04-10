const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

const getRand = (max) => {
  return Math.floor(Math.random() * max);
};

describe.only("Deploy", function () {
  let nfta, owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    nfta = await hre.ethers.getContractAt(
      "VRFv2Consumer",
      "0xb460C88D85b95DbFF2C5dD6c33e0b96970976382"
    );
  });

  it("Should have an 25% chance to win", async function () {
    let arr = [];
    let used = [];
    let num = await nfta.getNumber(0);

    console.log(num);

    for (let i = 0; i < 300; ) {
      let rand = getRand(8000);
      if (!used.includes(rand)) {
        let number = await nfta.getNumber(rand);
        console.log(i, number);
        arr.push(number);
        used.push(rand);
        i++;
      }
    }

    let zeros = arr.filter((n) => n == 0);
    let ones = arr.filter((n) => n == 1);
    let twos = arr.filter((n) => n == 2);
    let threes = arr.filter((n) => n == 3);

    console.log("zeros:", zeros.length, (zeros.length / 300) * 100);
    console.log("ones:", ones.length, (ones.length / 300) * 100);
    console.log("twos:", twos.length, (twos.length / 300) * 100);
    console.log("threes:", threes.length, (threes.length / 300) * 100);
  });
});
