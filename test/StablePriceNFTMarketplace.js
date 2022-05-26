const { expect } = require("chai");
const { ethers } = require("hardhat");
const { WrapperBuilder } = require("redstone-evm-connector");

describe("StablePriceNFTMarketplace", function () {
  let nftMarketplace, wrappedNftMarketplace, nftContract;

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    const NFTMarketplace = await ethers.getContractFactory(
      "StablePriceNFTMarketplace"
    );
    nftMarketplace = await NFTMarketplace.deploy();
    await nftMarketplace.deployed();

    const NFTContract = await ethers.getContractFactory("MyNFT");
    nftContract = await NFTContract.deploy();
    await nftContract.deployed();

    // Wrap marketplace contract with Redstone Wrapper
    wrappedNftMarketplace = WrapperBuilder.wrapLite(
      nftMarketplace.connect(buyer)
    ).usingPriceFeed("redstone", { asset: "ETH" });

    // Mint one NFT and approve marketplace
    await nftContract.connect(seller).mint();
    await nftContract.connect(seller).approve(nftMarketplace.address, 0);
  });

  describe("Create sell order", function () {
    it("should create sell order with stable USD price", async function () {
      const usdPrice = ethers.utils.parseEther("100");

      await nftMarketplace
        .connect(seller)
        .createSellOrder(nftContract.address, 0, usdPrice);

      expect(await nftContract.ownerOf(0)).to.equal(nftMarketplace.address);
    });

    it("should not create sell order if user set price to 0", async function () {
      const usdPrice = 0;

      await expect(
        nftMarketplace
          .connect(seller)
          .createSellOrder(nftContract.address, 0, usdPrice)
      ).to.be.revertedWith("InvalidPrice");
    });
  });

  describe("Create buy order", function () {
    beforeEach(async function () {
      const usdPrice = ethers.utils.parseEther("100");

      await nftMarketplace
        .connect(seller)
        .createSellOrder(nftContract.address, 0, usdPrice);
    });

    it("should buy NFT if buyer provides enough ETH", async function () {
      const expectedEthAmount = await wrappedNftMarketplace.getPrice(0);

      await wrappedNftMarketplace.createBuyOrder(0, {
        // Buffer for price movements
        value: expectedEthAmount.mul(101).div(100),
      });

      expect(await nftContract.ownerOf(0)).to.equal(buyer.address);
    });

    it("should not buy NFT if order is inactive", async function () {
      await nftMarketplace.connect(seller).cancelSellOrder(0);

      const expectedEthAmount = await wrappedNftMarketplace.getPrice(0);

      await expect(
        wrappedNftMarketplace.createBuyOrder(0, {
          value: expectedEthAmount.mul(101).div(100),
        })
      ).to.be.revertedWith("InactiveOrder");
    });

    it("should not buy NFT if buyer does not provide enough ETH", async function () {
      const expectedEthAmount = await wrappedNftMarketplace.getPrice(0);

      await expect(
        wrappedNftMarketplace.createBuyOrder(0, {
          value: expectedEthAmount.mul(99).div(100),
        })
      ).to.be.revertedWith("InvalidValue");
    });
  });

  describe("Cancel sell order", function () {
    it("should cancel active order if caller is seller", async function () {
      const usdPrice = ethers.utils.parseEther("100");

      await nftMarketplace
        .connect(seller)
        .createSellOrder(nftContract.address, 0, usdPrice);

      await nftMarketplace.connect(seller).cancelSellOrder(0);

      expect(await nftContract.ownerOf(0)).to.equal(seller.address);
    });

    it("should not cancel order if caller is not seller", async function () {
      const usdPrice = ethers.utils.parseEther("100");

      await nftMarketplace
        .connect(seller)
        .createSellOrder(nftContract.address, 0, usdPrice);

      await expect(
        nftMarketplace.connect(buyer).cancelSellOrder(0)
      ).to.be.revertedWith("InvalidCaller");
    });

    it("should not cancel order if order is inactive", async function () {
      const usdPrice = ethers.utils.parseEther("100");

      await nftMarketplace
        .connect(seller)
        .createSellOrder(nftContract.address, 0, usdPrice);

      await nftMarketplace.connect(seller).cancelSellOrder(0);

      await expect(
        nftMarketplace.connect(seller).cancelSellOrder(0)
      ).to.be.revertedWith("InactiveOrder");
    });
  });

  describe("Only owner functions", function () {
    it("should withdraw all funds if caller is owner", async function () {
      const usdPrice = ethers.utils.parseEther("100");

      await nftMarketplace
        .connect(seller)
        .createSellOrder(nftContract.address, 0, usdPrice);

      const expectedEthAmount = await wrappedNftMarketplace.getPrice(0);

      await wrappedNftMarketplace.createBuyOrder(0, {
        value: expectedEthAmount.mul(120).div(100),
      });

      const balanceBefore = await ethers.provider.getBalance(owner.address);

      await nftMarketplace.connect(owner).withdrawAllFunds();

      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(parseInt(balanceAfter)).to.be.greaterThan(parseInt(balanceBefore));
    });
  });
});

// You can use this to print expected amount in nicer format
function logExpectedAmount(amount) {
  console.log(
    `Expected ETH amount: ${ethers.utils.formatEther(amount.toString())}`
  );
}
