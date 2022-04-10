// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../IBambinoBox.sol";

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

error IncorrectOwner();
error NonexistentToken();
error QueryForZeroAddress();

error TokenIdStaked();
error TokenIdUnstaked();
error ExceedsStakingLimit();

error MintToZeroAddress();
error MintZeroQuantity();
error MintMaxSupplyReached();
error MintMaxWalletReached();

error CallerNotOwnerNorApproved();
error CallerNotOwner();

error ApprovalToCaller();
error ApproveToCurrentOwner();

error TransferFromIncorrectOwner();
error TransferToNonERC721ReceiverImplementer();
error TransferToZeroAddress();

error InvalidType();

error NotStakedForFullCycle();
error NoRewardWon();
error RewardAlreadyClaimed();
error InvalidCycle();
error InvalidRewardSeed();

abstract contract ERC721MT {
    using Address for address;
    using Strings for uint256;

    IBambinoBox bambinoBox;

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed id
    );
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 indexed id
    );
    event ApprovalForAll(
        address indexed owner,
        address indexed operator,
        bool approved
    );

    struct TokenData {
        address owner;
        uint40 lastRewardClaimed;
        bool staked;
        bool nextTokenDataSet;
        uint256[] stakeStart;
        uint256[] rewarded;
    }

    struct UserData {
        uint40 balance;
        uint40 numRewards;
        uint40 numMinted;
        uint40 numStaked;
    }

    string public name;
    string public symbol;

    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    uint256 public totalSupply;
    uint256 public cycleLength;
    uint256 public currentCycle;
    uint256[] bitmapDefault = [2**256 - 1, 2**256 - 1, 2**256 - 1]; // around 30 years worth of cycles

    uint256 immutable startingIndex;
    uint256 immutable collectionSize;
    uint256 immutable maxPerWallet;

    // note: hard limit of 255, otherwise overflows can happen
    uint256 constant stakingLimit = 100;

    mapping(uint256 => TokenData) internal _tokenData;
    mapping(address => UserData) internal _userData;
    mapping(uint256 => uint256) internal cycleStartsAt;
    mapping(uint256 => uint256) internal cycleSeed;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 startingIndex_,
        uint256 collectionSize_,
        uint256 maxPerWallet_,
        uint256 cycleLength_,
        address bambinoBox_
    ) {
        name = name_;
        symbol = symbol_;
        collectionSize = collectionSize_;
        maxPerWallet = maxPerWallet_;
        startingIndex = startingIndex_;
        cycleLength = cycleLength_;
        bambinoBox = IBambinoBox(bambinoBox_);
    }

    /* ------------- External ------------- */

    function stake(uint256[] calldata tokenIds) external payable {
        UserData memory userData = _userData[msg.sender];
        for (uint256 i; i < tokenIds.length; ++i)
            userData = _stake(msg.sender, tokenIds[i], userData);
        _userData[msg.sender] = userData;
    }

    function unstake(uint256[] calldata tokenIds) external payable {
        UserData memory userData = _userData[msg.sender];
        for (uint256 i; i < tokenIds.length; ++i)
            userData = _unstake(msg.sender, tokenIds[i], userData);
        _userData[msg.sender] = userData;
    }

    function claimRewards(uint256 tokenId) external payable {
        TokenData memory tokenData = _tokenDataOf(tokenId);
        for (
            uint256 i = tokenData.lastRewardClaimed + 1;
            i <= currentCycle;
            i++
        ) {
            if (_rewardEarned(i, tokenId) && !_rewardClaimed(i, tokenId)) {
                _claimReward(i, tokenId);
            }
        }
        _tokenData[tokenId].lastRewardClaimed = uint40(currentCycle);
    }

    /* ------------- Private ------------- */

    //
    function _stake(
        address from,
        uint256 tokenId,
        UserData memory userData
    ) private returns (UserData memory) {
        TokenData memory tokenData = _tokenDataOf(tokenId);

        if (userData.numStaked >= stakingLimit) revert ExceedsStakingLimit();
        if (tokenData.owner != from || tokenData.staked)
            revert IncorrectOwner();
        if (tokenData.staked == true) revert TokenIdStaked();

        delete getApproved[tokenId];
        (uint256 index, uint256 slot, uint256 bitmap, ) = _getBitmapInfo(
            currentCycle,
            tokenId
        );

        if ((bitmap >> slot) & uint256(1) == 1) revert TokenIdStaked();
        uint256 bitmask = ~uint256(1 << slot);

        tokenData.staked = true;
        tokenData.stakeStart[index] = bitmap & bitmask;

        unchecked {
            userData.balance--;
            userData.numStaked++;
        }

        _tokenData[tokenId] = tokenData;

        emit Transfer(from, address(this), tokenId);

        return userData;
    }

    // WORK IN PROGRESS
    // Currently this would block people from unstaking if they staked during one of the previous cycles, and it doesn't update the correct cycle anyway
    // Needs to be changed so it only checks if a token is currently staked and then if stakedBitmap slot is 1, stay at 1, if it's 0, switch it to 1
    function _unstake(
        address to,
        uint256 tokenId,
        UserData memory userData
    ) private returns (UserData memory) {
        TokenData memory tokenData = _tokenDataOf(tokenId);
        uint256 cycle = currentCycle - 1;

        if (tokenData.owner != to) revert IncorrectOwner();
        if (!tokenData.staked) revert TokenIdUnstaked();

        (uint256 index, uint256 slot, uint256 bitmap, ) = _getBitmapInfo(
            cycle,
            tokenId
        );
        if ((bitmap >> slot) & uint256(1) == 0) revert TokenIdUnstaked();
        uint256 bitmask = uint256(1 << slot);

        tokenData.staked = false;
        tokenData.stakeStart[index] = bitmap | bitmask;

        _tokenData[tokenId] = tokenData;

        emit Transfer(address(this), to, tokenId);

        userData.balance--;
        userData.numStaked--;

        return userData;
    }

    function _claimReward(uint256 _cycle, uint256 _tokenId) private {
        uint256 rewardSeed = cycleSeed[_cycle];
        TokenData memory tokenData = _tokenDataOf(_tokenId);
        if (msg.sender != tokenData.owner) revert CallerNotOwner();
        if (_cycle > currentCycle || _cycle <= 0) revert InvalidCycle();
        if (rewardSeed == 0) revert InvalidRewardSeed();

        if ((uint256(keccak256(abi.encode(rewardSeed, _tokenId))) % 4) != 1)
            revert NoRewardWon();

        (uint256 index, uint256 slot, , uint256 rewardBitmap) = _getBitmapInfo(
            _cycle,
            _tokenId
        );
        if (_getBitmapSlot(_cycle - 1, _tokenId, 0) == 1)
            revert NotStakedForFullCycle();
        if ((rewardBitmap >> slot) & uint256(1) == 0)
            revert RewardAlreadyClaimed();
        uint256 bitmask = ~uint256(1 << slot);
        tokenData.rewarded[index] = rewardBitmap & bitmask;

        _tokenData[_tokenId] = tokenData;
        _userData[msg.sender].numRewards += 1;

        bambinoBox.mint(tokenData.owner, 1);
    }

    /* ------------- Internal ------------- */

    function _mint(address to, uint256 quantity) internal {
        unchecked {
            uint256 supply = totalSupply;
            uint256 startTokenId = startingIndex + supply;

            UserData memory userData = _userData[to];

            if (to == address(0)) revert MintToZeroAddress();
            if (quantity == 0) revert MintZeroQuantity();

            if (supply + quantity > collectionSize)
                revert MintMaxSupplyReached();
            if (
                userData.numMinted + quantity > maxPerWallet &&
                address(this).code.length != 0
            ) revert MintMaxWalletReached();

            // don't update for airdrops
            if (to == msg.sender) userData.numMinted += uint40(quantity);

            // don't have to care about next token data if only minting one
            // could optimize to implicitly flag last token id of batch
            // if (quantity == 1) tokenData.nextTokenDataSet = true;
            TokenData memory tokenData = TokenData(
                to,
                0,
                false,
                quantity == 1,
                bitmapDefault,
                bitmapDefault
            );

            userData.balance += uint40(quantity);
            for (uint256 i; i < quantity; ++i)
                emit Transfer(address(0), to, startTokenId + i);

            _userData[to] = userData;
            _tokenData[startTokenId] = tokenData;

            totalSupply += quantity;
        }
    }

    function _getBitmapInfo(uint256 _cycle, uint256 _tokenId)
        internal
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        if (_cycle > currentCycle) revert InvalidCycle();
        TokenData memory tokenData = _tokenDataOf(_tokenId);
        uint256 index = _cycle / 256;
        uint256 slot = _cycle % 256;
        return (
            index,
            slot,
            tokenData.stakeStart[index],
            tokenData.rewarded[index]
        );
    }

    function _getBitmapSlot(
        uint256 _cycle,
        uint256 _tokenId,
        uint256 _type
    ) internal view returns (uint256) {
        if (_cycle > currentCycle) revert InvalidCycle();
        (
            ,
            uint256 slot,
            uint256 stakedBitmap,
            uint256 rewardedBitmap
        ) = _getBitmapInfo(_cycle, _tokenId);
        uint256 result;
        if (_type == 0) {
            result = (stakedBitmap >> slot) & uint256(1);
        } else if (_type == 1) {
            result = (rewardedBitmap >> slot) & uint256(1);
        } else {
            revert InvalidType();
        }
        return result;
    }

    // public in case other contracts want to check some of the data on-chain
    function _tokenDataOf(uint256 tokenId)
        public
        view
        returns (TokenData memory tokenData)
    {
        if (!_exists(tokenId)) revert NonexistentToken();

        // Why is this a loop?
        for (uint256 curr = tokenId; ; curr--) {
            tokenData = _tokenData[curr];
            if (tokenData.owner != address(0)) return tokenData;
        }
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return
            startingIndex <= tokenId && tokenId < startingIndex + totalSupply;
    }

    function _rewardEarned(uint256 cycle, uint256 tokenId)
        internal
        view
        returns (bool)
    {
        if (cycle > currentCycle || cycle <= 1) revert InvalidCycle();
        uint256 rewardSeed = cycleSeed[cycle];
        if (rewardSeed == 0) revert InvalidRewardSeed();

        if ((uint256(keccak256(abi.encode(rewardSeed, tokenId))) % 4) != 1) {
            return false;
        } else {
            return true;
        }
    }

    function _rewardClaimed(uint256 cycle, uint256 tokenId)
        internal
        view
        returns (bool)
    {
        if (cycle > currentCycle) revert InvalidCycle();
        (, uint256 slot, , uint256 bitmap) = _getBitmapInfo(cycle, tokenId);
        if ((bitmap >> slot) & uint256(1) == 0) {
            return true;
        } else {
            return false;
        }
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public {
        // make sure no one is misled by token transfer event
        // MAKE SURE THIS DOESN'T UPDATE THE WRONG DATA OR ALLOW SOMEONE THAT ISN'T THE OWNER TO MANIPULATE THE DATA
        if (to == address(this)) {
            _userData[msg.sender] = _stake(
                msg.sender,
                tokenId,
                _userData[msg.sender]
            );
        } else {
            TokenData memory tokenData = _tokenDataOf(tokenId);
            address owner = tokenData.owner;

            bool isApprovedOrOwner = (msg.sender == owner ||
                isApprovedForAll[owner][msg.sender] ||
                getApproved[tokenId] == msg.sender);

            if (!isApprovedOrOwner) revert CallerNotOwnerNorApproved();
            if (to == address(0)) revert TransferToZeroAddress();
            if (owner != from && !tokenData.staked)
                revert TransferFromIncorrectOwner();

            delete getApproved[tokenId];

            unchecked {
                tokenData.owner = to;
                _tokenData[tokenId] = tokenData;
            }

            _userData[from].balance--;
            _userData[to].balance++;

            emit Transfer(from, to, tokenId);
        }
    }

    /* ------------- Virtual (hooks) ------------- */

    function _beforeStakeDataTransform(
        uint256, // tokenId
        uint256 userData,
        uint256 tokenData
    ) internal view virtual returns (uint256, uint256) {
        return (userData, tokenData);
    }

    function _beforeUnstakeDataTransform(
        uint256, // tokenId
        uint256 userData,
        uint256 tokenData
    ) internal view virtual returns (uint256, uint256) {
        return (userData, tokenData);
    }

    /* function _pendingReward(address, UserData memory userData)
        internal
        view
        virtual
        returns (uint256);

    function _payoutReward(address user, uint256 reward) internal virtual; */

    /* ------------- View ------------- */

    function ownerOf(uint256 tokenId) external view returns (address) {
        TokenData memory tokenData = _tokenDataOf(tokenId);
        return tokenData.staked ? address(this) : tokenData.owner;
    }

    function trueOwnerOf(uint256 tokenId) external view returns (address) {
        return _tokenDataOf(tokenId).owner;
    }

    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert QueryForZeroAddress();
        return _userData[owner].balance;
    }

    function numStaked(address user) external view returns (uint256) {
        return _userData[user].numStaked;
    }

    function numOwned(address user) external view returns (uint256) {
        UserData memory userData = _userData[user];
        return userData.balance + userData.numStaked;
    }

    function numMinted(address user) external view returns (uint256) {
        return _userData[user].numMinted;
    }

    function rewardEarned(uint256 cycle, uint256 tokenId)
        external
        view
        returns (bool)
    {
        return _rewardEarned(cycle, tokenId);
    }

    function rewardClaimed(uint256 cycle, uint256 tokenId)
        external
        view
        returns (bool)
    {
        return _rewardClaimed(cycle, tokenId);
    }

    // O(N) read-only functions
    // type 0 -> Balance in the users wallet
    // type 1 -> The amount of tokens staked
    // type 2 -> wallet balance + staked tokens balance
    function tokenIdsOf(address user, uint256 type_)
        external
        view
        returns (uint256[] memory)
    {
        unchecked {
            uint256 numTotal = type_ == 0 ? this.balanceOf(user) : type_ == 1
                ? this.numStaked(user)
                : this.numOwned(user);

            uint256[] memory ids = new uint256[](numTotal);

            if (numTotal == 0) return ids;

            uint256 count;
            TokenData memory tokenData;
            for (
                uint256 i = startingIndex;
                i < totalSupply + startingIndex;
                ++i
            ) {
                tokenData = _tokenDataOf(i);
                if (user == tokenData.owner) {
                    if (
                        (type_ == 0 && !tokenData.staked) ||
                        (type_ == 1 && tokenData.staked) ||
                        type_ == 2
                    ) {
                        ids[count++] = i;
                        if (numTotal == count) return ids;
                    }
                }
            }

            return ids;
        }
    }

    function totalNumStaked() external view returns (uint256) {
        unchecked {
            uint256 count;
            for (
                uint256 i = startingIndex;
                i < startingIndex + totalSupply;
                ++i
            ) {
                if (_tokenDataOf(i).staked) ++count;
            }
            return count;
        }
    }

    /* ------------- ERC721 ------------- */

    function tokenURI(uint256 id) public view virtual returns (string memory);

    function supportsInterface(bytes4 interfaceId)
        external
        view
        virtual
        returns (bool)
    {
        return
            interfaceId == 0x01ffc9a7 || // ERC165 Interface ID for ERC165
            interfaceId == 0x80ac58cd || // ERC165 Interface ID for ERC721
            interfaceId == 0x5b5e139f; // ERC165 Interface ID for ERC721Metadata
    }

    function approve(address spender, uint256 tokenId) external {
        TokenData memory tokenData = _tokenDataOf(tokenId);
        address owner = tokenData.owner;

        if (
            (msg.sender != owner && !isApprovedForAll[owner][msg.sender]) ||
            tokenData.staked
        ) revert CallerNotOwnerNorApproved();

        getApproved[tokenId] = spender;
        emit Approval(owner, spender, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public {
        transferFrom(from, to, tokenId);
        if (
            to.code.length != 0 &&
            IERC721Receiver(to).onERC721Received(
                msg.sender,
                from,
                tokenId,
                data
            ) !=
            IERC721Receiver(to).onERC721Received.selector
        ) revert TransferToNonERC721ReceiverImplementer();
    }
}

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 id,
        bytes calldata data
    ) external returns (bytes4);
}
