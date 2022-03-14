//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IVial.sol";

contract VialTest is ERC721A, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using Strings for uint256;

    IVial vialContract;

    string public baseURI;
    string public unrevealedURI;

    constructor(address _vialContract, string memory _uri)
        ERC721A("TestVial", "TestVial", 10)
    {
        vialContract = IVial(_vialContract);
        baseURI = _uri;
    }

    function mint(uint256 _vialId) external {
        require(
            vialContract.balanceOf(msg.sender, _vialId) > 0,
            "NOT_VIAL_OWNER"
        );
        vialContract.burn(msg.sender, _vialId);
        _safeMint(msg.sender, 1);
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

        bytes(baseURI).length > 0
            ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json"))
            : unrevealedURI;
    }
}
