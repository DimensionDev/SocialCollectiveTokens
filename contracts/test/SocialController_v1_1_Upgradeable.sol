// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { PriceCalculator } from "../PriceCalculator.sol";
import { ERC1155Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// SocialController smart contract tag: v1.1.0

// NOTE: This is a dummy upgradeable smart contract purely used for upgrade testing.
// It is not meant to be used in production.
// Compared to SocialController.sol, it includes an extra dummy function `deleteCreator()`.

contract SocialController_v1_1_Upgradeable is
    Initializable,
    PriceCalculator,
    ERC1155Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    struct Creator {
        // CAUTION: DO NOT CHANGE ORDER & TYPE OF THESE VARIABLES
        // GOOGLE KEYWORDS "SOLIDITY, UPGRADEABLE CONTRACTS, STORAGE" FOR MORE INFO
        uint256 numOfOutstandingTokens;
        address creatorAddress;
        CreatorPricingFactors pricingFactors;
        bool isCreator;
    }

    struct CreatorPricingFactors {
        // CAUTION: DO NOT CHANGE ORDER & TYPE OF THESE VARIABLES
        // GOOGLE KEYWORDS "SOLIDITY, UPGRADEABLE CONTRACTS, STORAGE" FOR MORE INFO
        uint8 multipleFactor;
        uint8 growthFactor;
        uint8 constantFactor;
    }

    // CAUTION: DO NOT CHANGE ORDER & TYPE OF THESE VARIABLES
    // GOOGLE KEYWORDS "SOLIDITY, UPGRADEABLE CONTRACTS, STORAGE" FOR MORE INFO
    uint256 public latestId;
    mapping(bytes32 => uint256) public idByUsername;
    mapping(uint256 => Creator) public creatorById;

    /**
     * @dev Initializer that replaces the default constructor due to the upgradeable nature of this contract.
     * This also calls the initializer functions of ERC1155Upgradeable.sol and OwnableUpgradeable.sol.
     */
    function initialize() public initializer {
        __ERC1155_init("https://mask.io/{id}.json"); // temporary URI
        __Ownable_init();
    }

    /**
     * @dev Implemented from UUPSUpgradeable. Function is called during this contract's upgrade to
     * ensure that the upgrade is only executed by the contract owner.
     * @param newImplementation     Address of the upgraded version of this contract.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    event CreatorSetupSuccess(
        uint256 indexed tokenId,
        address indexed creatorAddress,
        uint256 multipleFactor,
        uint256 growthFactor,
        uint256 constantFactor
    );
    event PlatformAccLinked(string indexed username, uint256 tokenId);
    event CreatorAddressUpdated(string indexed username, address newAddress, address oldAddress);
    event CreatorUsernameUpdated(string indexed newUsername, string indexed oldUsername);
    event BuyTokenSuccess(uint256 indexed tokenId, uint256 amount, uint256 totalPrice);
    event SellTokenSuccess(uint256 indexed tokenId, uint256 amount, uint256 totalPrice);
    event CreatorDeleted(uint256 indexed tokenId);

    /**
     * @notice For creator: To start token trading after social media platform account and wallet is verified.
     * Creator needs to save the returned tokenId to link his social media to the token in this contract.
     * @param _multipleFactor       The multiplicative factor that adjusts the ‘slope’ of the curve (aka 'm').
     * @param _growthFactor         The % growth in price per factor-increase (aka 'c', between 1 and 100).
     * @param _constantFactor       The constant that adjusts the functions in the spirit of y = mx + b (aka 'b').
     */
    function setupCreator(
        uint8 _multipleFactor,
        uint8 _growthFactor,
        uint8 _constantFactor
    ) external returns (uint256) {
        latestId += 1;
        uint256 tokenId = latestId;
        Creator memory creator = creatorById[tokenId];
        require(!creator.isCreator, "Your token has already been created.");

        require(_multipleFactor >= 1 && _multipleFactor <= 10, "The multiple factor does not fall between 1 and 10.");
        require(_growthFactor >= 20 && _growthFactor <= 60, "The growth factor does not fall between 20% and 60%.");
        require(_constantFactor >= 0 && _constantFactor <= 99, "The constant factor does not fall between 0 and 99.");

        CreatorPricingFactors memory pricingFactors = creator.pricingFactors;
        pricingFactors.multipleFactor = _multipleFactor;
        pricingFactors.growthFactor = _growthFactor;
        pricingFactors.constantFactor = _constantFactor;

        creatorById[tokenId] = Creator(0, address(msg.sender), pricingFactors, true);

        emit CreatorSetupSuccess(tokenId, msg.sender, _multipleFactor, _growthFactor, _constantFactor);
        return tokenId;
    }

    /**
     * @notice For creator: Links the creator's social media platform username to the respective token setup.
     * Creator needs to have saved his token ID from setupCreator().
     * @param _username             The username of the platform account that the creator wants to link his token to.
     */
    function linkPlatformAcc(string calldata _username, uint256 _tokenId) external {
        Creator memory creator = creatorById[_tokenId];
        require(creator.isCreator, "This is not a valid token ID.");
        require(creator.creatorAddress == msg.sender, "You are not qualified to link a new platform account.");

        bytes32 hashedUsername = keccak256(abi.encodePacked(_username));
        require(idByUsername[hashedUsername] == 0, "This username has been linked to a creator already.");

        idByUsername[hashedUsername] = _tokenId;
        emit PlatformAccLinked(_username, _tokenId);
    }

    /**
     * @notice For creator: change wallet address tied to creator's platform username. If the creator has multiple
     * usernames tied to his Creator profile, only one of those usernames is required to update the address.
     * The creator should call this function from the existing address tied to his profile.
     * @param _newAddress           The new address that the creator wants to change to.
     * @param _username             The username of the platform account creator that belongs to msg.sender.
     */
    function updateCreatorAddress(address _newAddress, string calldata _username) external {
        bytes32 hashedUsername = keccak256(abi.encodePacked(_username));
        uint256 tokenId = idByUsername[hashedUsername];
        require(tokenId != 0, "This username has not been linked to a creator.");

        Creator memory creator = creatorById[tokenId];
        require(creator.creatorAddress == msg.sender, "You're not qualified to change this creator's address.");
        require(creator.creatorAddress != _newAddress, "Your address remains the same.");
        creatorById[tokenId].creatorAddress = _newAddress;

        emit CreatorAddressUpdated(_username, _newAddress, msg.sender);
    }

    /**
     * ! Check that the new username owner is also the owner of the old username
     * @notice For creator: Update new username after verification on Bloom that the new username belongs
     * to creator (msg.sender).
     * @param _newUsername          The new username that replaces the existing one.
     * @param _oldUsername          The username that the creator wants to change.
     */
    function updateUsername(string calldata _newUsername, string calldata _oldUsername) external {
        bytes32 oldHashedUsername = keccak256(abi.encodePacked(_oldUsername));
        require(idByUsername[oldHashedUsername] != 0, "Your old username has not been linked.");

        Creator memory creator = creatorById[idByUsername[oldHashedUsername]];
        // not sure if the following line is necessary as the line after checks for address (as part of Creator struct)
        require(creator.isCreator, "Your creator profile does not exist.");
        require(creator.creatorAddress == msg.sender, "You are not allowed to change this username.");

        require(
            keccak256(abi.encodePacked(_oldUsername)) != keccak256(abi.encodePacked(_newUsername)),
            "You have not changed your username."
        );
        bytes32 newHashedUsername = keccak256(abi.encodePacked(_newUsername));
        require(idByUsername[newHashedUsername] == 0, "Your new username has already been linked.");

        uint256 tokenId = idByUsername[oldHashedUsername];
        idByUsername[newHashedUsername] = tokenId;
        idByUsername[oldHashedUsername] = 0;

        emit CreatorUsernameUpdated(_newUsername, _oldUsername);
    }

    /**
     * @notice For users to purchase specific creator tokens by quantity. Tokens are minted by each purchase.
     * @param _tokenId              The token ID of the creator that the user wishes to buy from.
     * @param _amount               The amount that the user wishes to buy.
     */
    function buyToken(uint256 _tokenId, uint256 _amount) external {
        require(_amount > 0, "You have not input a valid amount for purchase.");

        Creator memory creator = creatorById[_tokenId];
        uint256 MAX_SAFE_INTEGER = 9007199254740991;
        require(
            _amount <= MAX_SAFE_INTEGER - creator.numOfOutstandingTokens,
            "You need to purchase a smaller amount of tokens."
        );
        require(creator.isCreator, "This token ID is not valid.");

        CreatorPricingFactors memory pricingFactors = creator.pricingFactors;
        uint256 multipleFactor = pricingFactors.multipleFactor;
        uint256 growthFactor = pricingFactors.growthFactor;
        uint256 constantFactor = pricingFactors.constantFactor;

        uint256 numOfOutstandingTokens = creator.numOfOutstandingTokens;

        uint256 totalPrice;
        if (_amount == 1) {
            totalPrice = _getBuyPrice(multipleFactor, growthFactor, constantFactor, numOfOutstandingTokens);
        } else {
            totalPrice = _getBatchBuyPrice(
                multipleFactor,
                growthFactor,
                constantFactor,
                numOfOutstandingTokens,
                _amount
            );
        }

        IERC20 dai = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
        dai.transferFrom(msg.sender, address(this), totalPrice);
        _mint(msg.sender, _tokenId, _amount, "");
        creatorById[_tokenId].numOfOutstandingTokens += _amount;

        emit BuyTokenSuccess(_tokenId, _amount, totalPrice);
    }

    /**
     * @notice For users to sell specific creator tokens by quantity. Tokens are burned with each sell.
     * @param _tokenId              The token ID of the creator that the user wishes to sell.
     * @param _amount               The amount that the user wishes to sell.
     */
    function sellToken(uint256 _tokenId, uint256 _amount) external {
        require(_amount > 0, "You have not input a valid amount for selling.");
        require(balanceOf(msg.sender, _tokenId) >= _amount, "You do not have enough creator tokens to sell.");

        Creator memory creator = creatorById[_tokenId];
        uint256 numOfOutstandingTokens = creator.numOfOutstandingTokens;
        require(numOfOutstandingTokens > 0, "There are no more creator tokens left.");

        CreatorPricingFactors memory pricingFactors = creator.pricingFactors;
        uint256 multipleFactor = pricingFactors.multipleFactor;
        uint256 growthFactor = pricingFactors.growthFactor;
        uint256 constantFactor = pricingFactors.constantFactor;

        uint256 totalPrice;
        if (_amount == 1) {
            totalPrice = _getSellPrice(multipleFactor, growthFactor, constantFactor, numOfOutstandingTokens);
        } else {
            totalPrice = _getBatchSellPrice(
                multipleFactor,
                growthFactor,
                constantFactor,
                numOfOutstandingTokens,
                _amount
            );
        }

        _burn(msg.sender, _tokenId, _amount);
        creatorById[_tokenId].numOfOutstandingTokens -= _amount;

        IERC20 dai = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
        dai.transfer(msg.sender, totalPrice);

        emit SellTokenSuccess(_tokenId, _amount, totalPrice);
    }

    /**
     * @dev DUMMY FUNCTION - NOT FOR USE IN PRODUCTION
     * @notice Deletes the creator profile when no outstanding tokens are left.
     * @param _tokenId              The token ID of the creator.
     */
    function deleteCreator(uint256 _tokenId) external {
        Creator memory creator = creatorById[_tokenId];
        require(msg.sender == creator.creatorAddress, "You are not qualified to delete this creator.");
        require(creator.numOfOutstandingTokens == 0, "You cannot delete this creator as it has tokens outstanding.");

        creatorById[_tokenId] = Creator(0, address(0), CreatorPricingFactors(0, 0, 0), false);

        emit CreatorDeleted(_tokenId);
    }
}
