//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IVial is IERC1155 {
    function burn(address _user, uint256[] memory _tokenIds) external;
}
