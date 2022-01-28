//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NFTA is ERC721A, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using Strings for uint256;
    enum SaleType {
        WL,
        TEAM
    }

    // For Merkle Trees
    bytes32 public merkleRoot;
    // For signatures
    address public allowListSigningAddress;

    uint256 public immutable maxSupply;
    uint256 public immutable giveawayReserved;
    uint256 public immutable teamReserved;
    uint256 public immutable maxMint;
    uint256 public priceWL;
    uint256 public pricePS;
    uint256 public revealTime;
    string public baseURI;
    string public unrevealedURI;

    uint256 public WLSaleStart;
    uint256 public publicSaleStart;

    mapping(address => uint256) minted;

    constructor(
        uint256 _maxSupply,
        uint256 _giveawayReserved,
        uint256 _teamReserved,
        uint256 _maxMint,
        uint256 _priceWL,
        uint256 _pricePS
    ) ERC721A("NFTA", "NFTA", 5) {
        maxSupply = _maxSupply;
        giveawayReserved = _giveawayReserved;
        teamReserved = _teamReserved;
        maxMint = _maxMint;
        priceWL = _priceWL;
        pricePS = _pricePS;
    }

    // --------- USER API ----------

    function mint(uint256 quantity)
        external
        payable
        callerIsUser
        verifyPrice(quantity, pricePS)
        verifySaleTime(publicSaleStart)
        mintLimit(quantity)
    {
        _safeMint(msg.sender, quantity);
        refundIfOver(pricePS * quantity);
    }

    function MintSignature(bytes calldata _signature)
        external
        payable
        callerIsUser
        verifyPrice(1, priceWL)
        verifySignature(_signature)
        verifySaleTime(WLSaleStart)
        mintLimit(1)
    {
        // business logic
        _safeMint(msg.sender, 1);
        refundIfOver(priceWL);
    }

    function WLMintMerkle(bytes32[] calldata merkleProof)
        external
        payable
        callerIsUser
        verifyPrice(1, priceWL)
        verifyMerkle(merkleProof)
        verifySaleTime(WLSaleStart)
        mintLimit(1)
    {
        _safeMint(msg.sender, 1);
        refundIfOver(priceWL);
        // business logic
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

    // --------- INTERNAL ----------

    // --------- PRIVATE -----------

    function refundIfOver(uint256 price) private {
        require(msg.value >= price, "Need to send more ETH.");
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
    }

    // --------- RESTRICTED -----------

    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    function setUnrevealedURI(string memory _uri) external onlyOwner {
        unrevealedURI = _uri;
    }

    function setRevealTime(uint256 _revealTime) external onlyOwner {
        revealTime = _revealTime;
    }

    function setPublicSaleStart(uint256 _publicSaleStart) external onlyOwner {
        publicSaleStart = _publicSaleStart;
    }

    function setWLSaleStart(uint256 _WLSaleStart) external onlyOwner {
        WLSaleStart = _WLSaleStart;
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

    modifier verifyMerkle(bytes32[] calldata merkleProof) {
        require(
            MerkleProof.verify(
                merkleProof,
                merkleRoot,
                keccak256(abi.encodePacked(msg.sender))
            ),
            "not allowed"
        );
        _;
    }

    modifier verifyPrice(uint256 quantity, uint256 price) {
        require(msg.value >= quantity * price, "PRICE: VALUE_TOO_LOW");
        _;
    }

    modifier verifySaleTime(uint256 saleStart) {
        require(block.timestamp >= saleStart, "SALE_NOT_STARTED");
        _;
    }

    modifier mintLimit(uint256 quantity) {
        require(
            _numberMinted(msg.sender) + quantity <= maxMint,
            "MAX_MINT: AMOUNT_TOO_HIGH"
        );
        require(
            totalSupply() + quantity <= maxSupply,
            "MAX_SUPPLY: AMOUNT_TOO_HIGH"
        );
        _;
    }

    modifier signatureCheck(bytes calldata _signature, SaleType _saleType) {
        // Something
        _;
    }
}
