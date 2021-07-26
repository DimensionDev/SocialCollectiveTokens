import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

export interface Signers {
  admin: SignerWithAddress;
  creator1: SignerWithAddress;
  creator2: SignerWithAddress;
  creator3: SignerWithAddress;
  follower1: SignerWithAddress;
  follower2: SignerWithAddress;
  follower3: SignerWithAddress;
  miscellaneous: SignerWithAddress;
}

export interface CreatorDetails {
  numOfOutstandingTokens: BigNumber;
  creatorAddress: string;
  pricingFactors: [number, number, number] & {
    multipleFactor: number;
    growthFactor: number;
    constantFactor: number;
  };
  isCreator: boolean;
}

export interface CreatorSetupResult {
  tokenId: BigNumber;
  creatorAddress: string;
  multipleFactor: BigNumber;
  growthFactor: BigNumber;
  constantFactor: BigNumber;
}
