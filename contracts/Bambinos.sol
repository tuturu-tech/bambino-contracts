//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./libs/ERC721T.sol";

contract Bambinos is ERC721T, Ownable, ReentrancyGuard {
    using Address for address;
    using Strings for uint256;

    uint256 revealTime;
    string baseURI;
    string unrevealedURI;
    address approvedMinter;

    constructor(address _bambinoBox)
        ERC721T("Billionaire Bambinos", "BB", 1, 8000, 10, 14 days, _bambinoBox)
    {}

    /* ------------- Approved Contract only ------------- */

    function mint(address to, uint256 quantity) external {
        require(msg.sender == approvedMinter, "NOT_AUTHORIZED");
        _mint(to, quantity);
    }

    /* ------------- View ------------- */

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        if (block.timestamp >= revealTime) {
            return
                bytes(baseURI).length > 0
                    ? string(
                        abi.encodePacked(baseURI, tokenId.toString(), ".json")
                    )
                    : unrevealedURI;
        } else {
            return unrevealedURI;
        }
    }

    /* ------------- Restricted ------------- */

    function startNextCycle(uint40 timestamp) external onlyOwner {
        require(
            block.timestamp > cycleStartedAt[currentCycle] + cycleLength,
            "TOO_SOON_TO_START_NEW_CYCLE"
        );
        require(timestamp >= block.timestamp, "START_TIME_TOO_SMALL");
        currentCycle += 1;
        cycleStartedAt[currentCycle] = timestamp;
    }

    function airdrop(address to, uint256 quantity) external onlyOwner {
        require(totalSupply + quantity <= collectionSize, "MINT_LIMIT_REACHED");
        _mint(to, quantity);
    }

    function setBaseURI(string memory uri) external onlyOwner {
        baseURI = uri;
    }

    function setUnrevealedURI(string memory uri) external onlyOwner {
        unrevealedURI = uri;
    }

    function setRevealTime(uint256 reveal) external onlyOwner {
        revealTime = reveal;
    }

    function setApprovedMinted(address vial) external onlyOwner {
        approvedMinter = vial;
    }
}
