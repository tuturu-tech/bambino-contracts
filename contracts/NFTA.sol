//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract NFTA is ERC721A, Ownable, ReentrancyGuard {
    uint256 public maxSupply;
    uint256 public giveawayReserved;
    uint256 public teamReserved;
    uint256 public maxBuyWL;
    uint256 public maxBuyPS;
    uint256 public priceWL;
    uint256 public pricePS;
    uint256 public locked;

    mapping(address => uint256) WLMinted;
    mapping(address => uint256) PSMinted;

    constructor() ERC721A("Azuki", "AZUKI", 5) {}

    function mint(uint256 quantity) external payable {
        // _safeMint's second argument now takes in a quantity, not a tokenId.
        _safeMint(msg.sender, quantity);
    }

    // --------- MODIFIERS ----------

    modifier callerIsUser() {
        require(tx.origin == msg.sender, "The caller is another contract");
        _;
    }
}
