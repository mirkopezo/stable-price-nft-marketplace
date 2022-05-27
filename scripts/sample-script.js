const { ethers } = require("hardhat");

async function main() {
  const NFTMarketplace = await ethers.getContractFactory(
    "StablePriceNFTMarketplace"
  );
  const nftMarketplace = await NFTMarketplace.deploy();
  await nftMarketplace.deployed();

  console.log("StablePriceNFTMarketplace deployed to:", nftMarketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
