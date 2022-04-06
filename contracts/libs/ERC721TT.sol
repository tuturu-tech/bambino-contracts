// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./ERC721Bitmap.sol";

abstract contract ERC721TT {
    using Address for address;
    using Strings for uint256;
    using TokenDataOps for uint256;

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed id
    );
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 indexed id
    );
    event ApprovalForAll(
        address indexed owner,
        address indexed operator,
        bool approved
    );

    string public name;
    string public symbol;

    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    uint256 public totalSupply;

    uint256 immutable startingIndex;
    uint256 immutable collectionSize;
    uint256 immutable maxPerWallet;

    // note: hard limit of 255, otherwise overflows can happen
    uint256 constant stakingLimit = 100;

    mapping(uint256 => uint256) internal _tokenData;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 startingIndex_,
        uint256 collectionSize_,
        uint256 maxPerWallet_
    ) {
        name = name_;
        symbol = symbol_;
        collectionSize = collectionSize_;
        maxPerWallet = maxPerWallet_;
        startingIndex = startingIndex_;
    }
}
