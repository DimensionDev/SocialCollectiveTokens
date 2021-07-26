import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { Context } from "mocha";
import * as daiJsonABI from "../../artifacts/contracts/interfaces/IDai.sol/IDai.json";
import * as scJsonABI from "../../artifacts/contracts/SocialController.sol/SocialController.json";
import { SocialController } from "../../typechain";
import { CreatorSetupSuccess } from "../../types";
import { HUNDRED } from "../constants";

export const scInterface = new ethers.utils.Interface(scJsonABI.abi);
export const daiInterface = new ethers.utils.Interface(daiJsonABI.abi);

/**
 * @description Retrieves the emitted event logs for `setupCreator()`.
 * @param {SocialController} contract The SocialController contract context.
 * @param {number} multipleFactor     The multiplicative factor that adjusts the ‘slope’ of the curve (aka 'm').
 * @param {number} growthFactor       The % growth in price per factor-increase (aka 'c', between 1 and 100).
 * @param {number} constantFactor     The constant that adjusts the functions in the spirit of y = mx + b (aka 'b').
 */
export async function getResultFromSetupCreator(
  contract: SocialController,
  multipleFactor: BigNumber,
  growthFactor: BigNumber,
  constantFactor: BigNumber,
): Promise<CreatorSetupSuccess> {
  await contract.setupCreator(multipleFactor, growthFactor, constantFactor);
  const logs = await ethers.provider.getLogs(contract.filters.CreatorSetupSuccess());
  const result = scInterface.parseLog(logs[0]);
  return {
    tokenId: result.args.tokenId,
    creatorAddress: result.args.creatorAddress,
    multipleFactor: result.args.multipleFactor,
    growthFactor: result.args.growthFactor,
    constantFactor: result.args.constantFactor,
  };
}

/**
 * @description Retrieves the emitted event logs for `setupCreator()`.
 * @param {SocialController} contract The SocialController contract context.
 * @param {number} multipleFactor     The multiplicative factor that adjusts the ‘slope’ of the curve (aka 'm').
 * @param {number} growthFactor       The % growth in price per factor-increase (aka 'c', between 1 and 100).
 * @param {number} constantFactor     The constant that adjusts the functions in the spirit of y = mx + b (aka 'b').
 * @param {SignerWithAddress} signer  The specific user (aka signer) that executes this function.
 */
export async function getResultFromSetupCreatorWithAccount(
  contract: SocialController,
  multipleFactor: BigNumber,
  growthFactor: BigNumber,
  constantFactor: BigNumber,
  signer: SignerWithAddress,
): Promise<CreatorSetupSuccess> {
  contract = contract.connect(signer);
  await contract.setupCreator(multipleFactor, growthFactor, constantFactor);
  const logs = await ethers.provider.getLogs(contract.filters.CreatorSetupSuccess());
  const result = scInterface.parseLog(logs[0]);
  return {
    tokenId: result.args.tokenId,
    creatorAddress: result.args.creatorAddress,
    multipleFactor: result.args.multipleFactor,
    growthFactor: result.args.growthFactor,
    constantFactor: result.args.constantFactor,
  };
}

/**
 * @description Calculates the total price for buying based on the sublinear formula and the given parameters.
 * @param multipleFactor            The multiplicative factor that adjusts the ‘slope’ of the curve (aka 'm').
 * @param growthFactor              The % growth in price per factor-increase (aka 'c', between 1 and 100).
 * @param constantFactor            The constant that adjusts the functions in the spirit of y = mx + b (aka 'b').
 * @param qty                       The amount of creator tokens that the buyer wants to purchase.
 * @param numOfOutstandingTokens    The total number of creator tokens in circulation.
 */
export const getBuyPriceFromSublinearFormula = (
  multipleFactor: BigNumber,
  growthFactor: BigNumber,
  constantFactor: BigNumber,
  qty: BigNumber,
  numOfOutstandingTokens: BigNumber,
): BigNumber => {
  const priceConstant = constantFactor.mul(qty);
  let priceNonConstant = BigNumber.from(0);

  for (let i = 1; i <= qty.toNumber(); i++) {
    const currTokenIdx = numOfOutstandingTokens.add(i);
    // this doesn't work as `growthFactor.div(100).add(1)`== 1 everytime, since `growthFactor / 100` is always rounded down to 0
    // naturally the above ** ANY_EXPONENT would always equal to 1 --> the price will not increase

    // Instead of y = m(1 + a/100) ** log2(x) + b,
    // we use y = m( (100 + a) / 100) ** log2(x) + b,
    // which results in y = m( (100 + a) ** log2(x) / 100 ** log2(x) ) + b,
    // since the first division of `a` over 100 (i.e. a/100) always equals to 0 in Solidity.
    const log2Result = logarithm2(currTokenIdx);
    const numeratorLog = HUNDRED.add(growthFactor).pow(log2Result);
    const denominatorLog = HUNDRED.pow(log2Result);
    priceNonConstant = priceNonConstant.add(numeratorLog.div(denominatorLog));
  }
  return priceConstant.add(multipleFactor.mul(priceNonConstant));
};

/**
 * @description Calculates the total price for selling based on the sublinear formula and the given parameters.
 * @param multipleFactor            The multiplicative factor that adjusts the ‘slope’ of the curve (aka 'm').
 * @param growthFactor              The % growth in price per factor-increase (aka 'c', between 1 and 100).
 * @param constantFactor            The constant that adjusts the functions in the spirit of y = mx + b (aka 'b').
 * @param qty                       The amount of creator tokens that the seller wants to sell.
 * @param numOfOutstandingTokens    The total number of creator tokens in circulation.
 */
export const getSellPriceFromSublinearFormula = (
  multipleFactor: BigNumber,
  growthFactor: BigNumber,
  constantFactor: BigNumber,
  qty: BigNumber,
  numOfOutstandingTokens: BigNumber,
): BigNumber => {
  const priceConstant = constantFactor.mul(qty);
  let priceNonConstant = BigNumber.from(0);

  for (let i = 0; i < qty.toNumber(); i++) {
    const currTokenIdx = numOfOutstandingTokens.sub(i);
    const log2Result = logarithm2(currTokenIdx);
    const numeratorLog = HUNDRED.add(growthFactor).pow(log2Result);
    const denominatorLog = HUNDRED.pow(log2Result);
    priceNonConstant = priceNonConstant.add(numeratorLog.div(denominatorLog));
  }

  return priceConstant.add(multipleFactor.mul(priceNonConstant));
};

/**
 * @description Calculates total buy price with the sublinear formula and approves the DAI transaction from buyer to contract.
 * @param {BigNumber} packedPricingFactors  A uint256 that has packed multipleFactor, growthFactor and constantFactor.
 * @param {BigNumber} buyAmount     The amount of creator tokens that the seller wants to buy.
 * @param {Context} ctx             The context of `this` from `describe("SocialController")` in SocialController.ts.
 * @return The total buy price.
 */
export const getBuyPriceAndApproveBuyToken = async (
  multipleFactor: BigNumber,
  growthFactor: BigNumber,
  constantFactor: BigNumber,
  buyAmount: BigNumber,
  ctx: Context,
): Promise<BigNumber> => {
  const calculatedPrice = getBuyPriceFromSublinearFormula(
    multipleFactor,
    growthFactor,
    constantFactor,
    buyAmount,
    ctx.creatorDetails.numOfOutstandingTokens,
  );

  await ctx.daiMainnetContract.approve(ctx.socialController.address, calculatedPrice);

  return calculatedPrice;
};

/**
 * @description Calculates and returns the total sell price with the sublinear formula.
 * @param {BigNumber} packedPricingFactors  A uint256 that has packed multipleFactor, growthFactor and constantFactor.
 * @param {BigNumber} sellAmount    The amount of creator tokens that the seller wants to sell.
 * @param {Context} ctx             The context of `this` from `describe("SocialController")` in SocialController.ts.
 * @return The total sell price.
 */
export const getSellPrice = (
  multipleFactor: BigNumber,
  growthFactor: BigNumber,
  constantFactor: BigNumber,
  sellAmount: BigNumber,
  ctx: Context,
): BigNumber => {
  return getSellPriceFromSublinearFormula(
    multipleFactor,
    growthFactor,
    constantFactor,
    sellAmount,
    ctx.creatorDetails.numOfOutstandingTokens,
  );
};

/**
 * @description Returns the base 2 logarithm of a number.
 * @param {BigNumber} argument
 * @returns BigNumber
 */
export const logarithm2 = (argument: BigNumber): BigNumber => {
  const logValue = Math.log2(argument.toNumber());

  // Splitting of `Math.floor()`and `Math.ceil`due to floating point error, i.e.:
  // Math.ceil(3.0000000000000001) = 3
  // Math.ceil(3.000000000000001) = 4

  // Math.floor(3.999999999999999) = 3
  // Math.floor(3.9999999999999999) = 4

  if (logValue % 1 == 0) {
    return BigNumber.from(logValue);
  } else if (logValue % 1 < 0.5) {
    // avoid Math.ceil() for numbers <X.5 and that have > 15 decimal places
    return BigNumber.from(Math.floor(logValue) + 1);
  } else {
    return BigNumber.from(Math.ceil(logValue));
  }
};

/**
 * @description Returns a BigNumber in number type.
 * @param  {BigNumber} bn
 * @returns number
 */
export const BNToInt = (bn: BigNumber): number => {
  return parseInt(bn._hex);
};
