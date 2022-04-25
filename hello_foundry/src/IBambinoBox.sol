//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IBambinoBox is IERC1155 {
    function mint(address _user, uint256 _quantity) external;

    function burn(address _user, uint256 _tokenId) external;
}
