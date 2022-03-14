//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IVial is IERC1155 {
    function burn(address _user, uint256 _tokenId) external;
}
