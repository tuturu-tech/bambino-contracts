//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Vial is ERC1155, ERC1155Burnable, Ownable, ReentrancyGuard {
    uint256 public maxSupply = 1000; // test
    uint256 public price = 0.1 ether; // test
    uint256 public maxMint = 10; // test
    uint256 public counter = 1;
    address public withdrawalAddress;
    address public BBContract;

    bool public saleStarted;
    mapping(address => uint256) minted;

    constructor(string memory _uri) ERC1155(_uri) {}

    // --------- USER API -----------

    function mint(uint256 _quantity) external payable nonReentrant {
        require(tx.origin == msg.sender, "CALLER_IS_CONTRACT");
        require(saleStarted, "SALE: NOT_STARTED");
        require(msg.value >= price * _quantity, "PRICE: AMOUNT_TOO_LOW");
        require(
            minted[msg.sender] + _quantity <= maxMint,
            "QUANTITY: TOO_HIGH"
        );
        require(counter + _quantity <= maxSupply, "SUPPLY: MAX_REACHED");
        for (uint256 i; i < _quantity; i++) {
            _mint(msg.sender, counter++, 1, "");
        }
    }

    // --------- RESTRICTED TO CONTRACT -----------

    function burn(address _user, uint256 _tokenId) external nonReentrant {
        require(msg.sender == BBContract, "NOT_AUTHORIZED");
        _burn(_user, _tokenId, 1);
    }

    // --------- RESTRICTED -----------

    function airdrop(address _user, uint256 _quantity) external onlyOwner {
        require(counter + _quantity <= maxSupply, "SUPPLY: MAX_REACHED");
        counter += _quantity;
        _mint(_user, 1, _quantity, "");
    }

    function toggleSale() external onlyOwner {
        saleStarted = !saleStarted;
    }

    function setBBContract(address _address) external onlyOwner {
        BBContract = _address;
    }

    function setURI(string calldata _uri) external onlyOwner {
        _setURI(_uri);
    }

    function setWithdrawalAddress(address _withdrawal) external onlyOwner {
        withdrawalAddress = _withdrawal;
    }

    function withdraw() external onlyOwner {
        (bool os, ) = payable(withdrawalAddress).call{
            value: address(this).balance
        }("");
        require(os);
    }
}
