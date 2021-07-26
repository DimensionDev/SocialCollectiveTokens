import { expect } from "chai";
import { BigNumber } from "ethers";
import { PRICING_FACTORS, TWITTER_USERNAME_1 } from "../constants";
import { getBuyPriceAndApproveBuyToken, getResultFromSetupCreatorWithAccount, getSellPrice } from "./SharedFunctions";

export function shouldBehaveLikeSellToken(): void {
  beforeEach(async function () {
    this.creatorSetupResult = await getResultFromSetupCreatorWithAccount(
      this.socialController,
      ...PRICING_FACTORS,
      this.signers.creator1,
    );
    this.socialController = this.socialController.connect(this.signers.creator1);
    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);

    await this.socialController.linkPlatformAcc(TWITTER_USERNAME_1, this.creatorSetupResult.tokenId);

    // connect to follower1 and buy 3 creator tokens
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;
    const buyAmount = BigNumber.from(3);

    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    this.originalFollowerDaiBalance = await this.daiMainnetContract.callStatic.balanceOf(this.signers.follower1.address);
    getBuyPriceAndApproveBuyToken(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    this.socialController = this.socialController.connect(this.signers.follower1);
    await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount);

    // update this.creatorDetails to include the new numOfOutstandingToken balance
    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);
  });

  it("should throw if amount <= 0", async function () {
    const sellAmountZero = BigNumber.from(0);

    await expect(this.socialController.sellToken(this.creatorSetupResult.tokenId, sellAmountZero)).to.be.revertedWith(
      "You have not input a valid amount for selling.",
    );
  });

  it("should throw if seller owns lesser tokens than the amount to sell", async function () {
    this.socialController = this.socialController.connect(this.signers.follower1);
    const initialCreatorTokenBalanceForSeller = await this.socialController.balanceOf(
      this.signers.follower1.address,
      this.creatorSetupResult.tokenId,
    ); // 3 tokens

    const sellAmount = BigNumber.from(5);
    expect(initialCreatorTokenBalanceForSeller.toNumber()).to.be.lessThan(sellAmount.toNumber());
    await expect(this.socialController.sellToken(this.creatorSetupResult.tokenId, sellAmount)).to.be.revertedWith(
      "You do not have enough creator tokens to sell.",
    );
  });

  it("should throw if token ID is not valid", async function () {
    const sellAmount = BigNumber.from(1);

    const invalidTokenId = this.creatorSetupResult.tokenId.add(1);
    expect((await this.socialController.creatorById(invalidTokenId)).isCreator).to.be.false;
    await expect(this.socialController.sellToken(invalidTokenId, sellAmount)).to.be.revertedWith(
      "You do not have enough creator tokens to sell.",
    );
  });

  it("should return updated balances in contract and seller correctly", async function () {
    const initialDaiBalanceForSeller = await this.daiMainnetContract.callStatic.balanceOf(this.signers.follower1.address);
    const initialDaiBalanceForContract = await this.daiMainnetContract.callStatic.balanceOf(this.socialController.address);
    const initialCreatorTokenBalanceForSeller = await this.socialController.balanceOf(
      this.signers.follower1.address,
      this.creatorSetupResult.tokenId,
    );

    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;

    const sellAmount = BigNumber.from(1);
    const totalPrice = getSellPrice(multipleFactor, growthFactor, constantFactor, sellAmount, this);
    await this.socialController.sellToken(this.creatorSetupResult.tokenId, sellAmount);

    // check if seller's creator token balance has decreased by `sellAmount`
    expect(
      await this.socialController.balanceOf(this.signers.follower1.address, this.creatorSetupResult.tokenId),
    ).to.be.eq(initialCreatorTokenBalanceForSeller.sub(sellAmount));
    // check if seller balance has increased by the corresponding amount of DAI
    expect(await this.daiMainnetContract.callStatic.balanceOf(this.signers.follower1.address)).to.be.eq(
      initialDaiBalanceForSeller.add(totalPrice),
    );
    // check if contract balance has decreased by the corresponding amount of DAI
    expect(await this.daiMainnetContract.callStatic.balanceOf(this.socialController.address)).to.be.eq(
      initialDaiBalanceForContract.sub(totalPrice),
    );
  });

  it("should throw if the number of outstanding tokens equal 0", async function () {
    this.socialController = this.socialController.connect(this.signers.follower1);

    // change numOfOutstandingTokens to 0
    const sellAmount1 = BigNumber.from(3);
    await this.socialController.sellToken(this.creatorSetupResult.tokenId, sellAmount1);

    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);
    expect(this.creatorDetails.numOfOutstandingTokens).to.be.eq(0);

    // sell an additional token when there are no more tokens to sell
    const sellAmount2 = BigNumber.from(1);
    await expect(this.socialController.sellToken(this.creatorSetupResult.tokenId, sellAmount2)).to.be.revertedWith(
      "You do not have enough creator tokens to sell.",
    );
  });

  it("should update the correct amount of outstanding creator tokens", async function () {
    this.socialController = this.socialController.connect(this.signers.follower1);
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;
    const initialCreatorTokenBalance = this.creatorDetails.numOfOutstandingTokens; // 3 tokens

    const buyAmount = BigNumber.from(1);
    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    getBuyPriceAndApproveBuyToken(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    this.socialController = this.socialController.connect(this.signers.follower1);
    await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount);

    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);
    expect(this.creatorDetails.numOfOutstandingTokens).to.be.eq(initialCreatorTokenBalance.add(buyAmount));

    const sellAmount = buyAmount;
    await this.socialController.sellToken(this.creatorSetupResult.tokenId, sellAmount);

    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);
    expect(this.creatorDetails.numOfOutstandingTokens).to.be.eq(initialCreatorTokenBalance);
  });

  it("should emit SellTokenSuccess event correctly when amount sold = 1", async function () {
    this.socialController = this.socialController.connect(this.signers.follower1);
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;

    const sellAmount = BigNumber.from(1);
    const totalPrice = getSellPrice(multipleFactor, growthFactor, constantFactor, sellAmount, this);
    await expect(await this.socialController.sellToken(this.creatorSetupResult.tokenId, sellAmount))
      .to.emit(this.socialController, "SellTokenSuccess")
      .withArgs(this.creatorSetupResult.tokenId, sellAmount, totalPrice);
  });

  // if 3 tokens are bought and sold immediately by the same follower, without action from other followers
  it("should not make profit if tokens bought and sold immediately by same follower", async function () {
    const sellAmount = BigNumber.from(3);

    await this.socialController.sellToken(this.creatorSetupResult.tokenId, sellAmount)
    expect(await this.daiMainnetContract.callStatic.balanceOf(this.signers.follower1.address)).to.be.eq(
      this.originalFollowerDaiBalance,
    );
  });

  it("should emit SellTokenSuccess event correctly when amount sold > 1", async function () {
    this.socialController = this.socialController.connect(this.signers.follower1);
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;

    const buyAmount = BigNumber.from(15);
    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    await getBuyPriceAndApproveBuyToken(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    this.socialController = this.socialController.connect(this.signers.follower1);
    await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount);

    const sellAmount = BigNumber.from(10);
    this.creatorDetails = await this.socialController.creatorById(this.creatorSetupResult.tokenId);
    const totalPrice = getSellPrice(multipleFactor, growthFactor, constantFactor, sellAmount, this);

    await expect(await this.socialController.sellToken(this.creatorSetupResult.tokenId, sellAmount))
      .to.emit(this.socialController, "SellTokenSuccess")
      .withArgs(this.creatorSetupResult.tokenId, sellAmount, totalPrice);
  });
}
