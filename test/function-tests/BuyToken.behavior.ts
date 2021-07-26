import { expect } from "chai";
import { BigNumber } from "ethers";
import { PRICING_FACTORS, TWITTER_USERNAME_1 } from "../constants";
import { getBuyPriceAndApproveBuyToken, getResultFromSetupCreatorWithAccount } from "./SharedFunctions";

export function shouldBehaveLikeBuyToken(): void {
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

  it("should throw if amount <= 0", async function () {
    this.socialController = this.socialController.connect(this.signers.follower1);
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;

    const buyAmount = BigNumber.from(0);
    await getBuyPriceAndApproveBuyToken(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    await expect(this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount)).to.be.revertedWith(
      "You have not input a valid amount for purchase.",
    );
  });

  it("should throw if buy amount exceeds creator's token limit", async function () {
    // this.signers.follower1 buys 100 tokens
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;

    const buyAmount1 = BigNumber.from(100);
    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    await getBuyPriceAndApproveBuyToken(multipleFactor, growthFactor, constantFactor, buyAmount1, this);

    this.socialController = this.socialController.connect(this.signers.follower1);
    await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount1);

    // this.signers.follower2 buys a number of tokens that would cause uint256 overflow for the same creator
    // Max. safe integer supported by JavaScript is 0x1fffffffffffff
    const buyAmount2 = BigNumber.from(Number.MAX_SAFE_INTEGER - 50);

    this.socialController = this.socialController.connect(this.signers.follower2);
    await expect(this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount2)).to.be.revertedWith(
      "You need to purchase a smaller amount of tokens.",
    );
  });

  it("should throw if token ID is not valid", async function () {
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;

    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    const buyAmount = BigNumber.from(1);
    await getBuyPriceAndApproveBuyToken(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    const invalidTokenId = this.creatorSetupResult.tokenId.add(1);
    expect((await this.socialController.creatorById(invalidTokenId)).isCreator).to.be.false;

    this.socialController = this.socialController.connect(this.signers.follower1);
    await expect(this.socialController.buyToken(invalidTokenId, buyAmount)).to.be.revertedWith(
      "This token ID is not valid.",
    );
  });

  it("should return updated balances in contract and buyer correctly", async function () {
    const initialDaiBalanceForContract = await this.daiMainnetContract.callStatic.balanceOf(
      this.socialController.address,
    );
    const initialDaiBalanceForBuyer = await this.daiMainnetContract.callStatic.balanceOf(
      this.signers.follower1.address,
    );
    const initialCreatorTokenBalanceForBuyer = await this.socialController.balanceOf(
      this.signers.follower1.address,
      this.creatorSetupResult.tokenId,
    );

    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;

    const buyAmount = BigNumber.from(1);
    const buyPriceDai = await getBuyPriceAndApproveBuyToken(
      multipleFactor,
      growthFactor,
      constantFactor,
      buyAmount,
      this,
    );

    this.socialController = this.socialController.connect(this.signers.follower1);
    await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount);

    // check if user owns `buyAmount` of creator tokens
    expect(
      await this.socialController.balanceOf(this.signers.follower1.address, this.creatorSetupResult.tokenId),
    ).to.be.eq(initialCreatorTokenBalanceForBuyer.add(buyAmount));

    // check if buyer balance has decreased by the corresponding amount of DAI
    expect(await this.daiMainnetContract.callStatic.balanceOf(this.signers.follower1.address)).to.be.eq(
      initialDaiBalanceForBuyer.sub(buyPriceDai),
    );

    // check if contract balance has increased by the corresponding amount of DAI
    expect(await this.daiMainnetContract.callStatic.balanceOf(this.socialController.address)).to.be.eq(
      initialDaiBalanceForContract.add(buyPriceDai),
    );
  });

  it("should update the correct amount of outstanding creator tokens", async function () {
    const initialNumOfOutstandingTokens = (await this.socialController.creatorById(this.creatorSetupResult.tokenId))
      .numOfOutstandingTokens;

    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;

    const buyAmount = BigNumber.from(1);
    await getBuyPriceAndApproveBuyToken(multipleFactor, growthFactor, constantFactor, buyAmount, this);

    this.socialController = this.socialController.connect(this.signers.follower1);
    await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount);

    const finalNumOfOutstandingTokens = (await this.socialController.creatorById(this.creatorSetupResult.tokenId))
      .numOfOutstandingTokens;
    expect(finalNumOfOutstandingTokens).to.be.eq(initialNumOfOutstandingTokens.add(buyAmount));
  });

  it("should emit BuyTokenSuccess event correctly", async function () {
    this.daiMainnetContract = this.daiMainnetContract.connect(this.signers.follower1);
    const [multipleFactor, growthFactor, constantFactor] = PRICING_FACTORS;

    const buyAmount = BigNumber.from(1);
    const totalPrice = await getBuyPriceAndApproveBuyToken(
      multipleFactor,
      growthFactor,
      constantFactor,
      buyAmount,
      this,
    );

    this.socialController = this.socialController.connect(this.signers.follower1);
    await expect(await this.socialController.buyToken(this.creatorSetupResult.tokenId, buyAmount))
      .to.emit(this.socialController, "BuyTokenSuccess")
      .withArgs(this.creatorSetupResult.tokenId, buyAmount, totalPrice);
  });
}
