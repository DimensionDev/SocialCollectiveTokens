import { BigNumber, ethers } from "ethers";

export const HUNDRED: BigNumber = BigNumber.from(100);

export const PRICING_FACTORS: [BigNumber, BigNumber, BigNumber] = [
  BigNumber.from(1),
  BigNumber.from(40),
  BigNumber.from(0),
]; // multipleFactor, growthFactor, constantFactor

export const TWITTER_USERNAME_1: string = "test@twitter1";
export const TWITTER_USERNAME_2: string = "test@twitter2";
export const TWITTER_USERNAME_3: string = "test@twitter3";
export const FACEBOOK_USERNAME: string = "test@facebook";

export const TWITTER_USERNAME_1_HASHED: string = ethers.utils.solidityKeccak256(["string"], [TWITTER_USERNAME_1]);
export const TWITTER_USERNAME_2_HASHED: string = ethers.utils.solidityKeccak256(["string"], [TWITTER_USERNAME_2]);
export const TWITTER_USERNAME_3_HASHED: string = ethers.utils.solidityKeccak256(["string"], [TWITTER_USERNAME_3]);
export const FACEBOOK_USERNAME_HASHED: string = ethers.utils.solidityKeccak256(["string"], [FACEBOOK_USERNAME]);

// DAI ropsten address: https://ropsten.etherscan.io/address/0xad6d458402f60fd3bd25163575031acdce07538d
export const DAI_ROPSTEN_ADDRESS: string = "0xad6d458402f60fd3bd25163575031acdce07538d";
// DAI mainnet address: https://etherscan.io/address/0x6b175474e89094c44da98b954eedeac495271d0f
export const DAI_MAINNET_ADDRESS: string = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

// Compound: cDAI Token mainnet address: https://etherscan.io/address/0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643
export const CDAI_TOKEN_ADDRESS: string = "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";

// EOA - cVault Finance: Deployer address: https://etherscan.io/address/0x5a16552f59ea34e44ec81e58b3817833e9fd5436
export const DAI_HOLDER_ADDRESS_1: string = "0x5A16552f59ea34E44ec81E58b3817833E9fD5436";
// EOA - Binance 8 address: https://etherscan.io/address/0xf977814e90da44bfa03b6295a0616a897441acec
export const DAI_HOLDER_ADDRESS_2: string = "0xF977814e90dA44bFA03b6295A0616a897441aceC";

// The amount to transfer to buyer `this.signers.user2` to purchase creator tokens
export const DAI_TRANSFER_AMOUNT: BigNumber = BigNumber.from(1000000); // 1 million DAI

// ERC1967UpgradeUpgradeable.sol: Storage slot with the address of the current implementation.
export const ADDR_STORAGE_PREFIX = '0x000000000000000000000000';
export const IMPL_STORAGE_POSITION = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
