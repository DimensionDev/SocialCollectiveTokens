import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chalk from "chalk";
import { config as dotenvConfig } from "dotenv";
import { BigNumber, Contract } from "ethers";
import { Interface } from "ethers/lib/utils";
import hre, { ethers, upgrades } from "hardhat";
import { resolve } from "path";
import * as daiContractAbi from "../artifacts/contracts/interfaces/IDai.sol/IDai.json";
import * as scJsonABI from "../artifacts/contracts/SocialController.sol/SocialController.json";
import { IDai, SocialController, SocialController__factory } from "../typechain";
import { CreatorDetails, CreatorSetupResult, Signers } from "../types";
import {
  shouldBehaveLikeBuyToken,
  shouldBehaveLikeLinkPlatformAcc,
  shouldBehaveLikeSellToken,
  shouldBehaveLikeSetupCreator,
  shouldBehaveLikeUpdateCreatorAddress,
  shouldBehaveLikeUpdateUsername,
  shouldBehaveLikeUpgradeContract,
} from "./";
import { DAI_HOLDER_ADDRESS_1, DAI_MAINNET_ADDRESS, DAI_TRANSFER_AMOUNT } from "./constants";
import * as helper from "./helper";

dotenvConfig({ path: resolve(__dirname, "../.env") });

let snapshotId: number;

let SocialControllerContract: SocialController__factory;
let SocialControllerContractProxy: Contract;
let socialControllerContractDeployed: Contract;

describe("SocialController", function () {
  before(async function () {
    this.signers = <Signers>{};
    this.creatorDetails = <CreatorDetails>{}; // the Creator struct (e.g. factors, address, isCreator)
    this.creatorSetupResult = <CreatorSetupResult>{}; // topics of CreatorSetupSuccess event

    const signers: SignerWithAddress[] = await hre.ethers.getSigners();

    // Roles are:
    // 1. Admin (deployer of contract),
    // 2. Creator (creator of personal social token),
    // 3. Follower (buyer or seller of social token)
    this.signers.admin = signers[0];
    this.signers.creator1 = signers[1];
    this.signers.creator2 = signers[2];
    this.signers.creator3 = signers[3];
    this.signers.follower1 = signers[4];
    this.signers.follower2 = signers[5];
    this.signers.follower3 = signers[6];
    this.signers.miscellaneous = signers[7];

    // Get DAI interface
    this.daiMainnetContract = <IDai>await ethers.getContractAt("IDai", DAI_MAINNET_ADDRESS);

    // For impersonating DAI_HOLDER_ADDRESS_1
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DAI_HOLDER_ADDRESS_1],
    });

    // To distribute DAI holder's DAI to buyers (currently just this.signers.follower1)
    const daiMainnetSigner = ethers.provider.getSigner(DAI_HOLDER_ADDRESS_1);
    this.daiMainnetSigner = daiMainnetSigner;

    const iface = new Interface(daiContractAbi.abi);

    // TODO: this approval may not be needed - a transfer() may still work without it
    const encodedApproveFunctionData = iface.encodeFunctionData("approve", [
      this.signers.follower1.address,
      BigNumber.from(DAI_TRANSFER_AMOUNT),
    ]);

    // For DAI contract to approve allowance from `DAI_HOLDER_ADDRESS_1` to `this.signers.follower1.address`
    await daiMainnetSigner.sendTransaction({
      to: DAI_MAINNET_ADDRESS,
      data: encodedApproveFunctionData,
    });

    const encodedTransferFunctionData = iface.encodeFunctionData("transfer", [
      this.signers.follower1.address,
      BigNumber.from(DAI_TRANSFER_AMOUNT),
    ]);

    // For DAI contract to transfer DAI from `DAI_HOLDER_ADDRESS_1` to `this.signers.follower1.address`
    await daiMainnetSigner.sendTransaction({
      to: DAI_MAINNET_ADDRESS,
      data: encodedTransferFunctionData,
    });

    // Deploy SocialController.sol
    SocialControllerContract = await ethers.getContractFactory("SocialController");
    SocialControllerContractProxy = await upgrades.deployProxy(SocialControllerContract, { kind: "uups" });
    // TODO: Why do we need an extra contract here? This might not be needed? // it doesn't make any difference to the test cases
    // ? Is it because the creator of the contract can be set as the 3rd parameter?
    socialControllerContractDeployed = new ethers.Contract(
      SocialControllerContractProxy.address,
      scJsonABI.abi,
      this.signers.admin,
    );

    console.log(chalk.bgGreenBright.black.bold("DEPLOYER ADDRESS:", this.signers.admin.address));
    console.log(chalk.bgBlueBright.black.bold("PROXY ADDRESS:", socialControllerContractDeployed.address));

    // this.socialController = <SocialController>SocialControllerContractProxy;
    this.socialController = <SocialController>socialControllerContractDeployed;
  });

  beforeEach(async function () {
    snapshotId = await helper.takeSnapshot();
  });

  afterEach(async function () {
    await helper.revertToSnapShot(snapshotId);
  });

  describe("setupCreator()", function () {
    shouldBehaveLikeSetupCreator();
  });

  describe("linkPlatformAcc()", function () {
    shouldBehaveLikeLinkPlatformAcc();
  });

  describe("updateCreatorAddress()", function () {
    shouldBehaveLikeUpdateCreatorAddress();
  });

  describe("updateUsername()", function () {
    shouldBehaveLikeUpdateUsername();
  });

  describe("buyToken()", function () {
    shouldBehaveLikeBuyToken();
  });

  describe("sellToken()", function () {
    shouldBehaveLikeSellToken();
  });

  describe("Upgrading contracts", function () {
    shouldBehaveLikeUpgradeContract();
  });
});
