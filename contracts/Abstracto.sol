//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Abstracto is ERC721A, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using Strings for uint256;

    uint256 public immutable maxSupply = 1000; // Check if they want this to be flexible
    uint256 public auctionStart;
    uint256 public maxMint = 20;
    uint256 public decrementInterval = 5 minutes;
    uint256 public decrementAmount = 0.002 ether; // CHANGE!
    uint256 public decrementDuration = 5 minutes * 24;
    uint256 public startingPrice = 0.05 ether; // CHANGE!
    uint256 public minimumPrice = 0.002 ether; // CHANGE!
    uint256 public revealTime;
    bool public isActive;

    string public baseURI;
    string public unrevealedURI;
    address public withdrawalAddress;

    constructor(string memory _unrevealedURI, address _withdrawalAddress)
        ERC721A("Abstracto", "Abstracto", 10) // Check the name
    {
        unrevealedURI = _unrevealedURI;
        withdrawalAddress = _withdrawalAddress;
    }

    // --------- USER API -----------

    function mint(uint256 quantity) external payable nonReentrant {
        require(isActive, "SALE_NOT_STARTED");
        require(tx.origin == msg.sender, "CALLER_CAN'T_BE_CONTRACT");
        require(totalSupply() + quantity <= maxSupply, "MAX_SUPPLY_REACHED");
        require(
            _numberMinted(msg.sender) + quantity <= maxMint,
            "EXCEDEED_MAX_MINT"
        );
        require(msg.value >= quantity * _getPrice(), "PRICE: VALUE_TOO_LOW");

        _safeMint(msg.sender, quantity);
    }

    // --------- VIEW --------------

    function getCurrentPrice() public view returns (uint256) {
        return _getPrice();
    }

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

        if (block.timestamp >= revealTime) {
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json"))
                : unrevealedURI;
        } else {
            return unrevealedURI;
        }
    }

    // --------- INTERNAL -----------

    function _getPrice() internal view returns (uint256) {
        uint256 price;
        uint256 decrement = decrementAmount *
            ((block.timestamp - auctionStart) / decrementInterval);

        if (decrement >= (startingPrice - minimumPrice)) {
            price = minimumPrice;
        } else {
            price = startingPrice - decrement;
        }

        return price;
    }

    // --------- RESTRICTED -----------

    function airdrop(address _user, uint256 _quantity) external onlyOwner {
        require(totalSupply() + _quantity <= maxSupply, "MAX_SUPPLY_REACHED");

        _safeMint(_user, _quantity);
    }

    function startAuction() external onlyOwner {
        require(!isActive, "ALREADY_STARTED");
        isActive = true;
        auctionStart = block.timestamp;
        revealTime = block.timestamp + decrementDuration + 48 hours; // 48 hours after the minimum price is reached
    }

    function stopAuction() external onlyOwner {
        require(isActive, "ALREADY_INACTIVE");
        isActive = false;
    }

    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    function setUnrevealedURI(string memory _uri) external onlyOwner {
        unrevealedURI = _uri;
    }

    function setDecrementFunction(
        uint256 _maxPrice,
        uint256 _minPrice,
        uint256 _decInterval,
        uint256 _decAmount
    ) external onlyOwner {
        require(_maxPrice >= _minPrice, "MAX_LESS_THAN_MIN");
        require(_decInterval > 0, "INTERVAL_TOO_LOW");
        uint256 priceDelta = _maxPrice - _minPrice;
        require(_decAmount <= priceDelta, "DEC_AMOUNT_TOO_HIGH");
        require(priceDelta % _decAmount == 0, "NOT_EVENLY_DIVISIBLE");

        decrementDuration = (priceDelta / _decAmount) * _decInterval;
        startingPrice = _maxPrice;
        minimumPrice = _minPrice;
        decrementAmount = _decAmount;
        decrementInterval = _decInterval;
    }

    function setStartingPrice(uint256 _price) external onlyOwner {
        require(_price >= minimumPrice, "LESS_THAN_MIN");
        startingPrice = _price;
    }

    function setMinimumPrice(uint256 _price) external onlyOwner {
        require(_price <= startingPrice, "GREATER_THAN_MAX");
        minimumPrice = _price;
    }

    function setDecrementInterval(uint256 _amount) external onlyOwner {
        require(_amount > 0, "AMOUNT_TOO_LOW");
        decrementInterval = _amount;
    }

    function setDecrementAmount(uint256 _amount) external onlyOwner {
        require(_amount <= startingPrice - minimumPrice, "DECREMENT_TOO_LARGE");
        decrementAmount = _amount;
    }

    function setMaxMint(uint256 _amount) external onlyOwner {
        require(_amount > 0, "AMOUNT_TOO_LOW");
        maxMint = _amount;
    }

    function setRevealTime(uint256 _timestamp) external onlyOwner {
        revealTime = _timestamp;
    }

    function setWithdrawalAddress(address _withdrawal) external onlyOwner {
        withdrawalAddress = _withdrawal;
    }

    function withdraw() external onlyOwner {
        // Using call because transfer doesn't work with contract addresses, and call works with both accounts and contracts.
        (bool os, ) = payable(withdrawalAddress).call{
            value: address(this).balance
        }("");
        require(os);
    }
}
