// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

contract PriceCalculator {
    using SafeMathUpgradeable for uint256;

    /**
     * @dev Calculate the current price of the creator's token according to the sublinear bonding curve formula:
     *         y = m(1 + a%)^(log(x)/log(c)) + b, where
     *         y represents the token price
     *         m represents the multiplicative factor that adjusts the ‘slope’ of the curve
     *         a represents the % growth in price per factor-increase
     *         c represents the base of the factor-increase - c will always be 2 (i.e. log2 function)
     *         x represen  ts the number of follower tokens outstanding
     *         b represents the constant that adjusts the functions in the spirit of y = mx + b
     *         All parameters above may only exist as integers.
     * @param _multipleFactor           The multiplicative factor that adjusts the ‘slope’ of the curve (aka 'm').
     * @param _growthFactor             The % growth in price per factor-increase (aka 'c', between 1 and 100).
     * @param _numOfOutstandingTokens   The number of follower tokens outstanding (aka 'x').
     * @param _constantFactor           The constant that adjusts the functions in the spirit of y = mx + b (aka 'b').
     * @return price The current price of the creator's token.
     */
    function _getBuyPrice(
        uint256 _multipleFactor,
        uint256 _growthFactor,
        uint256 _constantFactor,
        uint256 _numOfOutstandingTokens
    ) internal pure returns (uint256) {
        uint256 currTokenIdx = _numOfOutstandingTokens.add(1);
        uint256 subFormulaCalc = _subFormulaPower(_growthFactor, currTokenIdx);
        uint256 price = _constantFactor.add(_multipleFactor.mul(subFormulaCalc));
        return price;
    }

    /**
     * @dev Similar to _getPrice(), but calculates the price of a purchase quantity more than 1.
     * @param _multipleFactor           The multiplicative factor that adjusts the ‘slope’ of the curve (aka 'm').
     * @param _growthFactor             The % growth in price per factor-increase (aka 'c', between 1 and 100).
     * @param _numOfOutstandingTokens   The number of follower tokens outstanding (aka 'x').
     * @param _constantFactor           The constant that adjusts the functions in the spirit of y = mx + b (aka 'b').
     * @param _amountToBuy              The amount of tokens to calculate the price for according to the bonding curve.
     * @return price The current price of the creator's token.
     */
    function _getBatchBuyPrice(
        uint256 _multipleFactor,
        uint256 _growthFactor,
        uint256 _constantFactor,
        uint256 _numOfOutstandingTokens,
        uint256 _amountToBuy
    ) internal pure returns (uint256) {
        uint256 totalConstant = _amountToBuy * _constantFactor;
        uint256 totalNonConstant;

        // Save recurring integer overflow checking on `i++` in for loop (due to Solidity 0.8)
        unchecked {
            for (uint256 i = 1; i <= _amountToBuy; i++) {
                uint256 currTokenIdx = _numOfOutstandingTokens.add(i);
                uint256 subFormulaCalc = _subFormulaPower(_growthFactor, currTokenIdx);
                totalNonConstant = totalNonConstant.add(subFormulaCalc);
            }
        }

        uint256 price = totalConstant.add(_multipleFactor.mul(totalNonConstant));
        return price;
    }

    function _getSellPrice(
        uint256 _multipleFactor,
        uint256 _growthFactor,
        uint256 _constantFactor,
        uint256 _numOfOutstandingTokens
    ) internal pure returns (uint256) {
        uint256 subFormulaCalc = _subFormulaPower(_growthFactor, _numOfOutstandingTokens);
        uint256 price = _constantFactor.add(_multipleFactor.mul(subFormulaCalc));
        return price;
    }

    function _getBatchSellPrice(
        uint256 _multipleFactor,
        uint256 _growthFactor,
        uint256 _constantFactor,
        uint256 _numOfOutstandingTokens,
        uint256 _amountToSell
    ) internal pure returns (uint256) {
        uint256 totalConstant = _amountToSell * _constantFactor;
        uint256 totalNonConstant;

        unchecked {
            for (uint256 i = 0; i < _amountToSell; i++) {
                uint256 currTokenIdx = _numOfOutstandingTokens.sub(i);
                uint256 subFormulaCalc = _subFormulaPower(_growthFactor, currTokenIdx);
                totalNonConstant = totalNonConstant.add(subFormulaCalc);
            }
        }

        uint256 price = totalConstant + _multipleFactor * totalNonConstant;
        return price;
    }

    /**
     * @dev Calculates a subsection of the sublinear bonding curve formula: (1 + a/100) ** log2(x),
     * which in turn equals to (100 + a) ** log2(x) / 100 ** log2(x).
     * Therefore numerator = (100 + a) ** log2(x) and denominator = 100 ** log2(x).
     * @param _growthFactor         The % growth in price per factor-increase (aka 'c', between 1 and 100).
     * @param _currTokenIdx         The current token index.
     */
    function _subFormulaPower(uint256 _growthFactor, uint256 _currTokenIdx) private pure returns (uint256) {
        // function _subFormulaPower(uint256 _growthFactor, uint256 _currTokenIdx) private pure returns (uint256) {
        uint256 exponent = logarithm2(_currTokenIdx);
        uint256 numeratorLog = power(100 + _growthFactor, exponent);
        uint256 denominatorLog = power(100, exponent);
        return numeratorLog.div(denominatorLog);
    }

    /**
     * @dev For power operations within unchecked blocks to prevent integer overflow wrapping.
     */
    function power(uint256 base, uint256 exponent) private pure returns (uint256 result) {
        result = base**exponent;
    }

    /**
     * @dev Calculates the logarithmic expression with 2 as the logarithmic base, rounds up answer to the nearest integer.
     *      Taken from https://ethereum.stackexchange.com/questions/8086/logarithm-math-operation-in-solidity
     *      <700 gas
     * @param argument Where 2 ** result = argument.
     */
    function logarithm2(uint256 argument) internal pure returns (uint256 result) {
        assembly {
            let arg := argument
            argument := sub(argument, 1)
            argument := or(argument, div(argument, 0x02))
            argument := or(argument, div(argument, 0x04))
            argument := or(argument, div(argument, 0x10))
            argument := or(argument, div(argument, 0x100))
            argument := or(argument, div(argument, 0x10000))
            argument := or(argument, div(argument, 0x100000000))
            argument := or(argument, div(argument, 0x10000000000000000))
            argument := or(argument, div(argument, 0x100000000000000000000000000000000))
            argument := add(argument, 1)
            let m := mload(0x40)
            mstore(m, 0xf8f9cbfae6cc78fbefe7cdc3a1793dfcf4f0e8bbd8cec470b6a28a7a5a3e1efd)
            mstore(add(m, 0x20), 0xf5ecf1b3e9debc68e1d9cfabc5997135bfb7a7a3938b7b606b5b4b3f2f1f0ffe)
            mstore(add(m, 0x40), 0xf6e4ed9ff2d6b458eadcdf97bd91692de2d4da8fd2d0ac50c6ae9a8272523616)
            mstore(add(m, 0x60), 0xc8c0b887b0a8a4489c948c7f847c6125746c645c544c444038302820181008ff)
            mstore(add(m, 0x80), 0xf7cae577eec2a03cf3bad76fb589591debb2dd67e0aa9834bea6925f6a4a2e0e)
            mstore(add(m, 0xa0), 0xe39ed557db96902cd38ed14fad815115c786af479b7e83247363534337271707)
            mstore(add(m, 0xc0), 0xc976c13bb96e881cb166a933a55e490d9d56952b8d4e801485467d2362422606)
            mstore(add(m, 0xe0), 0x753a6d1b65325d0c552a4d1345224105391a310b29122104190a110309020100)
            mstore(0x40, add(m, 0x100))
            let magic := 0x818283848586878898a8b8c8d8e8f929395969799a9b9d9e9faaeb6bedeeff
            let shift := 0x100000000000000000000000000000000000000000000000000000000000000
            let a := div(mul(argument, magic), shift)
            result := div(mload(add(m, sub(255, a))), shift)
            result := add(result, mul(256, gt(arg, 0x8000000000000000000000000000000000000000000000000000000000000000)))
        }
    }
}
