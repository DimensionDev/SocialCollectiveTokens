import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { assert, expect } from "chai";
import { BigNumber, ContractFactory } from "ethers";
import hre, { ethers, upgrades } from "hardhat";
import { SocialControllerV11Upgradeable } from "../../typechain";
import { ADDR_STORAGE_PREFIX, IMPL_STORAGE_POSITION, PRICING_FACTORS, TWITTER_USERNAME_1 } from "../constants";
import {
  getBuyPriceAndApproveBuyToken,
  getResultFromSetupCreatorWithAccount,
  getSellPrice,
  scInterface,
} from "./SharedFunctions";

export function shouldBehaveLikeUpgradeContract(): void {
  before("Get upgraded contracts factories", async function () {
    // get upgraded contract factory
    this.SCFactory_v1_1_Upgradeable = await ethers.getContractFactory("SocialController_v1_1_Upgradeable");
    // get non-upgradeable contract factory
    this.SCFactory_v1_1_NonUpgradeable = await ethers.getContractFactory("SocialController_v1_1_NonUpgradeable");
  });

  it("should throw if upgrade is called by non-admin", async function () {
    // Contract factory of SocialController_v1_1_Upgradeable.sol that is signed by this.signers.miscellaneous
    // Not the rightful deployer of the original contract
    const SCFactory_v1_1_Upgradeable_Error: ContractFactory = await ethers.getContractFactory(
      "SocialController_v1_1_Upgradeable",
      this.signers.miscellaneous,
    );

    await expect(upgrades.upgradeProxy(this.socialController, SCFactory_v1_1_Upgradeable_Error)).to.be.revertedWith(
      "caller is not the owner",
    );
  });

  it("should throw if transferOwnership() is called by non-admin", async function () {
    this.socialController = this.socialController.connect(this.signers.miscellaneous);
    await expect(this.socialController.transferOwnership(this.signers.miscellaneous.address)).to.be.revertedWith(
      "caller is not the owner",
    );
  });

  it("SocialController.sol v1.0 should be compatible with the upgraded version after buy", async function () {
    // creator sets up token
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;
    this.creatorSetupResult = await getResultFromSetupCreatorWithAccount(
      this.socialController,
      multipleFactor,
      growthFactor,
      constantFactor,
      this.signers.creator1,
    );
    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);

    // creator links social account
    this.socialController = this.socialController.connect(this.signers.creator1);
    await this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId);

    // buyer buys 10 tokens
    const buyAmount = BigNumber.from(10);
    // approve the DAI spending for the 10 tokens
    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    await getBuyPriceAndApproveBuyToken(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    this.socialController = this.socialController.connect(this.signers.follower1);
    await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount);

    // update creator number of outstanding tokens
    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);
    // check that the buyer owns 10 tokens
    expect(
      await this.socialController.balanceOf(this.signers.follower1.address, this.creatorSetupResult.tokenId),
    ).to.be.eq(buyAmount);

    // upgrade contract
    const SCFactory_v1_1_Upgradeable = <SocialControllerV11Upgradeable>(
      await upgrades.upgradeProxy(this.socialController, this.SCFactory_v1_1_Upgradeable)
    );

    // check that the upgraded contract is compatible with the original by checking the buy amount of buyer
    expect(
      await SCFactory_v1_1_Upgradeable.balanceOf(this.signers.follower1.address, this.creatorSetupResult.tokenId),
    ).to.be.eq(buyAmount);
  });

  it("SocialController.sol v1.0 should be compatible with the upgraded version after sell", async function () {
    // creator sets up token
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;
    this.creatorSetupResult = await getResultFromSetupCreatorWithAccount(
      this.socialController,
      multipleFactor,
      growthFactor,
      constantFactor,
      this.signers.creator1,
    );
    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);

    // creator links social account
    this.socialController = this.socialController.connect(this.signers.creator1);
    await this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId);

    // buyer buys 10 tokens
    const buyAmount = BigNumber.from(10);
    // approve the DAI spending for the 10 tokens
    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    await getBuyPriceAndApproveBuyToken(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    this.socialController = this.socialController.connect(this.signers.follower1);
    await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount);

    // update creator number of outstanding tokens
    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);
    // check that the buyer owns 10 tokens
    expect(
      await this.socialController.balanceOf(this.signers.follower1.address, this.creatorSetupResult.tokenId),
    ).to.be.eq(buyAmount);

    // check that the upgraded contract is compatible with the original by checking the buy amount of buyer
    expect(await this.socialController.balanceOf(this.signers.follower1.address, this.creatorSetupResult.tokenId));

    // sell all tokens
    const totalPrice = getSellPrice(multipleFactor, growthFactor, constantFactor, buyAmount, this);
    await expect(await this.socialController.sellToken(this.creatorSetupResult.tokenId, buyAmount))
      .to.emit(this.socialController, "SellTokenSuccess")
      .withArgs(this.creatorSetupResult.tokenId, buyAmount, totalPrice);

    // upgrade contract
    const SCFactory_v1_1_Upgradeable = <SocialControllerV11Upgradeable>(
      await upgrades.upgradeProxy(this.socialController, this.SCFactory_v1_1_Upgradeable)
    );

    expect(
      await SCFactory_v1_1_Upgradeable.balanceOf(this.signers.follower1.address, this.creatorSetupResult.tokenId),
    ).to.be.eq(0);
  });

  it("should allow upgrading after change of proxy owner", async function () {
    // setup creator details
    const { tokenId } = await getResultFromSetupCreatorWithAccount(
      this.socialController,
      ...PRICING_FACTORS,
      this.signers.creator1,
    );

    // change admin
    const newAdmin = this.signers.miscellaneous;
    this.socialController = this.socialController.connect(this.signers.admin);
    await this.socialController.transferOwnership(newAdmin.address);

    // attempt to upgrade proxy with previous admin
    const SCFactory_v1_1_Upgradeable_PreviousAdmin: ContractFactory = await ethers.getContractFactory(
      "SocialController_v1_1_Upgradeable",
      this.signers.admin,
    );
    await expect(
      upgrades.upgradeProxy(this.socialController, SCFactory_v1_1_Upgradeable_PreviousAdmin),
    ).to.be.revertedWith("caller is not the owner");

    const logsPreviousAdminUpgrade = await ethers.provider.getLogs(this.socialController.filters.Upgraded());
    expect(logsPreviousAdminUpgrade.length).to.be.eq(0);

    // upgrade proxy with new admin
    const SCFactory_v1_1_Upgradeable_NewAdmin: ContractFactory = await ethers.getContractFactory(
      "SocialController_v1_1_Upgradeable",
      newAdmin,
    );

    let SCFactory_v1_1_Upgradeable = <SocialControllerV11Upgradeable>(
      await upgrades.upgradeProxy(this.socialController, SCFactory_v1_1_Upgradeable_NewAdmin)
    );

    // check if Upgraded event is emitted
    const logsNewAdminUpgrade = await ethers.provider.getLogs(this.socialController.filters.Upgraded());
    expect(logsNewAdminUpgrade.length).to.be.eq(1);

    const resultAfterNewAdminUpgrade = scInterface.parseLog(logsNewAdminUpgrade[0]);
    const implAddress = await getImplementationAddress(hre.network.provider, SCFactory_v1_1_Upgradeable.address);
    expect(resultAfterNewAdminUpgrade.args.implementation).to.be.eq(implAddress);

    // check implementation address saved in proxy storage
    const implAddressInStorage = await ethers.provider.getStorageAt(
      SCFactory_v1_1_Upgradeable.address,
      IMPL_STORAGE_POSITION,
    );
    expect(resultAfterNewAdminUpgrade.args.implementation.toLowerCase()).to.be.eq(
      "0x" + implAddressInStorage.substring(ADDR_STORAGE_PREFIX.length),
    );

    // check if proxy is upgraded by calling new deleteCreator()
    SCFactory_v1_1_Upgradeable = SCFactory_v1_1_Upgradeable.connect(this.signers.creator1);
    await expect(await SCFactory_v1_1_Upgradeable.deleteCreator(tokenId)) // replace token id
      .to.emit(SCFactory_v1_1_Upgradeable, "CreatorDeleted")
      .withArgs(tokenId);
  });

  it("should disallow the upgrade of an incompatible contract", async function () {
    // using try/catch instead of .revertedWith() as error messages from OZ upgrades error library are formatted w/multiline strings + chalk npm package
    try {
      // Upgrading to an incompatible contract (that has state variables latestId and idByUsername switched around)
      await upgrades.upgradeProxy(this.socialController, this.SCFactory_v1_1_NonUpgradeable);
    } catch (e) {
      assert(e.message.includes("New storage layout is incompatible"));
      // Error due to --> SocialController: Deleted `latestId`
      assert(e.message.includes("Keep the variable even if unused"));
      // Error due to --> contracts/test/SocialController_v1_1_NonUpgradeable.sol:48: Inserted `latestId`
      assert(e.message.includes("New variables should be placed after all existing inherited variables"));
    }
  });
}
