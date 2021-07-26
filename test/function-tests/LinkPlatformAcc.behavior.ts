import { expect } from "chai";
import { ethers } from "hardhat";
import {
  FACEBOOK_USERNAME,
  FACEBOOK_USERNAME_HASHED,
  PRICING_FACTORS,
  TWITTER_USERNAME_1,
  TWITTER_USERNAME_1_HASHED,
  TWITTER_USERNAME_2,
  TWITTER_USERNAME_2_HASHED,
} from "../constants";
import { getResultFromSetupCreatorWithAccount } from "./SharedFunctions";

export function shouldBehaveLikeLinkPlatformAcc(): void {
  beforeEach(async function () {
    this.creatorSetupResult = await getResultFromSetupCreatorWithAccount(
      this.socialController,
      ...PRICING_FACTORS,
      this.signers.creator1,
    );
    this.creator = await this.socialController.creatorById(this.creatorSetupResult.tokenId);
  });

  it("should throw when the username is already linked", async function () {
    this.socialController = this.socialController.connect(this.signers.creator1);
    await this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId);

    const idOfTwitterUsernameOne = await this.socialController.idByUsername(TWITTER_USERNAME_1_HASHED);
    expect((await this.socialController.creatorById(idOfTwitterUsernameOne)).isCreator).to.be.true;

    await expect(
      this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId),
    ).to.be.revertedWith("This username has been linked to a creator already.");
  });

  it("should throw when token ID is not valid", async function () {
    const invalidTokenId = this.creatorSetupResult.tokenId.add(1);

    expect((await this.socialController.creatorById(invalidTokenId)).isCreator).to.be.false;
    await expect(this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, invalidTokenId)).to.be.revertedWith(
      "This is not a valid token ID.",
    );
  });

  it("should throw when `msg.sender` is not `creator.creatorAddress`", async function () {
    this.socialController = this.socialController.connect(this.signers.creator2);
    await expect(
      this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId),
    ).to.be.revertedWith("You are not qualified to link a new platform account.");
  });

  it("should allow for multiple accounts of same creator to link", async function () {
    this.socialController = this.socialController.connect(this.signers.creator1);

    await this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId);
    await this.socialController.linkPlatformAcc(FACEBOOK_USERNAME, this.creatorSetupResult.tokenId);

    const idFromTwitterUsernameOne = await this.socialController.idByUsername(TWITTER_USERNAME_1_HASHED);
    const idFromFacebookUsername = await this.socialController.idByUsername(FACEBOOK_USERNAME_HASHED);

    expect(idFromTwitterUsernameOne).to.be.eq(idFromFacebookUsername);

    const filters = this.socialController.filters.PlatformAccLinked();
    // need to add fromBlock parameter, or default would be retrieving the most recent event
    let logs = await ethers.provider.getLogs({ ...filters, fromBlock: 0 });
    expect(logs.length).to.be.eq(2);

    // Link one more Twitter account
    await this.socialController.linkPlatformAcc(TWITTER_USERNAME_2, this.creatorSetupResult.tokenId);
    const idFromTwitterUsernameTwo = await this.socialController.idByUsername(TWITTER_USERNAME_2_HASHED);
    expect(idFromTwitterUsernameOne).to.be.eq(idFromTwitterUsernameTwo);

    logs = await ethers.provider.getLogs({ ...filters, fromBlock: 0 });
    expect(logs.length).to.be.eq(3);
  });

  it("should emit PlatformAccLinked event correctly", async function () {
    this.socialController = this.socialController.connect(this.signers.creator1);

    await expect(await this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId))
      .to.emit(this.socialController, "PlatformAccLinked")
      .withArgs(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId);
  });
}
