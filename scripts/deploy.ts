import hre from "hardhat";
const { ethers } = hre;

async function main() {
  console.log("Deploying CoinBinRouter to Base Network...");

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  console.log("Deploying contracts with the account:", deployer.address);
  
  const initialFeeRecipient = deployer.address;

  const ContractFactory = await ethers.getContractFactory("CoinBinRouter");
  const router = await ContractFactory.deploy(initialFeeRecipient);

  await router.waitForDeployment();
  const address = await router.getAddress();

  console.log("✅ CoinBinRouter deployed successfully to:", address);
  console.log("Please save this address and add it to your NextJS frontend configuration!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
