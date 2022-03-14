//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ContainerContents.sol";

import "hardhat/console.sol";

contract Container is ERC721A, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using Strings for uint256;

    enum Period {
        PAUSED,
        PRESALE,
        PUBLIC
    }

    Period saleState;
    Content public NFT;

    // For signatures
    address public signingAddress = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // TESTING ADDRESS

    uint256 public maxSupply = 4444;
    uint256 public reserved = 300;
    uint256 public maxMint = 2;
    uint256 public priceWL = 0.0001 ether; // CHANGE
    uint256 public pricePS = 0.001 ether; //CHANGE
    uint256 public revealTime;
    uint256 public reserveMinted;
    uint256 public counter;

    string public baseURI;
    string public unrevealedURI;
    address public withdrawalAddress;

    uint256 public WLSaleStart;
    uint256 public publicSaleStart;

    mapping(address => uint256) minted;
    mapping(address => uint256) wlMinted;
    mapping(address => bool) team;
    mapping(uint256 => bool) claimed;

    constructor(address _withdrawalAddress, uint256 _batchSize)
        ERC721A("Baby Boss", "$BBOSS", _batchSize)
    {
        withdrawalAddress = _withdrawalAddress;
        NFT = new Content();
    }

    // --------- USER API ----------

    function mint(uint256 quantity)
        external
        payable
        callerIsUser
        nonReentrant
        verifyPrice(quantity, pricePS)
        onlyPeriod(Period.PUBLIC)
        supplyLimit(quantity, reserved)
    {
        require(
            _numberMinted(msg.sender) + quantity <= maxMint,
            "MAX_MINT: AMOUNT_TOO_HIGH"
        );

        _safeMint(msg.sender, quantity);
        refundIfOver(pricePS * quantity);
    }

    function whitelistMint(
        bytes calldata _signature,
        uint256 quantity,
        uint256 limit
    )
        external
        payable
        callerIsUser
        nonReentrant
        verifyPrice(quantity, priceWL)
        verifySignature(_signature, limit)
        onlyPeriod(Period.PRESALE)
        supplyLimit(quantity, reserved)
    {
        require(
            wlMinted[msg.sender] + quantity <= limit,
            "MAX_MINT: AMOUNT_TOO_HIGH"
        );

        wlMinted[msg.sender] += quantity;
        _safeMint(msg.sender, quantity);
        refundIfOver(priceWL * quantity);
    }

    function claimContent(uint256 _tokenId) external {
        require(!claimed[_tokenId], "ALREADY_CLAIMED");
        require(ownerOf(_tokenId) == msg.sender, "NOT_OWNER");
        claimed[_tokenId] = true;
        NFT.mint(msg.sender, 2);
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

        if (block.timestamp >= revealTime) {
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json"))
                : unrevealedURI;
        } else {
            return unrevealedURI;
        }
    }

    // TESTING FUNCTION - REMOVE IN PRODUCTION
    function isValidSignature(bytes calldata _signature)
        public
        view
        returns (address)
    {
        bytes32 msgHash = keccak256(abi.encode(address(this), msg.sender));
        return msgHash.toEthSignedMessageHash().recover(_signature);
    }

    // --------- INTERNAL ----------

    // --------- PRIVATE -----------

    function refundIfOver(uint256 price) private {
        require(msg.value >= price, "Need to send more ETH.");
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
    }

    // --------- RESTRICTED -----------

    function airdrop(address _user, uint256 _quantity)
        external
        callerIsUser
        onlyTeam
        supplyLimit(_quantity, 0)
    {
        require(reserveMinted + _quantity < reserved, "");
        reserveMinted += _quantity;
        _safeMint(_user, _quantity);
    }

    function airdropBatch(address[] calldata users, uint256 quantity)
        external
        callerIsUser
        onlyTeam
        supplyLimit(quantity * users.length, 0)
    {
        for (uint256 i; i < users.length; i++) {
            _safeMint(users[i], quantity);
        }
    }

    function setSigningAddress(address _signer) external onlyOwner {
        signingAddress = _signer;
    }

    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    function setUnrevealedURI(string memory _uri) external onlyOwner {
        unrevealedURI = _uri;
    }

    function setRevealTime(uint256 _revealTime) external onlyOwner {
        revealTime = _revealTime;
    }

    function setSaleState(uint256 _state) external onlyOwner {
        saleState = Period(_state);
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

    function recoverToken(IERC20 _token) external onlyOwner {
        uint256 balance = _token.balanceOf(address(this));
        bool _success = _token.transfer(owner(), balance);
        require(_success, "Token could not be transferred");
    }

    // --------- MODIFIERS ----------

    modifier callerIsUser() {
        require(tx.origin == msg.sender, "CALLER_IS_CONTRACT");
        _;
    }

    modifier verifySignature(bytes calldata _signature, uint256 _maxMint) {
        require(
            signingAddress ==
                keccak256(
                    abi.encodePacked(
                        "\x19Ethereum Signed Message:\n32",
                        _maxMint,
                        bytes32(uint256(uint160(msg.sender)))
                    )
                ).recover(_signature),
            "not allowed"
        );
        _;
    }

    modifier verifyPrice(uint256 _quantity, uint256 _price) {
        require(msg.value >= _quantity * _price, "PRICE: VALUE_TOO_LOW");
        _;
    }

    modifier onlyPeriod(Period _state) {
        require(saleState == _state, "WRONG_SALE_STATE");
        _;
    }

    modifier supplyLimit(uint256 _quantity, uint256 _reserved) {
        require(
            totalSupply() + _quantity + _reserved <= maxSupply,
            "MAX_SUPPLY: AMOUNT_TOO_HIGH"
        );
        _;
    }

    modifier onlyTeam() {
        require(team[msg.sender], "NOT_IN_TEAM");
        _;
    }
}
