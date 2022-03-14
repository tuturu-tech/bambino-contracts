//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

contract Content is ERC721A, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using Strings for uint256;

    uint256 public maxSupply = 8888;

    string public baseURI;
    string public unrevealedURI;

    mapping(address => bool) authorized;

    constructor() ERC721A("Content", "CON", 8888) {
        authorized[msg.sender] = true;
    }

    // --------- USER API ----------

    function mint(address to, uint256 quantity) external nonReentrant {
        require(
            totalSupply() + quantity <= maxSupply,
            "MAX_SUPPLY: AMOUNT_TOO_HIGH"
        );
        require(authorized[msg.sender], "NOT_AUTHORIZED");

        _safeMint(to, quantity);
    }

    // --------- VIEW --------------

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory uri)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        bytes(baseURI).length > 0
            ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json"))
            : unrevealedURI;
    }

    // --------- RESTRICTED -----------

    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    function setUnrevealedURI(string memory _uri) external onlyOwner {
        unrevealedURI = _uri;
    }
}
