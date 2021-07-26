import { expect } from "chai";
import { BigNumber } from "ethers";
import { FACEBOOK_USERNAME, PRICING_FACTORS, TWITTER_USERNAME_1, TWITTER_USERNAME_1_HASHED } from "../constants";
import { getBuyPriceAndApproveBuyToken, getResultFromSetupCreatorWithAccount, getSellPrice } from "./SharedFunctions";

export function shouldBehaveLikeUpdateCreatorAddress(): void {
  beforeEach(async function () {
    this.creatorSetupResult = await getResultFromSetupCreatorWithAccount(
      this.socialController,
      ...PRICING_FACTORS,
      this.signers.creator1,
    );
    this.socialController = this.socialController.connect(this.signers.creator1);
    await this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId);
  });

  it("should throw if username does not exist", async function () {
    await expect(
      this.socialController.updateCreatorAddress(this.signers.creator2.address, FACEBOOK_USERNAME),
    ).to.be.revertedWith("This username has not been linked to a creator.");
  });

  it("should throw if `msg.sender` does not match the creator's address", async function () {
    this.socialController = this.socialController.connect(this.signers.creator2);
    await expect(
      this.socialController.updateCreatorAddress(this.signers.creator3.address, TWITTER_USERNAME_1),
    ).to.be.revertedWith("You're not qualified to change this creator's address.");
  });

  it("should throw if the new address is the current one", async function () {
    await expect(
      this.socialController.updateCreatorAddress(this.signers.creator1.address, TWITTER_USERNAME_1),
    ).to.be.revertedWith("Your address remains the same.");
  });

  it("should emit CreatorAddressUpdated event correctly", async function () {
    await expect(await this.socialController.updateCreatorAddress(this.signers.creator2.address, TWITTER_USERNAME_1))
      .to.emit(this.socialController, "CreatorAddressUpdated")
      .withArgs(TWITTER_USERNAME_1, this.signers.creator2.address, this.signers.creator1.address);

    const id = await this.socialController.idByUsername(TWITTER_USERNAME_1_HASHED);
    expect((await this.socialController.creatorById(id)).creatorAddress).to.be.eq(this.signers.creator2.address);
  });

  it("should allow selling of tokens after the updating of creator's address", async function () {
    // get follower1 initial balance
    const initialFollowerDaiBalance = await this.daiMainnetContract.callStatic.balanceOf(
      this.signers.follower1.address,
    );

    // connect to follower1 and buy 3 creator tokens
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;
    const buyAmount = BigNumber.from(3);

    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);

    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    this.originalFollowerDaiBalance = await this.daiMainnetContract.callStatic.balanceOf(
      this.signers.follower1.address,
    );
    await getBuyPriceAndApproveBuyToken(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    this.socialController = this.socialController.connect(this.signers.follower1);

    // Update creatorDetails with new oustanding num of tokens
    await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount);

    // creator updates address
    this.socialController = this.socialController.connect(this.signers.creator1);
    await this.socialController.updateCreatorAddress(this.signers.creator2.address, TWITTER_USERNAME_1);

    // get creator token ID by username
    const tokenId = await this.socialController.idByUsername(TWITTER_USERNAME_1_HASHED);

    // follower1 sells the 3 creator tokens
    this.socialController = this.socialController.connect(this.signers.follower1);

    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);
    const sellPrice = getSellPrice(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    await expect(await this.socialController.sellToken(tokenId, buyAmount))
      .to.emit(this.socialController, "SellTokenSuccess")
      .withArgs(tokenId, buyAmount, sellPrice);

    // check that balance of follower1 is back to 0
    expect(await this.daiMainnetContract.callStatic.balanceOf(this.signers.follower1.address)).to.be.eq(
      initialFollowerDaiBalance,
    );
  });
}
