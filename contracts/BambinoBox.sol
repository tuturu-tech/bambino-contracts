//SDPX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BambinoBox is ERC1155, ERC1155Burnable, Ownable, ReentrancyGuard {
    uint256 public maxCirculatingSupply = 1500;
    uint256 public circulatingSupply;
    uint256 public burnedSupply;
    uint256 public price = 0.1 ether; // test
    uint256 public maxMint = 10; // test
    uint256 public counter = 1;
    address public withdrawalAddress;
    address public approvedMinter;

    bool public paused;
    mapping(address => uint256) minted;

    constructor(string memory _uri) ERC1155(_uri) {}

    // --------- RESTRICTED TO CONTRACT -----------

    function mint(address _user, uint256 _quantity)
        external
        payable
        nonReentrant
    {
        require(msg.sender == approvedMinter, "NOT_AUTHORIZED");
        require(
            circulatingSupply + _quantity <= maxCirculatingSupply,
            "SUPPLY: MAX_REACHED"
        );
        circulatingSupply += _quantity;
        for (uint256 i; i < _quantity; i++) {
            _mint(_user, counter++, 1, "");
        }
    }

    function burn(uint256[] calldata _tokenIds) external nonReentrant {
        // Do I need to check for ownership?
        circulatingSupply -= _tokenIds.length;
        burnedSupply += _tokenIds.length;
        for (uint256 i; i < _tokenIds.length; i++) {
            _burn(msg.sender, _tokenIds[i], 1);
        }
    }

    // --------- RESTRICTED -----------

    function airdrop(address _user, uint256 _quantity) external onlyOwner {
        require(
            circulatingSupply + _quantity <= maxCirculatingSupply,
            "SUPPLY: MAX_REACHED"
        );
        counter += _quantity;
        _mint(_user, 1, _quantity, "");
    }

    function togglePaused() external onlyOwner {
        paused = !paused;
    }

    function setApprovedMinted(address _address) external onlyOwner {
        approvedMinter = _address;
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
