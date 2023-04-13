import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { AccrueInterest as AccrueInterestType } from "../typechain-types/contracts/AccrueInterest";
import { USDT as USDTType } from "../typechain-types/contracts/USDT";
import { CryptoVision as CryptoVisionType } from "../typechain-types/contracts/CryptoVision";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const FOURTY_FIVE_DAYS = ethers.BigNumber.from(String(`${45 * 24 * 60 * 60}`));
const ONE_HUNDRED_EIGHTY_DAYS = ethers.BigNumber.from(
  String(`${180 * 24 * 60 * 60}`)
);
const ONE_HUNDRED_TOKENS = ethers.utils.parseEther("100");

describe("Accrue Interest", function () {
  async function deployAccrueInterest() {
    const [owner, alice, bob, carl] = await ethers.getSigners();

    // Token USDT
    const USDT = await ethers.getContractFactory("USDT");
    const usdt = await USDT.deploy();

    // Token Crypto Vision
    const CryptoVision = await ethers.getContractFactory("CryptoVision");
    const cryptoVision = await CryptoVision.deploy();

    const AccrueInterest = await ethers.getContractFactory("AccrueInterest");
    const accrueInterest = await AccrueInterest.deploy(
      usdt.address,
      cryptoVision.address
    );
    await usdt.transfer(
      accrueInterest.address,
      ethers.utils.parseEther("100000")
    );

    return {
      owner,
      alice,
      bob,
      carl,
      accrueInterest,
      usdt,
      cryptoVision,
    };
  }

  describe("Deposit of 100 USDT", function () {
    var accrueInterest: AccrueInterestType,
      usdt: USDTType,
      cryptoVision: CryptoVisionType,
      owner: SignerWithAddress,
      alice: SignerWithAddress;

    beforeEach(async () => {
      var _loadFixture = await loadFixture(deployAccrueInterest);
      accrueInterest = _loadFixture.accrueInterest;
      usdt = _loadFixture.usdt;
      cryptoVision = _loadFixture.cryptoVision;
      owner = _loadFixture.owner;
      alice = _loadFixture.alice;
      await usdt.transfer(alice.address, ethers.utils.parseEther("100"));
      await usdt
        .connect(alice)
        .approve(accrueInterest.address, ethers.utils.parseEther("100"));
    });

    it("Should have a 100 USDT in 45 days", async function () {
      // get timestamp

      await accrueInterest
        .connect(alice)
        .deposit(ethers.utils.parseEther("100"), true, false);
      var hash = (await accrueInterest.getUserDeposits(alice.address))[0];
      var timestamp = await time.latest();
      var [
        usdtBalance,
        timestampWithdraw,
        timestampDeposit,
        lockUpPeriod,
        boost,
      ] = await accrueInterest.userDeposits(alice.address, hash);
      expect(usdtBalance).to.equal(ethers.utils.parseEther("100"), "100 USDT");
      expect(timestampWithdraw).to.equal(
        FOURTY_FIVE_DAYS.add(timestamp),
        "45 days"
      );
      expect(timestampDeposit).to.equal(timestamp, "timestamp to deposit");
      expect(lockUpPeriod).to.equal(FOURTY_FIVE_DAYS, "wrong lock up period");
      expect(boost).to.equal(false, "wrong boost");
    });

    it("Should have a 100 USDT in 180 days", async function () {
      // alice has cryptovision tokens
      await cryptoVision.transfer(
        alice.address,
        ethers.utils.parseEther("100")
      );

      await accrueInterest
        .connect(alice)
        .deposit(ethers.utils.parseEther("100"), false, true);
      var timestamp = await time.latest();
      var hash = (await accrueInterest.getUserDeposits(alice.address))[0];
      var [
        usdtBalance,
        timestampWithdraw,
        timestampDeposit,
        lockUpPeriod,
        boost,
      ] = await accrueInterest.userDeposits(alice.address, hash);
      expect(usdtBalance).to.equal(ethers.utils.parseEther("100"), "100 USDT");
      expect(timestampWithdraw).to.equal(
        ONE_HUNDRED_EIGHTY_DAYS.add(timestamp),
        "180 days"
      );
      expect(timestampDeposit).to.equal(timestamp, "timestamp to deposit");
      expect(lockUpPeriod).to.equal(
        ONE_HUNDRED_EIGHTY_DAYS,
        "wrong lock up period"
      );
      expect(boost).to.equal(true, "wrong boost");
    });

    it("Only chooses one locking period", async function () {
      await expect(
        accrueInterest.deposit(ethers.utils.parseEther("100"), false, false)
      ).to.be.rejectedWith("Must be one or the other");

      await expect(
        accrueInterest.deposit(ethers.utils.parseEther("100"), true, true)
      ).to.be.rejectedWith("Must be one or the other");
    });

    it("Transfers 100 USDT from owner to contract", async function () {
      var tx = await accrueInterest
        .connect(alice)
        .deposit(ethers.utils.parseEther("100"), true, false);

      await expect(tx).changeTokenBalances(
        usdt,
        [alice.address, accrueInterest.address],
        [ethers.utils.parseEther("-100"), ethers.utils.parseEther("100")]
      );
    });
  });

  describe("Withdraw of 100 USDT", function () {
    var accrueInterest: AccrueInterestType,
      usdt: USDTType,
      cryptoVision: CryptoVisionType,
      owner: SignerWithAddress,
      alice: SignerWithAddress,
      bob: SignerWithAddress,
      carl: SignerWithAddress;

    beforeEach(async () => {
      var _loadFixture = await loadFixture(deployAccrueInterest);
      accrueInterest = _loadFixture.accrueInterest;
      usdt = _loadFixture.usdt;
      cryptoVision = _loadFixture.cryptoVision;
      owner = _loadFixture.owner;
      alice = _loadFixture.alice;
      bob = _loadFixture.bob;
      carl = _loadFixture.carl;

      // alice does not have boost - 45 days
      await usdt.transfer(alice.address, ethers.utils.parseEther("100"));
      await usdt
        .connect(alice)
        .approve(accrueInterest.address, ethers.utils.parseEther("100"));
      await accrueInterest
        .connect(alice)
        .deposit(ethers.utils.parseEther("100"), true, false);

      // bob has boost - 45 days
      await usdt.transfer(bob.address, ethers.utils.parseEther("100"));
      await usdt
        .connect(bob)
        .approve(accrueInterest.address, ethers.utils.parseEther("100"));
      await cryptoVision.transfer(bob.address, ethers.utils.parseEther("100"));
      await accrueInterest
        .connect(bob)
        .deposit(ethers.utils.parseEther("100"), true, false);

      // carl has no boost - 180 days
      await usdt.transfer(carl.address, ethers.utils.parseEther("100"));
      await usdt
        .connect(carl)
        .approve(accrueInterest.address, ethers.utils.parseEther("100"));
      await accrueInterest
        .connect(carl)
        .deposit(ethers.utils.parseEther("100"), false, true);
    });

    it("A user has no balance to withdraw", async function () {
      var anyHash = ethers.utils.solidityKeccak256(
        ["address"],
        [alice.address]
      );
      await expect(
        accrueInterest.connect(alice).withdraw(anyHash)
      ).to.be.rejectedWith("No balance to withdraw");
    });

    it("A user wants to withdraw before time", async function () {
      var hash = (await accrueInterest.getUserDeposits(alice.address))[0];
      await expect(
        accrueInterest.connect(alice).withdraw(hash)
      ).to.be.rejectedWith("Cannot withdraw yet");
    });

    // alice does not have boost - 45 days
    it("Alice withdraws with no boost in 45 days", async function () {
      var hash = (await accrueInterest.getUserDeposits(alice.address))[0];
      await time.increase(FOURTY_FIVE_DAYS);
      var newInterest = ONE_HUNDRED_TOKENS.add(
        ONE_HUNDRED_TOKENS.mul(18).div(100)
      );
      var tx = await accrueInterest.connect(alice).withdraw(hash);
      await expect(tx).changeTokenBalances(
        usdt,
        [alice.address, accrueInterest.address],
        [newInterest, newInterest.mul(-1)]
      );
    });

    // bob has boost - 45 days
    it("Bob withdraws with boost in 45 days", async function () {
      var hash = (await accrueInterest.getUserDeposits(bob.address))[0];
      await time.increase(FOURTY_FIVE_DAYS);
      var newInterest = ONE_HUNDRED_TOKENS.add(
        ONE_HUNDRED_TOKENS.mul(23).div(100)
      );
      var tx = await accrueInterest.connect(bob).withdraw(hash);
      await expect(tx).changeTokenBalances(
        usdt,
        [bob.address, accrueInterest.address],
        [newInterest, newInterest.mul(-1)]
      );
    });

    // carl has no boost - 180 days
    it("Carl withdraws with no boost in 180 days", async function () {
      var hash = (await accrueInterest.getUserDeposits(carl.address))[0];
      await time.increase(ONE_HUNDRED_EIGHTY_DAYS);
      var newInterest = ONE_HUNDRED_TOKENS.add(
        ONE_HUNDRED_TOKENS.mul(48).div(100)
      );
      var tx = await accrueInterest.connect(carl).withdraw(hash);
      await expect(tx).changeTokenBalances(
        usdt,
        [carl.address, accrueInterest.address],
        [newInterest, newInterest.mul(-1)]
      );
    });
  });
});
