// eslint-disable @typescript-eslint/no-explicit-any
import { JsonRpcSigner } from "@ethersproject/providers";
import { Fixture } from "ethereum-waffle";
import { BigNumber, ContractFactory } from "ethers";
import { IDai, SocialController } from "../typechain";
import { CreatorDetails, CreatorSetupResult, Signers } from "./";

declare module "mocha" {
  export interface Context {
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    socialController: SocialController;
    SCFactory_v1_1_Upgradeable: ContractFactory;
    SCFactory_v1_1_NonUpgradeable: ContractFactory;
    daiMainnetContract: IDai;
    signers: Signers;
    creatorDetails: CreatorDetails;
    daiMainnetSigner: JsonRpcSigner;
    creatorSetupResult: CreatorSetupResult;
    originalFollowerDaiBalance: BigNumber;
  }
}
