# SocialCollectiveTokens
A place for anyone to issue their personal social token on top of social media platforms. The pricing of the tokens follow a sublinear bonding curve formula, in which creators can adjust the parameters to their liking.

Do refer to:
1. [Social Collective Tokens](https://docs.google.com/document/d/1AcN1t_zBS_YuC_4f_b9B4m4NJ1lhGmWfnXrj0aPYeCo/edit?usp=sharing) - Project description and bonding curve formula
2. [Bonding Curve Parameters Sheet](https://docs.google.com/spreadsheets/d/17SsEZZDaxI6TUptftiDISpwWudkinwnRn_MhqoONcp4/edit?usp=sharing) - Find out how the parameters may influence the bonding curve shape.

## Getting Started
This is a standard Hardhat project. 

### To install
```
yarn install
```

### To build the project
```
yarn compile
```

### To test the project
To copy over your `INFURA_API_KEY` to `package.json`:
```
yarn preinstall
```
To [fork the mainnet](https://hardhat.org/guides/mainnet-forking.html) from block `12746317` for communciation with the DAI contract address:
```
yarn hardhat node --fork https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}
```
To execute the test:
```
yarn test
```

## For upgrading of contracts
This project uses OpenZeppelin's upgradeable contracts plugin for Hardhat to ensure safe and compatible upgrades with future versions. Before deploying an upgraded contract, read the documentation at [openzeppelin-upgrades](https://github.com/OpenZeppelin/openzeppelin-upgrades).