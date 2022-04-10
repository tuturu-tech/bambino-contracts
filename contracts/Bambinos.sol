//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import "./libs/ERC721TT.sol";

contract Bambinos is ERC721MT {
    constructor()
        ERC721MT(
            "Billionaire Bambinos",
            "BB",
            1,
            8000,
            10,
            14 days,
            0xE3Ca443c9fd7AF40A2B5a95d43207E763e56005F
        )
    {}

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        return "test";
    }
}
