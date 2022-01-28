//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Signature is Ownable {
    using ECDSA for bytes32;
    address public allowListSigningAddress;

    constructor(address _allowListSigningAddress) {
        allowListSigningAddress = _allowListSigningAddress;
    }

    function setSigningAddress(address _allowListSigningAddress)
        external
        onlyOwner
    {
        allowListSigningAddress = _allowListSigningAddress;
    }

    modifier verifySignature(bytes calldata _signature) {
        require(
            allowListSigningAddress ==
                keccak256(
                    abi.encodePacked(
                        "\x19Ethereum Signed Message:\n32",
                        bytes32(uint256(uint160(msg.sender)))
                    )
                ).recover(_signature),
            "not allowed"
        );
        _;
    }
}
