//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

import "./libs/ERC721T.sol";
import "./IVial.sol";

contract BillionaireBambinos is
    ERC721T,
    Ownable,
    ReentrancyGuard,
    VRFConsumerBaseV2
{
    using Address for address;
    using Strings for uint256;

    uint256 public cycleLength = 14 days;
    string public baseURI =
        "ipfs://QmRgJuozuryM1WyVBd6uexfvTYuSts9Puw2mHstQ6LeNWe/";
    bool active;
    IVial public vialContract;

    // VRF Setup
    VRFCoordinatorV2Interface COORDINATOR;
    uint64 s_subscriptionId;
    address vrfCoordinator = 0x6168499c0cFfCaCD319c818142124B7A15E857ab; // Rinkeby
    bytes32 keyHash =
        0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc; // Rinkeby
    uint32 public callbackGasLimit = 100000;
    uint16 requestConfirmations = 3;
    uint32 public numWords = 1;
    uint256 public s_requestId;

    constructor(
        address _bambinoBox,
        address _vialContract,
        uint64 _subscriptionId
    )
        ERC721T("Billionaire Bambinos", "BB", 1, 8000, 10, _bambinoBox)
        VRFConsumerBaseV2(vrfCoordinator)
    {
        vialContract = IVial(_vialContract);
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        s_subscriptionId = _subscriptionId;
    }

    /* ------------- User API ------------- */

    function burnVialsForBambino(uint256[] memory vialIds) external {
        require(active, "CONTRACT_PAUSED");
        vialContract.burn(msg.sender, vialIds); // Will this revert if user doesn't own the vials?
        _mint(msg.sender, vialIds.length);
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

        return
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json"))
                : "";
    }

    /* ------------- Restricted ------------- */

    function startNextCycle(uint40 timestamp) external onlyOwner {
        require(
            block.timestamp > cycleStartedAt[currentCycle] + cycleLength,
            "TOO_SOON_TO_START_NEW_CYCLE"
        );
        require(
            cycleSeed[currentCycle] != 0 || currentCycle == 0,
            "RANDOM_SEED_NOT_GENERATED"
        );
        require(timestamp >= block.timestamp, "START_TIME_TOO_SMALL");
        currentCycle += 1;
        cycleStartedAt[currentCycle] = timestamp;
    }

    function requestRandomWords() external onlyOwner {
        // Will revert if subscription is not set and funded.
        s_requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
    }

    function fulfillRandomWords(
        uint256, /* requestId */
        uint256[] memory randomWords
    ) internal override {
        cycleSeed[currentCycle] = randomWords[0];
    }

    // THIS IS A TESTING FUNCTION ONLY; REMOVE IN PRODUCTION
    function setCycleSeed(uint256 cycle, uint256 seed) external onlyOwner {
        cycleSeed[cycle] = seed;
    }

    function setCycleLength(uint256 _time) external onlyOwner {
        cycleLength = _time;
    }

    function toggleActive() external onlyOwner {
        active = !active;
    }

    function setBaseURI(string memory uri) external onlyOwner {
        baseURI = uri;
    }

    function setVialContract(address vial) external onlyOwner {
        vialContract = IVial(vial);
    }

    function setBoxContract(address box) external onlyOwner {
        bambinoBox = IBambinoBox(box);
    }

    function setNumWords(uint32 _num) external onlyOwner {
        numWords = _num;
    }

    function setGasLimit(uint32 _limit) external onlyOwner {
        callbackGasLimit = _limit;
    }
}
