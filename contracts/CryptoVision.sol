// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CryptoVision is ERC20 {
    constructor() ERC20("CryptoVision", "CRPTVSN") {
        _mint(msg.sender, 1000000000000000000000000);
    }
}
