import { expect } from "chai";
import { BigNumber } from "ethers";
import {
  PRICING_FACTORS,
  TWITTER_USERNAME_1,
  TWITTER_USERNAME_1_HASHED,
  TWITTER_USERNAME_2,
  TWITTER_USERNAME_2_HASHED,
  TWITTER_USERNAME_3,
} from "../constants";
import { getBuyPriceAndApproveBuyToken, getResultFromSetupCreatorWithAccount, getSellPrice } from "./SharedFunctions";

export function shouldBehaveLikeUpdateUsername(): void {
  beforeEach(async function () {
    this.creatorSetupResult = await getResultFromSetupCreatorWithAccount(
      this.socialController,
      ...PRICING_FACTORS,
      this.signers.creator1,
    );
    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);

    this.socialController = this.socialController.connect(this.signers.creator1);
    await this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId);
  });

  it("should throw if updated username is the same", async function () {
    await expect(this.socialController.updateUsername(TWITTER_USERNAME_1, TWITTER_USERNAME_1)).to.be.revertedWith(
      "You have not changed your username.",
    );
  });

  it("should throw if old username has not been linked", async function () {
    await expect(this.socialController.updateUsername(TWITTER_USERNAME_3, TWITTER_USERNAME_2)).to.be.revertedWith(
      "Your old username has not been linked.",
    );
  });

  it("should throw if `msg.sender` does not match the creator's address", async function () {
    this.socialController = this.socialController.connect(this.signers.creator2);

    await expect(this.socialController.updateUsername(TWITTER_USERNAME_2, TWITTER_USERNAME_1)).to.be.revertedWith(
      "You are not allowed to change this username.",
    );
  });

  it("should throw if new username has already been linked", async function () {
    await this.socialController.linkPlatformAcc(TWITTER_USERNAME_2, this.creatorSetupResult.tokenId);

    await expect(this.socialController.updateUsername(TWITTER_USERNAME_2, TWITTER_USERNAME_1)).to.be.revertedWith(
      "Your new username has already been linked.",
    );
  });

  it("should allow username update from a different address if creator has previously called `updateCreatorAddress()`", async function () {
    await this.socialController.updateCreatorAddress(this.signers.creator2.address, TWITTER_USERNAME_1);

    const idFromTwitterUsername1 = await this.socialController.idByUsername(TWITTER_USERNAME_1_HASHED);
    expect((await this.socialController.creatorById(idFromTwitterUsername1)).creatorAddress).to.be.eq(
      this.signers.creator2.address,
    );

    this.socialController = this.socialController.connect(this.signers.creator2);
    await this.socialController.updateUsername(TWITTER_USERNAME_2, TWITTER_USERNAME_1);

    const returnedTokenIdFromOldUsername = await this.socialController.idByUsername(TWITTER_USERNAME_1_HASHED);
    expect(returnedTokenIdFromOldUsername).to.be.eq(0);
    const returnedTokenIdFromNewUsername = await this.socialController.idByUsername(TWITTER_USERNAME_2_HASHED);
    expect(returnedTokenIdFromNewUsername).to.be.eq(this.creatorSetupResult.tokenId);
  });

  it("should emit CreatorUsernameUpdated event correctly", async function () {
    expect(await this.socialController.updateUsername(TWITTER_USERNAME_2, TWITTER_USERNAME_1))
      .to.emit(this.socialController, "CreatorUsernameUpdated")
      .withArgs(TWITTER_USERNAME_2, TWITTER_USERNAME_1);

    const returnedTokenIdFromOldUsername = await this.socialController.idByUsername(TWITTER_USERNAME_1_HASHED);
    expect(returnedTokenIdFromOldUsername).to.be.eq(0);
    const returnedTokenIdFromNewUsername = await this.socialController.idByUsername(TWITTER_USERNAME_2_HASHED);
    expect(returnedTokenIdFromNewUsername).to.be.eq(this.creatorSetupResult.tokenId);
    expect((await this.socialController.creatorById(this.creatorSetupResult.tokenId)).creatorAddress).to.be.eq(
      this.signers.creator1.address,
    );
  });

  it("should allow buying/selling of tokens even after creator's username is updated", async function () {
    const tokenBalanceInitial = await this.socialController.balanceOf(
      this.signers.follower1.address,
      this.creatorSetupResult.tokenId,
    );

    // follower1 buys creator tokens
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;

    const buyAmount = BigNumber.from(10);
    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    const totalPrice = await getBuyPriceAndApproveBuyToken(
      multipleFactor,
      growthFactor,
      constantFactor,
      buyAmount,
      this,
    );

    this.socialController = this.socialController.connect(this.signers.follower1);

    // emits BuyTokenSuccess event
    this.socialController = this.socialController.connect(this.signers.follower1);
    await expect(await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount))
      .to.emit(this.socialController, "BuyTokenSuccess")
      .withArgs(this.creatorSetupResult.tokenId, buyAmount, totalPrice);

    const tokenBalanceAfterBuy = await this.socialController.balanceOf(
      this.signers.follower1.address,
      this.creatorSetupResult.tokenId,
    );

    expect(tokenBalanceAfterBuy).to.be.eq(tokenBalanceInitial.add(buyAmount));

    // creator updates username and emits CreatorUsernameUpdated event
    this.socialController = this.socialController.connect(this.signers.creator1);

    await expect(await this.socialController.updateUsername(TWITTER_USERNAME_2, TWITTER_USERNAME_1))
      .to.emit(this.socialController, "CreatorUsernameUpdated")
      .withArgs(TWITTER_USERNAME_2, TWITTER_USERNAME_1);

    const newFetchOfTokenId = await this.socialController.idByUsername(TWITTER_USERNAME_2_HASHED);

    // follower1 sells creator tokens
    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);
    const totalSellPrice = getSellPrice(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    // emits SellTokenSuccess event
    this.socialController = this.socialController.connect(this.signers.follower1);
    await expect(await this.socialController.sellToken(newFetchOfTokenId, buyAmount))
      .to.emit(this.socialController, "SellTokenSuccess")
      .withArgs(this.creatorSetupResult.tokenId, buyAmount, totalSellPrice);

    const tokenBalanceAfterSell = await this.socialController.balanceOf(
      this.signers.follower1.address,
      newFetchOfTokenId,
    );

    expect(tokenBalanceAfterSell).to.be.eq(tokenBalanceAfterBuy.sub(buyAmount));
  });
}
