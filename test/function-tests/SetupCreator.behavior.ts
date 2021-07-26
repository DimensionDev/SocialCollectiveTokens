import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { PRICING_FACTORS } from "../constants";
import { getResultFromSetupCreator } from "./SharedFunctions";

use(solidity);

export function shouldBehaveLikeSetupCreator(): void {
  beforeEach(async function () {
    this.socialController = this.socialController.connect(this.signers.creator1);
  });

  it("should emit CreatorSetupSuccess event correctly", async function () {
    const expectedTokenId: BigNumber = BigNumber.from(1);
    await expect(await this.socialController.setupCreator(...PRICING_FACTORS))
      .to.emit(this.socialController, "CreatorSetupSuccess")
      .withArgs(expectedTokenId, this.signers.creator1.address, ...PRICING_FACTORS);
  });

  it("should return `creator.isCreator == true`", async function () {
    this.socialController = this.socialController.connect(this.signers.creator1);
    const result = await getResultFromSetupCreator(this.socialController, ...PRICING_FACTORS);
    expect((await this.socialController.creatorById(BigNumber.from(result.tokenId))).isCreator).to.be.eq(true);
  });

  it("should throw an error if multipleFactor is <1 or >10", async function () {
    const invalidPricingFactors: [number, number, number] = [0, 40, 0]; // only multipleFactor is incorrect
    await expect(this.socialController.setupCreator(...invalidPricingFactors)).to.be.revertedWith(
      "The multiple factor does not fall between 1 and 10.",
    );
  });
}
